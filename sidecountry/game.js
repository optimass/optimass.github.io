import * as THREE from './lib/three.module.js';
import { MountainWorld, groundHeight, RUN_LENGTH } from './world.js';
import { RIDERS, portrait, RiderModel } from './riders.js';
import { MountainRun } from './physics.js';
import { MountainAudio } from './audio.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const format = n => Math.round(n).toLocaleString('en-US');
const audio = new MountainAudio();
let selectedRider = 'massimo', selectedRoute = 'park', mode = 'menu', renderer, scene, camera, world, rider, run, sun, clock, animationTime = 0, lastHud = 0, announceUntil = 0, trickUntil = 0, cameraShake = 0;
const keys = new Set(), touch = new Set();
let controller = false, previousStart = false, previousBack = false, stickCharged = false, controllerPop = false;
let bests = {};
try { bests = JSON.parse(localStorage.getItem('sidecountry.records') || '{}') || {}; } catch { bests = {}; }
const recordKey = () => `${selectedRider}.${selectedRoute}`;

for (const element of document.querySelectorAll('[data-portrait]')) element.innerHTML = portrait(element.dataset.portrait);
$('drop-in').disabled = true; $('drop-in').firstElementChild.textContent = 'Opening the mountain…';
for (let i = 0; i < 12; i++) $('speed-bars').append(document.createElement('i'));

function announce(text, seconds = 2.5) { $('announcement').textContent = text; $('announcement').classList.add('visible'); announceUntil = animationTime + seconds; }

function showTrick(caption, name, points, style = '') {
  $('trick-display').className = `trick-display ${style}`; $('trick-caption').textContent = caption; $('trick-name').textContent = name; $('trick-score').textContent = points; $('trick-display').style.opacity = 1; trickUntil = animationTime + 3.5;
}

function handleEvent(name, data = {}) {
  audio.event(name);
  if (name === 'pop') cameraShake = .04;
  if (name === 'land') { cameraShake = data.big ? .24 : .1; world.emitSnow(run.state, data.big ? 28 : 12, true); }
  if (name === 'trick') showTrick(data.multiplier > 1 ? `LINKED LINE · ×${data.multiplier.toFixed(1)}` : 'CLEAN LANDING', data.name, `${format(data.points)} × ${data.multiplier.toFixed(1)}`);
  if (name === 'bank') showTrick('POINTS IN THE POCKET', data.name, `+ ${format(data.points)}`, 'banked');
  if (name === 'bail') { showTrick('WIN SOME. WIPE OUT SOME.', 'Yard sale.', 'Combo lost. Shake it off.', 'bailed'); world.emitSnow(run.state, 40, true); cameraShake = .5; announce(data.reason); }
  if (name === 'recover') announce('Back at it.');
  if (name === 'rail') announce('Locked in. Stay smooth.');
  if (name === 'grind') showTrick('ON THE RAIL', RIDERS[selectedRider].type === 'snowboard' ? 'Boardslide' : 'Ski slide', `+ ${format(data.points)}`);
  if (name === 'finish') finishRun();
}

function changeRider(id) {
  if (!RIDERS[id] || mode !== 'menu') return;
  selectedRider = id;
  for (const card of document.querySelectorAll('.rider-card')) { const selected = card.dataset.rider === id; card.classList.toggle('selected', selected); card.setAttribute('aria-pressed', String(selected)); }
  $('rider-preview').querySelector('strong').textContent = RIDERS[id].name; $('rider-preview').querySelector('small').textContent = RIDERS[id].motto;
  if (rider) { scene.remove(rider.root); rider.dispose(); rider = new RiderModel(id); scene.add(rider.root); run = new MountainRun(world, RIDERS[id], handleEvent); }
}

