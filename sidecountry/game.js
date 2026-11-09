import * as THREE from './lib/three.module.js';
import { MountainWorld, groundHeight, RUN_LENGTH } from './world.js?v=3';
import { RIDERS, portrait, RiderModel } from './riders.js?v=3';
import { MountainRun } from './physics.js?v=3';
import { MountainAudio } from './audio.js?v=3';
import { initPhysics } from './engine.js?v=3';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const format = n => Math.round(n).toLocaleString('en-US');
const audio = new MountainAudio();
let selectedRider = 'massimo', selectedRoute = 'park', mode = 'menu', renderer, scene, camera, world, rider, run, sun, clock, animationTime = 0, lastHud = 0, announceUntil = 0, trickUntil = 0, cameraShake = 0;
const keys = new Set(), touch = new Set(), actions = [];
let controller = false, previousStart = false, previousBack = false, stickCharged = false, controllerPop = false;
let previousFlip = false, previousCork = false;
let bests = {};
try { bests = JSON.parse(localStorage.getItem('sidecountry.records') || '{}') || {}; } catch { bests = {}; }
const recordKey = () => `physics.${selectedRider}.${selectedRoute}`;

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
  if (name === 'bail') { rider.update(run.state, animationTime); rider.beginRagdoll?.(run.engine, scene); showTrick('WIN SOME. WIPE OUT SOME.', 'Yard sale.', 'Combo lost. Shake it off.', 'bailed'); world.emitSnow(run.state, 40, true); cameraShake = .5; announce(data.reason); }
  if (name === 'recover') { rider.endRagdoll?.(); announce('Back at your last clean line.'); }
  if (name === 'unstuck') announce('Back in the fall line. Keep flowing.', 2);
  if (name === 'rail') announce('Locked in. Stay smooth.');
  if (name === 'grind') showTrick('ON THE RAIL', RIDERS[selectedRider].type === 'snowboard' ? 'Boardslide' : 'Ski slide', `+ ${format(data.points)}`);
  if (name === 'finish') finishRun();
}

function changeRider(id) {
  if (!RIDERS[id] || mode !== 'menu') return;
  selectedRider = id;
  for (const card of document.querySelectorAll('.rider-card')) { const selected = card.dataset.rider === id; card.classList.toggle('selected', selected); card.setAttribute('aria-pressed', String(selected)); }
  $('rider-preview').querySelector('strong').textContent = RIDERS[id].name; $('rider-preview').querySelector('small').textContent = RIDERS[id].motto;
  if (rider) { run.dispose(); scene.remove(rider.root); rider.dispose(); rider = new RiderModel(id); scene.add(rider.root); run = new MountainRun(world, RIDERS[id], handleEvent); }
}

function changeRoute(route) {
  if (mode !== 'menu') return;
  selectedRoute = route;
  for (const button of document.querySelectorAll('[data-route]')) { const selected = button.dataset.route === route; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); }
  $('scene-label').querySelector('h2').innerHTML = `${route === 'park' ? 'Juniper Park' : 'The Ridgeline'}<span>46° 51′ N · 09° 31′ E</span>`;
  $('scene-label').querySelector('.scene-description').textContent = route === 'park' ? 'Find a line. Make it yours.' : 'A little wilder. A little higher.';
  if (world) { run.dispose(); world.setRoute(route); run = new MountainRun(world, RIDERS[selectedRider], handleEvent); }
}

function closeDialogs() { for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close(); }

function startRun() {
  if (!renderer) return;
  closeDialogs(); mode = 'playing'; keys.clear(); touch.clear(); actions.length = 0; stickCharged = false; controllerPop = false; run.reset(); rider.endRagdoll?.(); world.reset(); cameraShake = 0; cameraFollowHeading = 0;
  $('app').classList.add('is-playing'); $('game-hud').hidden = false; $('hud-portrait').innerHTML = portrait(selectedRider); $('hud-name').textContent = RIDERS[selectedRider].name; $('hud-route').textContent = selectedRoute === 'park' ? 'JUNIPER PARK' : 'THE RIDGELINE'; $('best-score').textContent = `BEST ${format(bests[recordKey()] || 0)}`;
  showTrick('FIND YOUR FLOW', 'Fresh tracks.', ''); announce(matchMedia('(pointer:coarse)').matches ? 'Tap CORK to send it. Release steering to ride downhill.' : controller ? 'Flick to pop. Y / △ corks. We’ll help you catch the landing.' : 'Space to pop. C to cork. Release steering to ride downhill.', 5);
  resize(); const s = run.state; camera.position.set(s.x + .6, s.y + 2.6, s.z - 5.6); $('game-canvas').focus({ preventScroll: true });
  if (audio.enabled) audio.enable(true);
}

