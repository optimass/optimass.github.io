import * as THREE from './lib/three.module.js';
import { RUN_LENGTH } from './world.js?v=3';
import { SnowPhysics, PHYSICS_STEP, GRAVITY, surfaceNormal, surfaceOrientation } from './engine.js?v=3';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
const UP = new THREE.Vector3(0, 1, 0), FORWARD = new THREE.Vector3(0, 0, 1), RIGHT = new THREE.Vector3(1, 0, 0);

export class MountainRun {
  constructor(world, rider, event = () => {}) {
    this.world = world; this.rider = rider; this.event = event; this.engine = new SnowPhysics(world, rider); this.reset();
  }
  reset() {
    this.engine.reset(-6, 34);
    this.state = { x: -6, y: 0, z: 34, speed: 6, vx: 0, vy: 0, vz: 6, steer: 0, heading: 0, travelHeading: 0, spin: 0, flip: 0, charge: 0, grounded: true, grab: false, tweak: false, bailTimer: 0, rail: null, railBalance: 0, edge: 0, grip: 1, tuck: 0, compression: 0, switch: false, orientation: new THREE.Quaternion(), normal: surfaceNormal(this.world, -6, 34) };
    this.score = 0; this.combo = 0; this.multiplier = 1; this.bestCombo = 0; this.airTime = 0; this.bails = 0; this.elapsed = 0; this.finished = false;
    this.comboTimer = 0; this.wasPop = false; this.grabTime = 0; this.tweakTime = 0; this.railTime = 0; this.jumpAir = 0; this.maxSpin = 0; this.maxFlip = 0; this.lastTrick = ''; this.railCooldown = 0;
    this.accumulator = 0; this.launchLock = 0; this.targetHeading = 0; this.grindUpdate = 0;
    this.groundGrace = .12; this.jumpBuffer = 0; this.queuedTrick = null; this.actionTimer = 0; this.airTrick = null; this.airControlLatch = ''; this.airHeading = 0; this.completedSpin = 0; this.completedFlips = 0; this.completedCorks = 0; this.stallTime = 0;
    this.state.catch = false; this.state.airTrickName = '';
    this.airNormal = UP.clone(); this.airRight = RIGHT.clone(); this.safePoint = { x: -6, z: 34 }; this.safeTimer = 0; this.syncState();
  }
  syncState() {
    const s = this.state, p = this.engine.body.translation(), v = this.engine.body.linvel();
    s.x = p.x; s.y = p.y; s.z = p.z; s.vx = v.x; s.vy = v.y; s.vz = v.z; s.speed = Math.hypot(v.x, v.y, v.z); s.orientation.copy(this.engine.body.rotation());
    const forward = FORWARD.clone().applyQuaternion(s.orientation); s.heading = Math.atan2(forward.x, forward.z);
    if (Math.hypot(v.x, v.z) > .5) s.travelHeading = Math.atan2(v.x, v.z);
  }
  beginAir() {
    const s = this.state; s.grounded = false; s.spin = 0; s.flip = 0; this.jumpAir = 0; this.grabTime = 0; this.tweakTime = 0; this.maxSpin = 0; this.maxFlip = 0;
    this.airNormal.copy(s.normal); this.airRight.copy(RIGHT).applyQuaternion(s.orientation);
    this.airHeading = s.heading; this.airTrick = null; this.airControlLatch = ''; this.completedSpin = 0; this.completedFlips = 0; this.completedCorks = 0; s.airTrickName = ''; s.catch = false;
  }
  jump(power = this.state.charge) {
    const s = this.state; if ((!s.grounded && !s.rail && this.groundGrace <= 0) || s.bailTimer > 0) return;
    if (s.rail) this.leaveRail();
    this.beginAir(); this.launchLock = .14;
    // Even a tap has useful airtime; a held pop gives room for a complete rotation.
    this.engine.body.applyImpulse(s.normal.clone().multiplyScalar(this.rider.mass * (3 + clamp(power, 0, 1) * 1.1) * this.rider.pop), true);
    this.syncState();
    const trick = this.queuedTrick || (Math.abs(s.steer) > .25 ? s.steer > 0 ? 'spinRight' : 'spinLeft' : null);
    s.charge = 0; this.groundGrace = 0; this.jumpBuffer = 0; this.queuedTrick = null; this.actionTimer = 0; this.event('pop', { power, ramp: false });
    if (trick) this.startAirTrick(trick);
  }
  requestTrick(kind) {
    if (!['spinLeft', 'spinRight', 'flip', 'frontflip', 'cork'].includes(kind) || this.state.bailTimer > 0 || this.airTrick) return;
    if (this.state.grounded || this.groundGrace > 0 && this.timeToSnow() < .1) { this.queuedTrick = kind; this.actionTimer = this.state.grounded ? .13 : .02; }
    else this.startAirTrick(kind);
  }
  timeToSnow() {
    const s = this.state, com = this.engine.body.worldCom(), n = surfaceNormal(this.world, com.x, com.z);
    // Use centre of mass: the board origin rises and falls while the rider rotates.
    const height = Math.max(0, com.y - this.world.surface(com.x, com.z) - .73);
    const velocity = s.vy + (n.x * s.vx + n.z * s.vz) / Math.max(.3, n.y);
    return Math.max(0, (velocity + Math.sqrt(velocity * velocity + 2 * GRAVITY * height)) / GRAVITY);
  }
  startAirTrick(kind) {
    const spin = kind.startsWith('spin'), flip = kind === 'flip' || kind === 'frontflip';
    const remaining = this.timeToSnow(); if (this.airTrick || remaining < (spin ? .3 : .62)) return;
    const axis = spin ? this.airNormal.clone() : flip ? this.airRight.clone() : this.airNormal.clone().multiplyScalar(.72).addScaledVector(this.airRight, .57).addScaledVector(FORWARD.clone().applyQuaternion(this.state.orientation), .4).normalize();
    const angle = spin ? (kind === 'spinLeft' ? 1 : -1) * Math.PI : (kind === 'frontflip' ? 1 : -1) * Math.PI * 2;
    const duration = clamp(remaining - .2, .22, spin ? .5 : .72);
    this.airTrick = { kind, axis, angle, duration, elapsed: 0, actualAngle: 0, start: this.state.orientation.clone() };
    this.airControlLatch = spin ? kind : flip ? 'flip' : 'cork';
    this.state.airTrickName = spin ? '180' : flip ? kind === 'frontflip' ? 'Frontflip' : 'Backflip' : 'Cork 360';
  }
  trick(name, points) {
    this.combo += Math.round(points); this.lastTrick = name; this.comboTimer = 2.3;
    this.event('trick', { name, points: this.combo, multiplier: this.multiplier });
  }
  bank() {
    if (this.combo <= 0) return;
    const points = Math.round(this.combo * this.multiplier); this.score += points; this.bestCombo = Math.max(this.bestCombo, points);
    this.event('bank', { points, name: this.lastTrick, multiplier: this.multiplier }); this.combo = 0; this.multiplier = 1; this.comboTimer = 0;
  }
  bail(reason) {
    if (this.state.bailTimer > 0) return;
    this.bails++; this.state.bailTimer = 1.6; this.state.rail = null; this.state.charge = 0; this.state.grab = false; this.state.tweak = false;
    this.airTrick = null; this.queuedTrick = null; this.jumpBuffer = 0; this.state.airTrickName = ''; this.state.catch = false;
    this.combo = 0; this.multiplier = 1; this.comboTimer = 0; this.wasPop = false; this.engine.body.setAngularDamping(.3); this.event('bail', { reason });
  }
  land(normal, beforeVelocity) {
    const s = this.state, up = UP.clone().applyQuaternion(s.orientation), forward = FORWARD.clone().applyQuaternion(s.orientation);
    const impact = Math.max(0, -beforeVelocity.dot(normal));
    if (up.dot(normal) < .15) { this.bail('A little more room for that rotation.'); return; }
    if (impact > 14.5) { this.bail('That was a huge drop. Try a downslope.'); return; }
    s.switch = forward.dot(beforeVelocity) < 0; s.grounded = true; s.normal.copy(normal); s.compression = clamp(impact / 10, .1, 1);
    this.targetHeading = s.travelHeading + (s.switch ? Math.PI : 0);
    if (this.jumpAir > .22) {
      const rotation = this.completedCorks ? 0 : Math.max(Math.round(this.maxSpin / Math.PI) * 180, Math.abs(this.completedSpin) * 180), flips = this.completedCorks ? 0 : this.completedFlips, names = [];
      if (this.completedCorks) names.push(`Cork ${this.completedCorks * 360}`);
      if (rotation >= 180) names.push(`${this.completedSpin < 0 || !this.completedSpin && s.spin < 0 ? 'BS' : 'FS'} ${rotation}`);
      if (flips) names.push(s.flip > 0 ? 'Frontflip' : 'Backflip');
      if (this.grabTime > .12 && this.tweakTime > .12) names.push(this.rider.special);
      else if (this.grabTime > .12) names.push(this.rider.grab);
      else if (this.tweakTime > .12) names.push(this.rider.tweak);
      if (!names.length) names.push(this.jumpAir > 1.3 ? 'Straight air' : 'Ollie');
      if (s.switch) names.push('to switch');
      if (this.combo > 0) this.multiplier = Math.min(5, this.multiplier + .5);
      this.trick(names.join(' + '), 80 + rotation * 1.5 + flips * 850 + this.completedCorks * 1100 + (this.grabTime > .12 ? 230 : 0) + (this.tweakTime > .12 ? 280 : 0) + this.jumpAir * 60);
      this.event('land', { big: impact > 4, impact });
    }
    s.grab = false; s.tweak = false; s.catch = false; s.airTrickName = ''; this.airTrick = null;
  }
  leaveRail() {
    if (!this.state.rail) return;
    if (this.railTime > .12) {
      if (this.combo > 0) this.multiplier = Math.min(5, this.multiplier + .5);
      const cross = Math.abs(Math.sin(this.state.heading)) > .7;
      this.trick(this.rider.type === 'snowboard' ? (cross ? 'Boardslide' : '50–50') : 'Ski slide', 160 + this.railTime * 270);
    }
    this.state.rail = null; this.railCooldown = .35;
  }
  groundForces(dt, input) {
    const s = this.state, body = this.engine.body, mass = this.rider.mass, velocity = new THREE.Vector3().copy(body.linvel());
    const normal = s.normal, forward = FORWARD.clone().applyQuaternion(s.orientation); forward.addScaledVector(normal, -forward.dot(normal)).normalize();
    const right = new THREE.Vector3().crossVectors(normal, forward).normalize(), slip = velocity.dot(right), along = velocity.dot(forward);
    const brake = clamp(Math.max(-(input.pitch || 0), input.brake ? 1 : 0), 0, 1); s.tuck = Math.max(0, input.pitch || 0);
    const edgeGrip = this.rider.type === 'ski' ? .94 : this.rider.type === 'telemark' ? .83 : .8;
    // At walking speed the edges release, so gravity can slide a sideways board downhill.
    const gripAtSpeed = clamp(s.speed / 6, .08, 1);
    const lateralAcceleration = clamp(-slip * (2.5 + Math.abs(s.steer) * 2) * gripAtSpeed, -GRAVITY * edgeGrip, GRAVITY * edgeGrip);
    const force = right.multiplyScalar(mass * lateralAcceleration);
    if (Math.abs(along) > .15) force.addScaledVector(forward, -Math.sign(along) * mass * GRAVITY * (this.world.route === 'ridge' ? .045 : .018));
    if (s.speed > .1 && brake) force.addScaledVector(velocity.clone().normalize(), -mass * 5.5 * brake);
    body.addForce(force, true); s.grip = clamp(1 - Math.abs(slip) / 6, 0, 1);
    if (s.rail) {
      s.railBalance += (s.steer * 1.25 + (s.x - s.rail.x) * .7) * dt; s.railBalance *= Math.exp(-dt * .8);
      body.addForce({ x: -mass * clamp((s.x - s.rail.x) * 6 + velocity.x * 2, -3, 3), y: 0, z: 0 }, true);
      this.engine.orientTorque(surfaceOrientation(normal, this.targetHeading, s.railBalance * .2));
      if (Math.abs(s.railBalance) > 1.35) this.bail('Lost your balance on the rail.');
      return;
    }
    const fallHeading = Math.round(this.targetHeading / Math.PI) * Math.PI;
    const carveRate = s.steer * clamp(.55 + s.speed / 24, .55, 1.35) * this.rider.agility;
    this.targetHeading -= carveRate * dt * (s.charge > 0 ? .55 : 1);
    // Hold to carve, release to settle into the fall line. Never lock across the slope.
    this.targetHeading = clamp(this.targetHeading, fallHeading - 1.16, fallHeading + 1.16);
    if (Math.abs(input.move || 0) < .1 || s.speed < 2) {
      const centreBias = Math.abs(s.x) > 19 ? -Math.sign(s.x) * .35 : 0;
      this.targetHeading = damp(this.targetHeading, fallHeading + centreBias, s.speed < 2 ? 3.5 : 1.2, dt);
    }
    s.edge = damp(s.edge, s.steer * .16 * clamp(s.speed / 9, 0, 1), 6, dt);
    this.engine.orientTorque(surfaceOrientation(normal, this.targetHeading, s.edge), 24, 3.4, 22);
  }
  airForces(dt, input) {
    const s = this.state, body = this.engine.body, omega = new THREE.Vector3().copy(body.angvel());
    const yawRate = omega.dot(this.airNormal), flipRate = omega.dot(this.airRight);
    const control = Math.abs(input.pitch || 0) > .55 ? 'flip' : Math.abs(input.move || 0) > .3 ? input.move > 0 ? 'spinRight' : 'spinLeft' : '';
    if (!control) this.airControlLatch = '';
    if (control && control !== this.airControlLatch && !this.airTrick && !input.brake) { this.startAirTrick(input.pitch > 0 && control === 'flip' ? 'frontflip' : control); this.airControlLatch = control; }
    const remaining = this.timeToSnow(); s.catch = remaining < .24;
    if (this.airTrick) {
      const trick = this.airTrick; trick.elapsed += dt; trick.actualAngle += omega.dot(trick.axis) * dt;
      const p = clamp(trick.elapsed / trick.duration, 0, 1), phase = p * p * (3 - 2 * p);
      const target = new THREE.Quaternion().setFromAxisAngle(trick.axis, trick.angle * phase).multiply(trick.start);
      const targetOmega = trick.axis.clone().multiplyScalar(trick.angle * 6 * p * (1 - p) / trick.duration);
      // An orientation motor finishes the player's rotation; flight momentum is untouched.
      this.engine.orientTorque(target, 110, 3.5, 180, targetOmega);
      if (p === 1) {
        const forward = FORWARD.clone().applyQuaternion(target); this.airHeading = Math.atan2(forward.x, forward.z);
        // Credit the body rotation, rather than just the animation target's elapsed time.
        if (Math.abs(trick.actualAngle) >= Math.abs(trick.angle) * .85) {
          if (trick.kind.startsWith('spin')) this.completedSpin += Math.sign(trick.angle);
          else if (trick.kind === 'cork') this.completedCorks++;
          else this.completedFlips++;
        }
        this.airTrick = null;
      }
    } else {
      const futureNormal = surfaceNormal(this.world, s.x + s.vx * Math.min(remaining, .25), s.z + s.vz * Math.min(remaining, .25));
      const heading = s.travelHeading + (Math.cos(this.airHeading - s.travelHeading) < 0 ? Math.PI : 0);
      this.engine.orientTorque(surfaceOrientation(s.catch ? futureNormal : this.airNormal, heading), s.catch ? 100 : 45, 3.5, 120);
    }
    s.spin += yawRate * dt; s.flip += flipRate * dt; this.maxSpin = Math.max(this.maxSpin, Math.abs(s.spin)); this.maxFlip = Math.max(this.maxFlip, Math.abs(s.flip));
    s.grab = !!input.grab; s.tweak = !!input.tweak; if (s.grab) this.grabTime += dt; if (s.tweak) this.tweakTime += dt;
    this.jumpAir += dt; this.airTime += dt;
  }
  fixedUpdate(dt, input) {
    const s = this.state, body = this.engine.body; this.elapsed += dt;
    body.resetForces(true); body.resetTorques(true); this.railCooldown = Math.max(0, this.railCooldown - dt); this.launchLock = Math.max(0, this.launchLock - dt);
    this.groundGrace = Math.max(0, this.groundGrace - dt); this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (s.bailTimer > 0) {
      this.engine.step(); this.syncState(); s.bailTimer -= dt;
      if (s.bailTimer <= 0) {
        this.engine.reset(this.safePoint.x, this.safePoint.z, 5); body.setAngularDamping(.025); this.syncState();
        s.bailTimer = 0; s.grounded = true; s.spin = 0; s.flip = 0; s.edge = 0; s.normal.copy(surfaceNormal(this.world, s.x, s.z)); this.targetHeading = 0; this.launchLock = 0; this.groundGrace = .12; this.stallTime = 0; this.event('recover');
      }
      return;
    }
    s.steer = damp(s.steer, clamp(input.move || 0, -1, 1), 7, dt); s.compression = damp(s.compression, 0, 5, dt);
    if (input.pop && s.grounded) {
      s.charge = clamp(s.charge + dt * 1.3, 0, 1);
    }
    if (!input.pop && this.wasPop) this.jumpBuffer = .2;
    if (this.queuedTrick) {
      this.actionTimer -= dt; s.charge = Math.max(s.charge, .9);
      const ramp = this.world.rampAt?.(s.x, s.z);
      // On a kicker, let the loaded trick reach the lip instead of rotating into its face.
      const waitingForLip = ramp && s.vz > 1 && ramp.z + ramp.length - s.z > 1.1;
      if (this.actionTimer <= 0 && !waitingForLip && (s.grounded || this.groundGrace > 0)) this.jump(s.charge);
      else if (!s.grounded && this.groundGrace === 0 && !waitingForLip) { const trick = this.queuedTrick; this.queuedTrick = null; this.startAirTrick(trick); }
    } else if (this.jumpBuffer > 0 && (s.grounded || this.groundGrace > 0)) this.jump(s.charge);
    this.wasPop = !!input.pop;
    const wasGrounded = s.grounded, velocity = new THREE.Vector3().copy(body.linvel());
    this.engine.setPoseInertia(s.grounded ? 1 - s.charge * .3 : input.grab || input.tweak ? .65 : .95);
    const speed = velocity.length(), area = s.grounded && (input.pitch || 0) > 0 ? .38 : .72;
    if (speed > .1) body.addForce(velocity.clone().multiplyScalar(-.5 * .95 * area * speed), true);
    if (s.grounded) this.groundForces(dt, input); else this.airForces(dt, input);
    this.engine.step(); this.syncState(); const contact = this.engine.contact();
    const upright = UP.clone().applyQuaternion(s.orientation).dot(s.normal);
    if (contact.obstacle && s.speed > 3 || contact.person && upright < .1) { this.bail(contact.obstacle ? 'Try a little more space around that obstacle.' : 'A little more room for that rotation.'); return; }
    if (contact.supported && this.launchLock === 0) {
      s.normal.copy(contact.normal);
      if (!wasGrounded) this.land(contact.normal, velocity); else s.grounded = true;
      if (s.bailTimer > 0) return;
      this.groundGrace = .12;
      if (contact.rail && this.railCooldown === 0 && !s.rail) { s.rail = contact.rail; s.railBalance = clamp((s.x - s.rail.x) * 2, -.7, .7); this.railTime = 0; this.targetHeading = s.heading; this.event('rail'); }
    } else if (wasGrounded) { if (s.rail) this.leaveRail(); this.beginAir(); this.event('pop', { ramp: true, power: 0 }); }
    if (s.rail) {
      if (contact.rail !== s.rail) this.leaveRail();
      else { this.railTime += dt; this.grindUpdate += dt; if (this.grindUpdate > .08) { this.event('grind', { points: Math.round(this.railTime * 270) }); this.grindUpdate = 0; } }
    }
    const nearSnow = s.y < this.world.surface(s.x, s.z) + .45;
    const baseHeight = this.world.baseHeight || this.world.surface.bind(this.world);
    const hasDownhill = baseHeight(s.x, s.z - 1) - baseHeight(s.x, s.z + 1) > .025;
    if (hasDownhill && (s.grounded || nearSnow) && !s.rail && !input.brake && (input.pitch || 0) >= 0 && Math.hypot(s.vx, s.vz) < .8) this.stallTime += dt;
    else this.stallTime = 0;
    if (this.stallTime > 1.5) this.releaseStall();
    this.safeTimer += dt;
    if (s.grounded && !s.rail && this.safeTimer > .8 && Math.abs(s.x) < 85) { this.safePoint = { x: s.x, z: Math.max(34, s.z - 2) }; this.safeTimer = 0; }
    if (Math.abs(s.x) > 150 || s.z < -30 || s.y < this.world.surface(s.x, s.z) - 12) this.bail('Back to your last clean line.');
    if (this.combo > 0 && s.grounded && !s.rail) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.bank(); }
    if (s.z >= RUN_LENGTH) { if (s.rail) this.leaveRail(); this.bank(); this.finished = true; this.event('finish'); }
  }
  releaseStall() {
    // A low-speed snag gets a clear line, without counting as a wipeout or losing a combo.
    // Ordinary downhill acceleration still comes from Rapier gravity.
    let z = this.state.z + 5;
    for (const r of this.world.ramps || []) if (z >= r.z - 1 && z <= r.z + r.length + 4) z = r.z + r.length + 5;
    const candidates = [clamp(this.state.x, -16, 16), -6, 0, 6, -12, 12];
    const x = candidates.find(x => !(this.world.collisionTrees || []).some(t => Math.hypot(t.x - x, t.z - z) < 2.5) && !(this.world.collisionRocks || []).some(t => Math.hypot(t.x - x, t.z - z) < t.radius + 1.5)) ?? -6;
    this.engine.reset(x, z, 3); this.syncState(); this.state.grounded = true; this.state.normal.copy(surfaceNormal(this.world, x, z)); this.targetHeading = 0; this.stallTime = 0; this.groundGrace = .12; this.airTrick = null; this.event('unstuck');
  }
  update(dt, input = {}) {
    if (this.finished) return;
    if (input.trick) this.requestTrick(input.trick);
    this.accumulator += Math.min(dt, .1);
    while (this.accumulator + 1e-10 >= PHYSICS_STEP && !this.finished) { this.fixedUpdate(PHYSICS_STEP, input); this.accumulator -= PHYSICS_STEP; }
  }
  dispose() { this.engine.dispose(); }
}