function changeRoute(route) {
  if (mode !== 'menu') return;
  selectedRoute = route;
  for (const button of document.querySelectorAll('[data-route]')) { const selected = button.dataset.route === route; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); }
  $('scene-label').querySelector('h2').innerHTML = `${route === 'park' ? 'Juniper Park' : 'The Ridgeline'}<span>46° 51′ N · 09° 31′ E</span>`;
  $('scene-label').querySelector('.scene-description').textContent = route === 'park' ? 'Find a line. Make it yours.' : 'A little wilder. A little higher.';
  if (world) { world.setRoute(route); run.reset(); }
}

function closeDialogs() { for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); }

function startRun() {
  if (!renderer) return;
  closeDialogs(); mode = 'playing'; keys.clear(); touch.clear(); stickCharged = false; controllerPop = false; run.reset(); world.reset(); cameraShake = 0;
  $('app').classList.add('is-playing'); $('game-hud').hidden = false; $('hud-portrait').innerHTML = portrait(selectedRider); $('hud-name').textContent = RIDERS[selectedRider].name; $('hud-route').textContent = selectedRoute === 'park' ? 'JUNIPER PARK' : 'THE RIDGELINE'; $('best-score').textContent = `BEST ${format(bests[recordKey()] || 0)}`;
  showTrick('MAKE YOUR FIRST LINE', 'Fresh tracks.', ''); announce(controller ? 'Right stick down, then flick up to pop.' : 'Hold Space. Release to pop. Make it yours.', 5);
  resize(); const s = run.state; camera.position.set(s.x + 1.3, s.y + 6.3, s.z - 11); $('game-canvas').focus({ preventScroll: true });
  if (audio.enabled) audio.enable(true);
}

function pause() { if (mode !== 'playing') return; mode = 'paused'; keys.clear(); touch.clear(); run.wasPop = false; run.state.charge = 0; $('pause-modal').showModal(); }
function resume() { if (mode !== 'paused') return; closeDialogs(); mode = 'playing'; clock.getDelta(); $('game-canvas').focus({ preventScroll: true }); }
function returnToMenu() { closeDialogs(); mode = 'menu'; keys.clear(); touch.clear(); $('app').classList.remove('is-playing'); $('game-hud').hidden = true; run.reset(); world.reset(); resize(); }

function finishRun() {
  mode = 'results'; keys.clear(); touch.clear(); const record = bests[recordKey()] || 0, isRecord = run.score > record;
  if (isRecord) { bests[recordKey()] = run.score; try { localStorage.setItem('sidecountry.records', JSON.stringify(bests)); } catch { /* Playing still works with storage disabled. */ } }
  $('results-rider').textContent = `${RIDERS[selectedRider].name} · ${selectedRoute === 'park' ? 'Juniper Park' : 'The Ridgeline'}`; $('result-score').textContent = format(run.score); $('record-label').textContent = isRecord ? '✳ NEW PERSONAL BEST' : 'ANOTHER GOOD DAY ON THE MOUNTAIN'; $('result-trick').textContent = format(run.bestCombo); $('result-air').textContent = `${run.airTime.toFixed(1)}s`; $('result-bails').textContent = run.bails; $('results').showModal();
}