function pause() { if (mode !== 'playing') return; mode = 'paused'; keys.clear(); touch.clear(); actions.length = 0; run.wasPop = false; run.queuedTrick = null; run.jumpBuffer = 0; run.state.charge = 0; $('pause-modal').showModal(); }
function resume() { if (mode !== 'paused') return; closeDialogs(); mode = 'playing'; clock.getDelta(); $('game-canvas').focus({ preventScroll: true }); }
function returnToMenu() { closeDialogs(); mode = 'menu'; keys.clear(); touch.clear(); actions.length = 0; $('app').classList.remove('is-playing'); $('game-hud').hidden = true; run.reset(); rider.endRagdoll?.(); world.reset(); camera.fov = 54; resize(); }

function finishRun() {
  mode = 'results'; keys.clear(); touch.clear(); const record = bests[recordKey()] || 0, isRecord = run.score > record;
  if (isRecord) { bests[recordKey()] = run.score; try { localStorage.setItem('sidecountry.records', JSON.stringify(bests)); } catch { /* Playing still works with storage disabled. */ } }
  $('results-rider').textContent = `${RIDERS[selectedRider].name} · ${selectedRoute === 'park' ? 'Juniper Park' : 'The Ridgeline'}`; $('result-score').textContent = format(run.score); $('record-label').textContent = isRecord ? '✳ NEW PERSONAL BEST' : 'ANOTHER GOOD DAY ON THE MOUNTAIN'; $('result-trick').textContent = format(run.bestCombo); $('result-air').textContent = `${run.airTime.toFixed(1)}s`; $('result-bails').textContent = run.bails; $('results').showModal();
}

const guideData = {
  keyboard: [['Carve · spin a 180 in the air', '← → / A D'], ['Tuck · frontflip in the air', '↑ / W'], ['Brake · backflip in the air', '↓ / S'], ['Brake', 'SHIFT'], ['Load up → ollie', 'Tap / hold SPACE → release'], ['Send a 180 · flip · cork', 'Q / E · F · C'], ['Grab · signature tweak', 'Hold J · Hold K'], ['Pause · restart · help', 'P / ESC · R · H']],
  controller: [['Carve · spin a 180 in the air', 'Left stick ← →'], ['Tuck · brake · flip in the air', 'Left stick ↑ ↓'], ['Load up → ollie', 'Right stick ↓ → flick ↑'], ['Alternate jump', 'Hold A / ✕ → release'], ['Send a flip · cork', 'B / ○ · Y / △'], ['Grab · signature tweak', 'LT / L2 · RT / R2'], ['Brake', 'X / □'], ['Pause · restart', 'Menu / Options · View / Share']],
  touch: [['Carve · release to point downhill', 'Hold ← or →'], ['Load up → ollie', 'Tap / hold POP → release'], ['Send an off-axis rotation', 'Tap CORK'], ['Send a flip · left/right 180', 'Tap FLIP · ↶ / ↷ 180'], ['Control your speed', 'Hold BRAKE'], ['Grab · signature tweak', 'Hold GRAB · Hold TWEAK'], ['Pause · laptop graphics', 'Tap Ⅱ at the top']],
};
function guideTab(tab) { for (const b of document.querySelectorAll('[data-guide]')) b.classList.toggle('selected', b.dataset.guide === tab); $('guide-content').innerHTML = guideData[tab].map(([action, button]) => `<div class="guide-row"><span>${action}</span><span>${button}</span></div>`).join(''); }
let guidePausedGame = false;
function openGuide() { if ($('guide').open) return; guidePausedGame = mode === 'playing'; if (guidePausedGame) { mode = 'guide'; keys.clear(); touch.clear(); actions.length = 0; run.queuedTrick = null; run.jumpBuffer = 0; run.wasPop = false; run.state.charge = 0; } guideTab(controller ? 'controller' : matchMedia('(pointer:coarse)').matches ? 'touch' : 'keyboard'); $('guide').showModal(); }
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

