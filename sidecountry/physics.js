import { RUN_LENGTH, groundHeight } from './world.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const damp = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
const angleDistance = (angle, step) => Math.abs(angle - Math.round(angle / step) * step);

export class MountainRun {
  constructor(world, rider, event = () => {}) { this.world = world; this.rider = rider; this.event = event; this.reset(); }

  reset() {
    this.state = { x: -6, y: this.world.surface(-6, 34), z: 34, speed: 13, vx: 0, vy: 0, steer: 0, heading: 0, spin: 0, flip: 0, charge: 0, grounded: true, grab: false, tweak: false, bailTimer: 0, rail: null };
    this.score = 0; this.combo = 0; this.multiplier = 1; this.bestCombo = 0; this.airTime = 0; this.bails = 0; this.elapsed = 0; this.finished = false;
    this.comboTimer = 0; this.wasPop = false; this.grabTime = 0; this.tweakTime = 0; this.railTime = 0; this.jumpAir = 0; this.maxSpin = 0; this.maxFlip = 0; this.lastTrick = ''; this.railCooldown = 0;
  }

  jump(power = 0, ramp = false) {
    const s = this.state;
    if (!s.grounded && !s.rail || s.bailTimer > 0) return;
    if (s.rail) this.leaveRail();
    s.grounded = false; s.vy = (ramp ? 10.6 + power * 4 : 6.8 + power * 5.7) * this.rider.pop; s.y += .045; s.charge = 0;
    this.grabTime = 0; this.tweakTime = 0; this.jumpAir = 0; this.maxSpin = 0; this.maxFlip = 0; s.spin = 0; s.flip = 0;
    this.event('pop', { power, ramp });
  }

  trick(name, points) {
    this.combo += Math.round(points); this.lastTrick = name; this.comboTimer = 2.15;
    this.event('trick', { name, points: this.combo, multiplier: this.multiplier });
  }

  bank() {
    if (this.combo <= 0) return;
    const points = Math.round(this.combo * this.multiplier); this.score += points; this.bestCombo = Math.max(this.bestCombo, points);
    this.event('bank', { points, name: this.lastTrick, multiplier: this.multiplier }); this.combo = 0; this.multiplier = 1; this.comboTimer = 0;
  }

  bail(reason) {
    if (this.state.bailTimer > 0) return;
    const s = this.state; this.bails++; s.bailTimer = 1.65; s.rail = null; s.charge = 0; s.vy = 0; s.grab = false; s.tweak = false;
    this.combo = 0; this.multiplier = 1; this.comboTimer = 0; this.wasPop = false; this.event('bail', { reason });
  }

  land() {
    const s = this.state;
    if (angleDistance(s.spin, Math.PI) > .64 || angleDistance(s.flip, Math.PI * 2) > .65) { this.bail('Line it up before landing.'); return; }
    const rotation = Math.round(Math.abs(s.spin) / Math.PI) * 180, flips = Math.round(Math.abs(s.flip) / (Math.PI * 2));
    const names = [], direction = s.spin < 0 ? 'BS' : 'FS';
    if (rotation >= 180) names.push(`${direction} ${rotation}`);
    if (flips) names.push(s.flip > 0 ? 'Frontflip' : 'Backflip');
    if (this.grabTime > .12 && this.tweakTime > .12) names.push(this.rider.special);
    else if (this.grabTime > .12) names.push(this.rider.grab);
    else if (this.tweakTime > .12) names.push(this.rider.tweak);
    if (!names.length) names.push(this.jumpAir > 1.4 ? 'Big air' : 'Ollie');
    const points = 90 + rotation * 1.65 + flips * 850 + (this.grabTime > .12 ? 230 : 0) + (this.tweakTime > .12 ? 280 : 0) + Math.floor(this.jumpAir * 50);
    if (this.combo > 0) this.multiplier = Math.min(5, this.multiplier + .5);
    this.trick(names.join(' + '), points); this.event('land', { big: this.jumpAir > 1.4 });
    s.grounded = true; s.spin = 0; s.flip = 0; s.vy = 0; s.grab = false; s.tweak = false;
  }

  leaveRail() {
    if (!this.state.rail) return;
    if (this.railTime > .1) { if (this.combo > 0) this.multiplier = Math.min(5, this.multiplier + .5); this.trick(`${this.rider.type === 'snowboard' ? 'Boardslide' : 'Ski slide'}${this.railTime > .6 ? ' · butter smooth' : ''}`, 160 + this.railTime * 260); }
    this.state.rail = null; this.state.spin = 0; this.state.grounded = true; this.railCooldown = .6;
  }