const guideData = {
  keyboard: [['Carve · spin in the air', '← → / A D'], ['Speed up · frontflip in the air', '↑ / W'], ['Brake · backflip in the air', '↓ / S'], ['Load up → ollie', 'Hold SPACE → release'], ['Grab · signature tweak', 'Hold J · Hold K'], ['Pause · restart · help', 'P / ESC · R · H']],
  controller: [['Carve · spin in the air', 'Left stick ← →'], ['Speed up · brake · flips in the air', 'Left stick ↑ ↓'], ['Load up → ollie (Skate style)', 'Right stick ↓ → flick ↑'], ['Alternate jump', 'Hold A / ✕ → release'], ['Grab · signature tweak', 'LT / L2 · RT / R2'], ['Pause · restart', 'Menu / Options · View / Share']],
  touch: [['Carve · spin in the air', 'Hold ← or →'], ['Load up → ollie', 'Hold POP → release'], ['Grab · signature tweak', 'Hold GRAB · Hold TWEAK'], ['Pause the run', 'Tap Ⅱ at the top']],
};
function guideTab(tab) { for (const b of document.querySelectorAll('[data-guide]')) b.classList.toggle('selected', b.dataset.guide === tab); $('guide-content').innerHTML = guideData[tab].map(([action, button]) => `<div class="guide-row"><span>${action}</span><span>${button}</span></div>`).join(''); }
let guidePausedGame = false;
function openGuide() { if ($('guide').open) return; guidePausedGame = mode === 'playing'; if (guidePausedGame) { mode = 'guide'; keys.clear(); touch.clear(); run.wasPop = false; run.state.charge = 0; } guideTab(controller ? 'controller' : matchMedia('(pointer:coarse)').matches ? 'touch' : 'keyboard'); $('guide').showModal(); }
function restoreAfterGuide() { const resumeGame = guidePausedGame && mode === 'guide'; guidePausedGame = false; if (resumeGame) { mode = 'playing'; $('game-canvas').focus({ preventScroll: true }); } }
function closeGuide() { $('guide').close(); restoreAfterGuide(); }
$('guide').addEventListener('close', restoreAfterGuide);
$('guide').addEventListener('cancel', event => { event.preventDefault(); closeGuide(); });

