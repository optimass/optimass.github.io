import * as THREE from './lib/three.module.js';
import { RUN_LENGTH } from './world.js?v=2';
import { SnowPhysics, PHYSICS_STEP, GRAVITY, surfaceNormal, surfaceOrientation } from './engine.js?v=2';

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
    this.accumulator = 0; this.launchLock = 0; this.targetHeading = 0; this.preloadSpin = 0; this.preloadFlip = 0; this.grindUpdate = 0;
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
  }
  jump(power = this.state.charge) {
    const s = this.state; if ((!s.grounded && !s.rail) || s.bailTimer > 0) return;
    if (s.rail) this.leaveRail();
    this.beginAir(); this.launchLock = .14;
    // A human-sized pop adds 1.5–3.2 m/s. Ramp lift already comes from contact forces.
    this.engine.body.applyImpulse(s.normal.clone().multiplyScalar(this.rider.mass * (1.5 + clamp(power, 0, 1) * 1.7) * this.rider.pop), true);
    const omega = new THREE.Vector3().copy(this.engine.body.angvel()).addScaledVector(this.airNormal, this.preloadSpin).addScaledVector(this.airRight, this.preloadFlip);
    this.engine.body.setAngvel(omega, true); s.charge = 0; this.preloadSpin = 0; this.preloadFlip = 0; this.event('pop', { power, ramp: false });
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
    this.bails++; this.state.bailTimer = 2.8; this.state.rail = null; this.state.charge = 0; this.state.grab = false; this.state.tweak = false;
    this.combo = 0; this.multiplier = 1; this.comboTimer = 0; this.wasPop = false; this.engine.body.setAngularDamping(.3); this.event('bail', { reason });
  }
  land(normal, beforeVelocity) {
    const s = this.state, up = UP.clone().applyQuaternion(s.orientation), forward = FORWARD.clone().applyQuaternion(s.orientation);
    const impact = Math.max(0, -beforeVelocity.dot(normal)), tangent = beforeVelocity.clone().addScaledVector(normal, -beforeVelocity.dot(normal));
    const alignment = tangent.length() > 2 ? Math.abs(forward.clone().normalize().dot(tangent.normalize())) : 1;
    if (up.dot(normal) < .78) { this.bail('Get your feet under you before landing.'); return; }
    if (alignment < .72 && s.speed > 4) { this.bail('Caught an edge. Land along your momentum.'); return; }
    if (impact > 8.7 + s.charge * 1.5) { this.bail('Too much impact. Find a sloping landing.'); return; }
    if (Math.abs(this.engine.body.angvel().y) > 5) { this.bail('Check your rotation before touchdown.'); return; }
    s.switch = forward.dot(beforeVelocity) < 0; s.grounded = true; s.normal.copy(normal); s.compression = clamp(impact / 8, .1, 1); this.targetHeading = s.heading;
    if (this.jumpAir > .22) {
      const rotation = Math.round(this.maxSpin / Math.PI) * 180, flips = Math.floor((this.maxFlip + .45) / (Math.PI * 2)), names = [];
      if (rotation >= 180) names.push(`${s.spin < 0 ? 'BS' : 'FS'} ${rotation}`);
      if (flips) names.push(s.flip > 0 ? 'Frontflip' : 'Backflip');
      if (this.grabTime > .12 && this.tweakTime > .12) names.push(this.rider.special);
      else if (this.grabTime > .12) names.push(this.rider.grab);
      else if (this.tweakTime > .12) names.push(this.rider.tweak);
      if (!names.length) names.push(this.jumpAir > 1.3 ? 'Straight air' : 'Ollie');
      if (s.switch) names.push('to switch');
      if (this.combo > 0) this.multiplier = Math.min(5, this.multiplier + .5);
      this.trick(names.join(' + '), 80 + rotation * 1.5 + flips * 850 + (this.grabTime > .12 ? 230 : 0) + (this.tweakTime > .12 ? 280 : 0) + this.jumpAir * 60);
      this.event('land', { big: impact > 4, impact });
    }
    s.grab = false; s.tweak = false;
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
    const lateralAcceleration = clamp(-slip * (2.5 + Math.abs(s.steer) * 3), -GRAVITY * edgeGrip, GRAVITY * edgeGrip);
    const force = right.multiplyScalar(mass * lateralAcceleration);
    if (Math.abs(along) > .15) force.addScaledVector(forward, -Math.sign(along) * mass * GRAVITY * (this.world.route === 'ridge' ? .045 : .018));
    if (s.speed > .1 && brake) force.addScaledVector(velocity.clone().normalize(), -mass * 5.5 * brake);
    body.addForce(force, true); s.grip = clamp(1 - Math.abs(slip) / 6, 0, 1);
    if (s.rail) {
      s.railBalance += (s.steer * 1.25 + (s.x - s.rail.x) * .7) * dt; s.railBalance *= Math.exp(-dt * .8);
      body.addForce({ x: -mass * clamp((s.x - s.rail.x) * 6 + velocity.x * 2, -3, 3), y: 0, z: 0 }, true);
      this.engine.orientTorque(surfaceOrientation(normal, this.targetHeading, s.railBalance * .2));
      if (Math.abs(s.railBalance) > 1) this.bail('Lost your balance on the rail.');
      return;
    }
    const carveRate = s.steer * clamp(s.speed / (19 + s.speed * .3), .12, 1.1) * this.rider.agility;
    this.targetHeading -= carveRate * dt * (s.charge > 0 ? .35 : 1);
    s.edge = damp(s.edge, s.steer * .3 * clamp(s.speed / 9, 0, 1), 6, dt);
    this.engine.orientTorque(surfaceOrientation(normal, this.targetHeading, s.edge));
  }
  airForces(dt, input) {
    const s = this.state, body = this.engine.body, omega = new THREE.Vector3().copy(body.angvel());
    const yawRate = omega.dot(this.airNormal), flipRate = omega.dot(this.airRight), mass = this.rider.mass;
    // Posture-control torques check rotation; they never steer the flight path.
    const yaw = Math.abs(yawRate) > 8 && Math.sign(yawRate) === -Math.sign(input.move || 0) ? 0 : -(input.move || 0) * mass * .34;
    const pitch = Math.abs(flipRate) > 7 && Math.sign(flipRate) === Math.sign(input.pitch || 0) ? 0 : (input.pitch || 0) * mass * .48;
    const torque = this.airNormal.clone().multiplyScalar(yaw).addScaledVector(this.airRight, pitch);
    if (input.brake) torque.addScaledVector(omega, -mass * .035);
    body.addTorque(torque, true);
    s.spin += yawRate * dt; s.flip += flipRate * dt; this.maxSpin = Math.max(this.maxSpin, Math.abs(s.spin)); this.maxFlip = Math.max(this.maxFlip, Math.abs(s.flip));
    s.grab = !!input.grab; s.tweak = !!input.tweak; if (s.grab) this.grabTime += dt; if (s.tweak) this.tweakTime += dt;
    this.jumpAir += dt; this.airTime += dt;
  }
  fixedUpdate(dt, input) {
    const s = this.state, body = this.engine.body; this.elapsed += dt;
    body.resetForces(true); body.resetTorques(true); this.railCooldown = Math.max(0, this.railCooldown - dt); this.launchLock = Math.max(0, this.launchLock - dt);
    if (s.bailTimer > 0) {
      this.engine.step(); this.syncState(); s.bailTimer -= dt;
      if (s.bailTimer <= 0) {
        this.engine.reset(this.safePoint.x, this.safePoint.z, 4); body.setAngularDamping(.025); this.syncState();
        s.bailTimer = 0; s.grounded = true; s.spin = 0; s.flip = 0; s.edge = 0; s.normal.copy(surfaceNormal(this.world, s.x, s.z)); this.targetHeading = 0; this.launchLock = 0; this.event('recover');
      }
      return;
    }
    s.steer = damp(s.steer, clamp(input.move || 0, -1, 1), 7, dt); s.compression = damp(s.compression, 0, 5, dt);
    if (input.pop && s.grounded) {
      s.charge = clamp(s.charge + dt * 1.3, 0, 1);
      this.preloadSpin = damp(this.preloadSpin, -s.steer * (1.2 + s.charge * 3.3) * this.rider.spin, 6, dt);
      this.preloadFlip = damp(this.preloadFlip, (input.pitch || 0) * s.charge * 3.8, 5, dt);
    }
    if (!input.pop && this.wasPop && s.grounded) this.jump(s.charge);
    this.wasPop = !!input.pop;
    const wasGrounded = s.grounded, velocity = new THREE.Vector3().copy(body.linvel());
    this.engine.setPoseInertia(s.grounded ? 1 - s.charge * .3 : input.grab || input.tweak ? .65 : .95);
    const speed = velocity.length(), area = s.grounded && (input.pitch || 0) > 0 ? .38 : .72;
    if (speed > .1) body.addForce(velocity.clone().multiplyScalar(-.5 * .95 * area * speed), true);
    if (s.grounded) this.groundForces(dt, input); else this.airForces(dt, input);
    this.engine.step(); this.syncState(); const contact = this.engine.contact();
    if (contact.obstacle || contact.person) { this.bail(contact.obstacle ? 'A real collision. Pick a clean line.' : 'Keep your feet under you.'); return; }
    if (contact.supported && this.launchLock === 0) {
      s.normal.copy(contact.normal);
      if (!wasGrounded) this.land(contact.normal, velocity); else s.grounded = true;
      if (s.bailTimer > 0) return;
      if (contact.rail && this.railCooldown === 0 && !s.rail) { s.rail = contact.rail; s.railBalance = clamp((s.x - s.rail.x) * 2, -.7, .7); this.railTime = 0; this.targetHeading = s.heading; this.event('rail'); }
    } else if (wasGrounded) { if (s.rail) this.leaveRail(); this.beginAir(); this.event('pop', { ramp: true, power: 0 }); }
    if (s.rail) {
      if (contact.rail !== s.rail) this.leaveRail();
      else { this.railTime += dt; this.grindUpdate += dt; if (this.grindUpdate > .08) { this.event('grind', { points: Math.round(this.railTime * 270) }); this.grindUpdate = 0; } }
    }
    this.safeTimer += dt;
    if (s.grounded && !s.rail && this.safeTimer > .8 && Math.abs(s.x) < 85) { this.safePoint = { x: s.x, z: Math.max(34, s.z - 2) }; this.safeTimer = 0; }
    if (Math.abs(s.x) > 150 || s.z < -30 || s.y < this.world.surface(s.x, s.z) - 12) this.bail('Back to your last clean line.');
    if (this.combo > 0 && s.grounded && !s.rail) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.bank(); }
    if (s.z >= RUN_LENGTH) { if (s.rail) this.leaveRail(); this.bank(); this.finished = true; this.event('finish'); }
  }
  update(dt, input = {}) {
    if (this.finished) return;
    this.accumulator += Math.min(dt, .1);
    while (this.accumulator + 1e-10 >= PHYSICS_STEP && !this.finished) { this.fixedUpdate(PHYSICS_STEP, input); this.accumulator -= PHYSICS_STEP; }
  }
  dispose() { this.engine.dispose(); }
}