let graphicsChoice = 'auto', automaticLow = false, slowFrames = 0;
try { const saved = localStorage.getItem('sidecountry.graphics'); if (['auto', 'laptop', 'high'].includes(saved)) graphicsChoice = saved; } catch {}
$('graphics-select').value = graphicsChoice;
function applyGraphics() {
  if (!renderer) return;
  const low = graphicsChoice === 'laptop' || graphicsChoice === 'auto' && automaticLow;
  renderer.setPixelRatio(low ? .85 : Math.min(window.devicePixelRatio, graphicsChoice === 'high' ? 1.75 : 1.25));
  renderer.shadowMap.enabled = !low; resize();
}
$('graphics-select').addEventListener('change', event => { graphicsChoice = event.target.value; automaticLow = false; slowFrames = 0; try { localStorage.setItem('sidecountry.graphics', graphicsChoice); } catch {} applyGraphics(); });

let installPrompt;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install-app').hidden = false; });
$('install-app').addEventListener('click', async () => { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('install-app').hidden = true; });
window.addEventListener('appinstalled', () => { $('install-app').hidden = true; });

const trickKeys = { KeyQ: 'spinLeft', KeyE: 'spinRight', KeyF: 'flip', KeyC: 'cork' };
const gameKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyJ', 'KeyK', 'Space', 'ShiftLeft', 'ShiftRight', ...Object.keys(trickKeys)]);
window.addEventListener('keydown', event => {
  if (mode === 'playing' && gameKeys.has(event.code)) { event.preventDefault(); keys.add(event.code); }
  if (event.repeat) return;
  if (mode === 'playing' && trickKeys[event.code]) actions.push(trickKeys[event.code]);
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
for (const button of document.querySelectorAll('[data-trick]')) {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); if (mode === 'playing') actions.push(button.dataset.trick); button.classList.add('pressed'); });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => button.classList.remove('pressed'));
}