for (const card of document.querySelectorAll('.rider-card')) card.addEventListener('click', () => changeRider(card.dataset.rider));
for (const button of document.querySelectorAll('[data-route]')) button.addEventListener('click', () => changeRoute(button.dataset.route));
for (const button of document.querySelectorAll('[data-guide]')) button.addEventListener('click', () => guideTab(button.dataset.guide));
for (const id of ['guide-nav', 'quick-guide']) $(id).addEventListener('click', openGuide);
for (const button of document.querySelectorAll('.close-modal')) button.addEventListener('click', () => { if (button.closest('dialog') === $('guide')) closeGuide(); else button.closest('dialog').close(); });
$('guide-done').addEventListener('click', closeGuide);
$('mountain-nav').addEventListener('click', () => { if (mode === 'playing') pause(); else if (mode === 'menu') $('mountain').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
$('crew-nav').addEventListener('click', () => { if (mode === 'playing') pause(); else if (mode === 'menu') $('riders').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
$('drop-in').addEventListener('click', startRun); $('pause-button').addEventListener('click', pause); $('resume').addEventListener('click', resume); $('restart').addEventListener('click', startRun); $('back-menu').addEventListener('click', returnToMenu); $('ride-again').addEventListener('click', startRun); $('results-menu').addEventListener('click', returnToMenu);
$('pause-modal').addEventListener('cancel', event => { event.preventDefault(); resume(); });
$('results').addEventListener('cancel', event => { event.preventDefault(); returnToMenu(); });
$('audio-toggle').addEventListener('click', () => { audio.enable(!audio.enabled); $('audio-toggle').classList.toggle('enabled', audio.enabled); $('audio-toggle').setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Enable sound'); $('audio-toggle').title = audio.enabled ? 'Sound on' : 'Sound off'; });

const gameKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'Space']);
window.addEventListener('keydown', event => {
  if (mode === 'playing' && gameKeys.has(event.code)) { event.preventDefault(); keys.add(event.code); }
  if (event.repeat) return;
  if (event.code === 'KeyP' || event.code === 'Escape' && mode === 'playing') { event.preventDefault(); if (mode === 'playing') pause(); else if (mode === 'paused') resume(); }
  if (event.code === 'KeyR' && mode === 'playing') startRun();
  if (event.code === 'KeyH' && (mode === 'playing' || mode === 'menu')) openGuide();
});
window.addEventListener('keyup', event => { if (mode === 'playing' && gameKeys.has(event.code)) event.preventDefault(); keys.delete(event.code); });
window.addEventListener('blur', () => { keys.clear(); touch.clear(); if (mode === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'playing') pause(); });
for (const button of document.querySelectorAll('[data-touch]')) {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); touch.add(button.dataset.touch); button.classList.add('pressed'); });
  const release = event => { event.preventDefault(); touch.delete(button.dataset.touch); button.classList.remove('pressed'); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}

function readInput() {
  const pressed = (...codes) => codes.some(code => keys.has(code));
  let move = Number(pressed('ArrowRight', 'KeyD') || touch.has('right')) - Number(pressed('ArrowLeft', 'KeyA') || touch.has('left'));
  let pitch = Number(pressed('ArrowUp', 'KeyW')) - Number(pressed('ArrowDown', 'KeyS'));
  let pop = keys.has('Space') || touch.has('pop'), grab = keys.has('KeyJ') || touch.has('grab'), tweak = keys.has('KeyK') || touch.has('tweak');
  const pads = navigator.getGamepads?.() || [], gamepad = Array.from(pads).find(p => p && p.connected);
  if (gamepad) {
    if (!controller) { controller = true; if (mode === 'playing') announce('Controller connected. Right stick = flick to pop.'); }
    const axis = n => Math.abs(gamepad.axes[n] || 0) > .16 ? gamepad.axes[n] : 0, button = n => gamepad.buttons[n]?.pressed || false;
    if (mode === 'playing') { move = clamp(move + axis(0), -1, 1); pitch = clamp(pitch - axis(1), -1, 1); grab ||= button(6) || button(4); tweak ||= button(7) || button(5);
      if (axis(3) > .35) { stickCharged = true; controllerPop = true; }
      else if (stickCharged && axis(3) < -.25) { controllerPop = false; stickCharged = false; }
      if (stickCharged && axis(3) === 0 && !button(0)) { controllerPop = false; stickCharged = false; }
      pop ||= button(0) || controllerPop;
    }
    if (button(9) && !previousStart) { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); else if (mode === 'menu') startRun(); }
    if (button(8) && !previousBack && mode === 'playing') startRun();
    previousStart = button(9); previousBack = button(8);
  } else { controller = false; previousStart = false; previousBack = false; stickCharged = false; controllerPop = false; }
  return { move, pitch, pop, grab, tweak };
}

function resize() {
  if (!renderer) return;
  const { width, height } = $('mountain').getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe($('mountain'));

function updateHud(dt) {
  if (animationTime - lastHud < .045) return; lastHud = animationTime;
  const s = run.state;
  $('score').textContent = format(run.score); $('speed').textContent = Math.round(s.speed * 3.6); $('charge-fill').style.width = `${s.charge * 100}%`; $('charge-fill').parentElement.classList.toggle('charging', s.charge > 0); $('charge-label').textContent = s.rail ? 'RAIL LOCKED' : s.charge > .8 ? 'READY TO SEND' : 'POP POWER'; $('progress-fill').style.width = `${clamp((s.z - 34) / (RUN_LENGTH - 34) * 100, 0, 100)}%`;
  const bars = $('speed-bars').children; for (let i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i < s.speed / 34 * bars.length);
  if (!s.grounded && !s.rail && s.bailTimer === 0) {
    const rotation = Math.round(Math.abs(s.spin) / Math.PI) * 180, flips = Math.round(Math.abs(s.flip) / (Math.PI * 2));
    const names = []; if (rotation) names.push(`${s.spin < 0 ? 'BS' : 'FS'} ${rotation}`); if (flips) names.push(s.flip > 0 ? 'Frontflip' : 'Backflip'); if (s.grab && s.tweak) names.push(RIDERS[selectedRider].special); else if (s.grab) names.push(RIDERS[selectedRider].grab); else if (s.tweak) names.push(RIDERS[selectedRider].tweak);
    showTrick('IN THE AIR · LAND IT TO KEEP IT', names.join(' + ') || 'Air time', `${(run.jumpAir).toFixed(1)}s${run.combo > 0 ? ` · ${format(run.combo)} in the line` : ''}`);
  } else if (animationTime > trickUntil) $('trick-display').style.opacity = .12;
  if (animationTime > announceUntil) $('announcement').classList.remove('visible');
}

const cameraTarget = new THREE.Vector3(), cameraLook = new THREE.Vector3(), lightTarget = new THREE.Vector3();
function updateCamera(dt) {
  const s = run.state;
  if (mode === 'menu') {
    const orbit = Math.sin(animationTime * .13) * 2;
    cameraTarget.set(-2 + orbit, groundHeight(0, 34) + 7.8, 19); camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 2)); cameraLook.set(-5, groundHeight(0, 52) + 1, 60); camera.lookAt(cameraLook);
  } else {
    const floor = groundHeight(s.x, s.z), airHeight = Math.max(0, s.y - floor), distance = camera.aspect < 1 ? 13.5 : 11.2;
    cameraTarget.set(s.x - s.vx * .1 + 1.1, Math.max(floor + 6.8, s.y + 5.5 - airHeight * .2), s.z - distance);
    camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 5)); cameraLook.set(s.x + s.vx * .1, s.y + 1, s.z + 12);
    if (cameraShake > .005) { camera.position.x += (Math.random() - .5) * cameraShake; camera.position.y += (Math.random() - .5) * cameraShake * .5; cameraShake *= Math.exp(-dt * 10); }
    camera.lookAt(cameraLook);
  }
  lightTarget.set(s.x, groundHeight(s.x, s.z), s.z + 20); sun.position.set(s.x - 65, lightTarget.y + 100, s.z - 65); sun.target.position.copy(lightTarget); sun.target.updateMatrixWorld();
}