  update(dt, input) {
    if (this.finished) return;
    const s = this.state; this.elapsed += dt; this.railCooldown = Math.max(0, this.railCooldown - dt);
    if (s.bailTimer > 0) {
      s.bailTimer -= dt; s.z += s.speed * dt * .2; s.y = groundHeight(s.x, s.z); s.speed = damp(s.speed, 7, 2, dt);
      if (s.bailTimer <= 0) { s.bailTimer = 0; s.x = clamp(s.x, -20, 20); if (this.world.obstacles.some(o => Math.hypot(s.x - o.x, s.z - o.z) < 3)) s.x += s.x > 0 ? -4 : 4; s.vx = 0; s.spin = 0; s.flip = 0; s.heading = 0; s.grounded = true; s.y = this.world.surface(s.x, s.z); this.event('recover'); }
      return;
    }
    const move = clamp(input.move || 0, -1, 1), pitch = clamp(input.pitch || 0, -1, 1);
    s.steer = damp(s.steer, move, 9, dt);
    if (input.pop && (s.grounded || s.rail)) s.charge = clamp(s.charge + dt * 1.25, 0, 1);
    if (!input.pop && this.wasPop && (s.grounded || s.rail)) this.jump(s.charge);
    this.wasPop = !!input.pop;
    const target = pitch < -.15 && s.grounded ? 7 : pitch > .15 && s.grounded ? 34 : 24;
    s.speed = damp(s.speed, target - Math.abs(s.steer) * 3.7, .6, dt);
    const oldZ = s.z, oldRamp = s.grounded ? this.world.rampAt(s.x, s.z) : null;
    s.z += s.speed * dt;
    if (s.rail) {
      const rail = s.rail; s.x = damp(s.x, rail.x, 20, dt); s.y = groundHeight(rail.x, s.z) + rail.height + .14; s.spin = this.rider.type === 'snowboard' ? Math.PI / 2 : 0; this.railTime += dt;
      this.event('grind', { points: Math.round(this.railTime * 260) });
      if (s.z > rail.z + rail.length || Math.abs(move) > .72 && this.railTime > .45) { this.leaveRail(); s.grounded = false; s.vy = 2; this.jumpAir = 0; this.grabTime = 0; this.tweakTime = 0; }
    } else {
      s.vx = damp(s.vx, -s.steer * s.speed * (s.grounded ? .55 : .38) * this.rider.agility, s.grounded ? 5 : 1.8, dt); s.x += s.vx * dt;
      s.heading = damp(s.heading, Math.atan2(s.vx, s.speed) * .9, 9, dt);
      if (s.grounded) {
        s.y = this.world.surface(s.x, s.z);
        if (oldRamp && oldZ <= oldRamp.z + oldRamp.length && s.z > oldRamp.z + oldRamp.length) { s.y = groundHeight(s.x, s.z) + oldRamp.height; this.jump(s.charge, true); }
      } else {
        s.grab = !!input.grab; s.tweak = !!input.tweak; this.jumpAir += dt; this.airTime += dt;
        if (s.grab) this.grabTime += dt; if (s.tweak) this.tweakTime += dt;
        if (Math.abs(move) > .1) s.spin += move * (s.grab ? 3.65 : 4.35) * this.rider.spin * dt;
        else s.spin = damp(s.spin, Math.round(s.spin / Math.PI) * Math.PI, 6, dt);
        if (Math.abs(pitch) > .15) s.flip += pitch * 4.35 * dt;
        else s.flip = damp(s.flip, Math.round(s.flip / (Math.PI * 2)) * Math.PI * 2, 6, dt);
        this.maxSpin = Math.max(this.maxSpin, Math.abs(s.spin)); this.maxFlip = Math.max(this.maxFlip, Math.abs(s.flip));
        s.vy -= 14 * dt; s.y += s.vy * dt;
        const surface = this.world.surface(s.x, s.z);
        const rail = this.railCooldown === 0 && this.world.rails.find(r => Math.abs(s.x - r.x) < .65 && s.z >= r.z - .7 && s.z <= r.z + r.length && s.vy < 1 && s.y >= groundHeight(r.x, s.z) + .9 && s.y <= groundHeight(r.x, s.z) + 1.6);
        if (rail && angleDistance(s.flip, Math.PI * 2) < .6) { s.rail = rail; s.grounded = false; s.vy = 0; s.charge = 0; this.railTime = 0; this.event('rail'); }
        else if (s.y <= surface && s.vy < 0) { s.y = surface; this.land(); }
      }
    }
    if (Math.abs(s.x) > 35) { s.x = clamp(s.x, -35, 35); this.bail('A little too far off piste.'); }
    if (s.grounded && this.world.obstacles.some(o => Math.abs(o.z - s.z) < 1 && Math.abs(o.x - s.x) < o.radius + .22)) this.bail('Trees don’t move. You do.');
    if (this.combo > 0 && s.grounded && !s.rail) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.bank(); }
    if (s.z >= RUN_LENGTH) { if (s.rail) this.leaveRail(); this.bank(); this.finished = true; this.event('finish'); }
  }
}