function readInput() {
  const pressed = (...codes) => codes.some(code => keys.has(code));
  let move = Number(pressed('ArrowRight', 'KeyD') || touch.has('right')) - Number(pressed('ArrowLeft', 'KeyA') || touch.has('left'));
  let pitch = Number(pressed('ArrowUp', 'KeyW')) - Number(pressed('ArrowDown', 'KeyS'));
  let pop = keys.has('Space') || touch.has('pop'), grab = keys.has('KeyJ') || touch.has('grab'), tweak = keys.has('KeyK') || touch.has('tweak'), brake = pressed('ShiftLeft', 'ShiftRight') || touch.has('brake');
  const pads = navigator.getGamepads?.() || [], gamepad = Array.from(pads).find(p => p && p.connected);
  if (gamepad) {
    if (!controller) { controller = true; if (mode === 'playing') announce('Controller connected. Right stick = flick to pop.'); }
    const axis = n => Math.abs(gamepad.axes[n] || 0) > .16 ? gamepad.axes[n] : 0, button = n => gamepad.buttons[n]?.pressed || false;
    if (mode === 'playing') { move = clamp(move + axis(0), -1, 1); pitch = clamp(pitch - axis(1), -1, 1); grab ||= button(6) || button(4); tweak ||= button(7) || button(5); brake ||= button(2);
      if (button(1) && !previousFlip) actions.push('flip');
      if (button(3) && !previousCork) actions.push('cork');
      if (axis(3) > .35) { stickCharged = true; controllerPop = true; }
      else if (stickCharged && axis(3) < -.25) { controllerPop = false; stickCharged = false; }
      if (stickCharged && axis(3) === 0 && !button(0)) { controllerPop = false; stickCharged = false; }
      pop ||= button(0) || controllerPop;
    }
    if (button(9) && !previousStart) { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); else if (mode === 'menu') startRun(); }
    if (button(8) && !previousBack && mode === 'playing') startRun();
    previousStart = button(9); previousBack = button(8); previousFlip = button(1); previousCork = button(3);
  } else { controller = false; previousStart = false; previousBack = false; previousFlip = false; previousCork = false; stickCharged = false; controllerPop = false; }
  return { move, pitch, pop, grab, tweak, brake, trick: mode === 'playing' ? actions.shift() : null };
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
  $('score').textContent = format(run.score); $('speed').textContent = Math.round(s.speed * 3.6); $('charge-fill').style.width = `${s.charge * 100}%`; $('charge-fill').parentElement.classList.toggle('charging', s.charge > 0); $('charge-label').textContent = s.rail ? 'RAIL LOCKED' : run.queuedTrick ? 'TRICK LOADED' : s.charge > .8 ? 'READY TO SEND' : 'POP POWER'; $('progress-fill').style.width = `${clamp((s.z - 34) / (RUN_LENGTH - 34) * 100, 0, 100)}%`;
  const bars = $('speed-bars').children; for (let i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i < s.speed / 34 * bars.length);
  if ($('ride-status')) $('ride-status').textContent = s.rail ? 'RAIL BALANCE' : !s.grounded ? s.catch ? 'CATCHING' : 'FLIGHT' : s.switch ? 'SWITCH' : s.grip < .6 ? 'SLIDING' : s.tuck > .1 ? 'TUCKING' : Math.abs(s.steer) > .15 ? 'CARVING' : 'GLIDING';
  if (s.rail) { $('charge-fill').style.width = `${(s.railBalance + 1) * 50}%`; $('charge-label').textContent = Math.abs(s.railBalance) < .3 ? 'BALANCED' : s.railBalance > 0 ? 'LEAN LEFT' : 'LEAN RIGHT'; }
  if (!s.grounded && !s.rail && s.bailTimer === 0) {
    const rotation = Math.round(Math.abs(s.spin) / Math.PI) * 180, flips = Math.round(Math.abs(s.flip) / (Math.PI * 2));
    const names = []; if (s.airTrickName) names.push(s.airTrickName); else { if (rotation) names.push(`${s.spin < 0 ? 'BS' : 'FS'} ${rotation}`); if (flips) names.push(s.flip > 0 ? 'Frontflip' : 'Backflip'); } if (s.grab && s.tweak) names.push(RIDERS[selectedRider].special); else if (s.grab) names.push(RIDERS[selectedRider].grab); else if (s.tweak) names.push(RIDERS[selectedRider].tweak);
    showTrick(s.catch ? 'CATCHING THE LANDING' : 'SEND IT · WE’LL HELP YOU CATCH IT', names.join(' + ') || 'Air time', `${(run.jumpAir).toFixed(1)}s${run.combo > 0 ? ` · ${format(run.combo)} in the line` : ''}`);
  } else if (animationTime > trickUntil) $('trick-display').style.opacity = .12;
  if (animationTime > announceUntil) $('announcement').classList.remove('visible');
}

const cameraTarget = new THREE.Vector3(), cameraLook = new THREE.Vector3(), lightTarget = new THREE.Vector3();
let cameraFollowHeading = 0;
function updateCamera(dt) {
  const s = run.state;
  if (mode === 'menu') {
    const orbit = Math.sin(animationTime * .13) * 2;
    cameraTarget.set(-2 + orbit, groundHeight(0, 34) + 7.8, 19); camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 2)); cameraLook.set(-5, groundHeight(0, 52) + 1, 60); camera.lookAt(cameraLook);
  } else {
    const delta = Math.atan2(Math.sin(s.travelHeading - cameraFollowHeading), Math.cos(s.travelHeading - cameraFollowHeading)); cameraFollowHeading += delta * (1 - Math.exp(-dt * 2.5));
    const dx = Math.sin(cameraFollowHeading), dz = Math.cos(cameraFollowHeading), distance = camera.aspect < 1 ? 6.4 : 5.6;
    cameraTarget.set(s.x - dx * distance + dz * .65, s.y + 2.6, s.z - dz * distance - dx * .65);
    cameraTarget.y = Math.max(cameraTarget.y, world.surface(cameraTarget.x, cameraTarget.z) + 1.6);
    camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 6)); cameraLook.set(s.x + dx * 5, s.y + .85, s.z + dz * 5);
    camera.fov += (60 + Math.min(s.speed * .2, 7) - camera.fov) * (1 - Math.exp(-dt * 2)); camera.updateProjectionMatrix();
    if (cameraShake > .005) { camera.position.x += (Math.random() - .5) * cameraShake; camera.position.y += (Math.random() - .5) * cameraShake * .5; cameraShake *= Math.exp(-dt * 10); }
    camera.lookAt(cameraLook);
  }
  lightTarget.set(s.x, groundHeight(s.x, s.z), s.z + 20); sun.position.set(s.x - 65, lightTarget.y + 100, s.z - 65); sun.target.position.copy(lightTarget); sun.target.updateMatrixWorld();
}