function frame() {
  requestAnimationFrame(frame); const dt = Math.min(clock.getDelta(), .1);
  const input = readInput();
  if (mode === 'paused' || mode === 'guide' || mode === 'results') { audio.update(0, false, false); return; }
  animationTime += dt;
  if (mode === 'playing') {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), step = dt / steps; for (let i = 0; i < steps && mode === 'playing'; i++) run.update(step, input);
    if (run.state.grounded && run.state.bailTimer === 0) { world.track(run.state, RIDERS[selectedRider].type !== 'snowboard'); if (Math.random() < .55 + Math.abs(run.state.steer) * .3) world.emitSnow(run.state, Math.abs(run.state.steer) > .3 ? 3 : 1); }
    updateHud(dt);
  }
  if (mode === 'menu') { run.state.steer = Math.sin(animationTime * 1.4) * .08; run.state.charge = .12; }
  rider.update(run.state, animationTime);
  world.update(mode === 'paused' || mode === 'guide' ? 0 : dt, run.state, animationTime); updateCamera(dt); audio.update(run.state.speed, mode === 'playing', !!run.state.rail);
  renderer.render(scene, camera);
}

try {
  renderer = new THREE.WebGLRenderer({ canvas: $('game-canvas'), antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xd4e0da, 120, 480); camera = new THREE.PerspectiveCamera(54, 1, .1, 1000);
  scene.add(new THREE.HemisphereLight(0xd1e6f1, 0xbab3a2, 1.9)); sun = new THREE.DirectionalLight(0xffdbb5, 2.3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -65; sun.shadow.camera.right = 65; sun.shadow.camera.top = 65; sun.shadow.camera.bottom = -65; sun.shadow.camera.near = 1; sun.shadow.camera.far = 280; sun.shadow.bias = -.0005; sun.shadow.normalBias = .035; scene.add(sun); scene.add(sun.target);
  world = new MountainWorld(scene); rider = new RiderModel(selectedRider); scene.add(rider.root); run = new MountainRun(world, RIDERS[selectedRider], handleEvent); const s = run.state; camera.position.set(-2, groundHeight(0, 34) + 7.8, 19); clock = new THREE.Clock(); resize();
  $('drop-in').disabled = false; $('drop-in').firstElementChild.textContent = 'Let’s ride'; frame();
} catch (error) {
  console.error('The mountain could not open:', error); $('load-error').hidden = false; $('drop-in').firstElementChild.textContent = 'Mountain unavailable';
}

export { run, world, scene, camera, renderer, mode };
