import * as THREE from '../lib/three.module.js';
import { initPhysics, SnowPhysics, PHYSICS_STEP, GRAVITY } from '../engine.js?v=2';
import { MountainRun } from '../physics.js?v=2';
import { RIDERS } from '../riders.js?v=2';

const check = (condition, message) => { if (!condition) throw new Error(message); };
const fixture = grade => ({ surface: (x, z) => -grade * z, baseHeight: (x, z) => -grade * z, ramps: [], rails: [], obstacles: [], route: 'park' });
const tick = (run, seconds, input = {}, fps = 120) => { for (let i = 0; i < Math.round(seconds * fps); i++) run.update(1 / fps, input); };

export async function runPhysicsChecks() {
  await initPhysics(); const results = [];
  const test = (name, fn) => { fn(); results.push(name); };
  test('A flat run coasts down; a slope accelerates from gravity', () => {
    const flat = new MountainRun(fixture(0), RIDERS.massimo), hill = new MountainRun(fixture(.22), RIDERS.massimo);
    try { tick(flat, 4); tick(hill, 4); check(flat.state.speed < 5.5 && flat.bails === 0, 'Flat terrain must not invent cruising speed'); check(hill.state.speed > 9 && hill.bails === 0, 'A slope must accelerate without pushing'); }
    finally { flat.dispose(); hill.dispose(); }
  });
  test('Braking removes speed without resetting momentum', () => {
    const coast = new MountainRun(fixture(.22), RIDERS.jeece), brake = new MountainRun(fixture(.22), RIDERS.jeece);
    try { tick(coast, 2); tick(brake, 2); const before = brake.state.speed; tick(brake, .05, { brake: true }); check(brake.state.speed > before - 1, 'Braking must not instantly snap to a target speed'); tick(coast, 2); tick(brake, 2, { brake: true }); check(brake.state.speed < coast.state.speed * .6, 'Braking must dissipate energy'); }
    finally { coast.dispose(); brake.dispose(); }
  });
  test('30, 60, and 144 Hz rendering produce the same simulation', () => {
    const states = [30, 60, 144].map(fps => { const r = new MountainRun(fixture(.22), RIDERS.fred); try { tick(r, 4, { move: .12 }, fps); return [r.state.x, r.state.y, r.state.z, r.state.speed]; } finally { r.dispose(); } });
    for (const s of states.slice(1)) check(s.every((v, i) => Math.abs(v - states[0][i]) < .0001), `Frame-rate-dependent physics: ${JSON.stringify(states)}`);
  });
  test('An airborne rigid body follows Earth gravity', () => {
    const e = new SnowPhysics(fixture(0), RIDERS.benn);
    try { e.body.setTranslation({ x: 0, y: 20, z: 34 }, true); e.body.setLinvel({ x: 4, y: 0, z: 10 }, true); for (let i = 0; i < 60; i++) e.step(); const v = e.body.linvel(), p = e.body.translation(); check(Math.abs(v.y + GRAVITY * .5) < .015, `Incorrect free-fall velocity: ${v.y}`); check(Math.abs(p.x - 2) < .02 && Math.abs(p.z - 39) < .02, 'Momentum must carry the body through the air'); }
    finally { e.dispose(); }
  });
  test('Air rotation controls cannot redirect the centre of mass', () => {
    const flights = [0, 1].map(move => {
      const r = new MountainRun(fixture(0), RIDERS.massimo);
      try { r.engine.body.setTranslation({ x: 0, y: 15, z: 34 }, true); r.engine.body.setLinvel({ x: 0, y: 0, z: 9 }, true); r.syncState(); r.beginAir(); tick(r, .6, { move }); return { p: r.engine.body.worldCom(), q: r.engine.body.rotation(), spin: r.state.spin }; }
      finally { r.dispose(); }
    });
    check(Math.abs(flights[0].p.x - flights[1].p.x) < .001 && Math.abs(flights[0].p.z - flights[1].p.z) < .001, 'Air steering created lateral propulsion');
    check(Math.abs(flights[1].spin) > .1, 'Posture controls should still rotate the rider');
  });
  test('A charged ollie has a human-sized height and banks after a landing', () => {
    for (const id of Object.keys(RIDERS)) {
      const r = new MountainRun(fixture(0), RIDERS[id]);
      try { tick(r, .5); tick(r, .8, { pop: true }); const floor = r.state.y; r.update(PHYSICS_STEP, {}); let peak = r.state.y; for (let i = 0; i < 480; i++) { r.update(PHYSICS_STEP, {}); peak = Math.max(peak, r.state.y); } check(peak - floor > .25 && peak - floor < 1.1, `${id}: implausible ollie height ${peak - floor}`); check(r.bails === 0 && r.score > 0, `${id}: straight ollie should land and score`); }
      finally { r.dispose(); }
    }
  });
  test('Landing backwards preserves switch stance instead of snapping downhill', () => {
    const r = new MountainRun(fixture(0), RIDERS.massimo);
    try { r.engine.body.setTranslation({ x: -6, y: 1.2, z: 40 }, true); r.engine.body.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), true); r.engine.body.setLinvel({ x: 0, y: 0, z: 7 }, true); r.syncState(); r.beginAir(); tick(r, 1.5); const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(r.state.orientation); check(r.bails === 0 && r.state.switch && forward.z < -.9, 'A clean switch landing was snapped or rejected'); }
    finally { r.dispose(); }
  });
  test('A hard flat landing loses the pending combo', () => {
    const r = new MountainRun(fixture(0), RIDERS.massimo);
    try { r.engine.body.setTranslation({ x: -6, y: 7, z: 40 }, true); r.engine.body.setLinvel({ x: 0, y: 0, z: 5 }, true); r.syncState(); r.beginAir(); r.combo = 900; tick(r, 1.8); check(r.bails === 1 && r.combo === 0, 'A high-impact flat landing must wipe out and discard the combo'); }
    finally { r.dispose(); }
  });
  test('Rails require physical contact and do not pull in a nearby rider', () => {
    const railWorld = { ...fixture(0), rails: [{ x: -6, z: 41, length: 10, height: 1.1 }] };
    const on = new MountainRun(railWorld, RIDERS.massimo), beside = new MountainRun(railWorld, RIDERS.massimo);
    try {
      for (const [r, x] of [[on, -6], [beside, -5.2]]) { r.engine.body.setTranslation({ x, y: 1.8, z: 40 }, true); r.engine.body.setLinvel({ x: 0, y: -1, z: 5 }, true); r.syncState(); r.beginAir(); }
      tick(on, .6); tick(beside, .6); check(on.state.rail !== null, 'An aligned physical rail landing must enter a slide');
      check(beside.state.rail === null && Math.abs(beside.state.x + 5.2) < .05, 'The rail must not magnetise or teleport a nearby rider');
      // Allow the 10 m slide, descent, and 2.3 s clean-landing bank window to finish.
      tick(on, 6); check(on.bails === 0 && on.score > 300, 'A balanced rail slide must exit and bank points');
    } finally { on.dispose(); beside.dispose(); }
  });
  return results;
}