function frame() {
  requestAnimationFrame(frame); const frameDelta = clock.getDelta(), dt = Math.min(frameDelta, .1);
  const input = readInput();
  if (mode === 'paused' || mode === 'guide' || mode === 'results') { audio.update(0, false, false); return; }
  animationTime += dt;
  if (graphicsChoice === 'auto' && !automaticLow && animationTime > 3) { slowFrames = frameDelta > .045 ? slowFrames + 1 : Math.max(0, slowFrames - 1); if (slowFrames > 20) { automaticLow = true; applyGraphics(); } }
  if (mode === 'playing') {
    run.update(dt, input);
    if (run.state.grounded && run.state.bailTimer === 0) { world.track(run.state, RIDERS[selectedRider].type !== 'snowboard'); if (Math.random() < .55 + Math.abs(run.state.steer) * .3) world.emitSnow(run.state, Math.abs(run.state.steer) > .3 ? 3 : 1); }
    updateHud(dt);
  }
  if (mode === 'menu') { run.state.steer = Math.sin(animationTime * 1.4) * .08; run.state.charge = .12; }
  rider.update(run.state, animationTime); run.engine.updateRagdoll();
  world.update(mode === 'paused' || mode === 'guide' ? 0 : dt, run.state, animationTime); updateCamera(dt); audio.update(run.state.speed, mode === 'playing', !!run.state.rail);
  renderer.render(scene, camera);
}

try {
  renderer = new THREE.WebGLRenderer({ canvas: $('game-canvas'), antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xd4e0da, 120, 480); camera = new THREE.PerspectiveCamera(54, 1, .1, 1000);
  scene.add(new THREE.HemisphereLight(0xd1e6f1, 0xbab3a2, 1.9)); sun = new THREE.DirectionalLight(0xffdbb5, 2.3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -65; sun.shadow.camera.right = 65; sun.shadow.camera.top = 65; sun.shadow.camera.bottom = -65; sun.shadow.camera.near = 1; sun.shadow.camera.far = 280; sun.shadow.bias = -.0005; sun.shadow.normalBias = .035; scene.add(sun); scene.add(sun.target);
  await initPhysics(); world = new MountainWorld(scene); rider = new RiderModel(selectedRider); scene.add(rider.root); run = new MountainRun(world, RIDERS[selectedRider], handleEvent); const s = run.state; camera.position.set(-2, groundHeight(0, 34) + 7.8, 19); clock = new THREE.Clock(); resize();
  applyGraphics(); $('drop-in').disabled = false; $('drop-in').firstElementChild.textContent = 'Let’s ride'; frame();
} catch (error) {
  console.error('The mountain could not open:', error); $('load-error').hidden = false; $('drop-in').firstElementChild.textContent = 'Mountain unavailable';
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  const showOfflineReady = () => {
    const worker = navigator.serviceWorker.controller;
    if (worker && new URL(worker.scriptURL).searchParams.get('v') === '3') $('offline-status').textContent = 'READY FOR OFFLINE LAPS.';
  };
  navigator.serviceWorker.addEventListener('controllerchange', showOfflineReady);
  navigator.serviceWorker.register('./cache-worker.js?v=3', { scope: './' }).then(() => navigator.serviceWorker.ready).then(showOfflineReady).catch(() => { /* The game still runs online or on a local server. */ });
}

export { run, world, scene, camera, renderer, mode };
