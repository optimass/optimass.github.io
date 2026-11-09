import RAPIER from './lib/rapier.es.js';
import * as THREE from './lib/three.module.js';

export const PHYSICS_STEP = 1 / 120;
export const GRAVITY = 9.81;
let initialization;
export const initPhysics = () => initialization ||= RAPIER.init();
const UP = new THREE.Vector3(0, 1, 0);
const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

export function surfaceNormal(surface, x, z) {
  if (surface.normalAt) return surface.normalAt(x, z);
  const e = .1;
  return new THREE.Vector3(-(surface.surface(x + e, z) - surface.surface(x - e, z)) / (2 * e), 1, -(surface.surface(x, z + e) - surface.surface(x, z - e)) / (2 * e)).normalize();
}

export function surfaceOrientation(normal, heading = 0, edge = 0) {
  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  forward.addScaledVector(normal, -forward.dot(normal)).normalize();
  const right = new THREE.Vector3().crossVectors(normal, forward).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, normal, forward));
  if (edge) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), edge));
  return q;
}

// Metres, seconds, kilograms. Rapier resolves gravity, contacts, CCD, and rotation.
// Snow-specific forces are applied by MountainRun; they never move the body directly.
export class SnowPhysics {
  constructor(surface, rider) {
    this.surface = surface; this.rider = rider;
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = PHYSICS_STEP; this.world.numSolverIterations = 6;
    this.kinds = new Map(); this.ragdoll = []; this.poseInertia = 1;
    this.buildEnvironment(); this.createRider();
  }

  staticCollider(desc, kind, data = null) {
    const c = this.world.createCollider(desc.setFriction(.45).setRestitution(0).setCollisionGroups(0x0001ffff));
    this.kinds.set(c.handle, { kind, data }); return c;
  }

  buildEnvironment() {
    if (this.surface.terrain) {
      const g = this.surface.terrain.geometry;
      this.staticCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(g.attributes.position.array), new Uint32Array(g.index.array), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES), 'snow');
    } else {
      // Small analytic fixtures use the same collision path as the actual mountain.
      const points = [], indices = [], steps = 80, size = 160;
      for (let z = 0; z <= steps; z++) for (let x = 0; x <= steps; x++) {
        const xx = -size / 2 + x * size / steps, zz = -40 + z * size / steps;
        points.push(xx, this.surface.surface(xx, zz), zz);
        if (x < steps && z < steps) { const a = z * (steps + 1) + x, b = a + steps + 1; indices.push(a, b, a + 1, a + 1, b, b + 1); }
      }
      this.staticCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(points), new Uint32Array(indices), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES), 'snow');
    }
    for (const ramp of [...(this.surface.ramps || []), ...(this.surface.landings || [])]) {
      const g = ramp.geometry;
      if (g) this.staticCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(g.attributes.position.array), new Uint32Array(g.index.array), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES), 'snow', ramp);
    }
    for (const tree of this.surface.collisionTrees || []) this.staticCollider(RAPIER.ColliderDesc.cylinder(tree.h / 2, tree.radius).setTranslation(tree.x, tree.y + tree.h / 2, tree.z), 'obstacle');
    for (const rock of this.surface.collisionRocks || []) this.staticCollider(RAPIER.ColliderDesc.ball(rock.radius).setTranslation(rock.x, rock.y, rock.z), 'obstacle');
    for (const rail of this.surface.rails || []) {
      const y0 = this.surface.baseHeight(rail.x, rail.z), y1 = this.surface.baseHeight(rail.x, rail.z + rail.length), slope = (y1 - y0) / rail.length;
      rail.y0 = y0 + rail.height; rail.slope = slope;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.atan(slope));
      this.staticCollider(RAPIER.ColliderDesc.cuboid(.19, .11, Math.hypot(rail.length, y1 - y0) / 2).setTranslation(rail.x, (y0 + y1) / 2 + rail.height, rail.z + rail.length / 2).setRotation(q), 'rail', rail).setFriction(.065);
      for (const t of [0, .5, 1]) this.staticCollider(RAPIER.ColliderDesc.cuboid(.065, rail.height / 2, .065).setTranslation(rail.x, y0 + (y1 - y0) * t + rail.height / 2, rail.z + t * rail.length), 'obstacle');
    }
  }

  createRider() {
    const r = this.rider, mass = r.mass || 75;
    this.body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCanSleep(false).setCcdEnabled(true).setAdditionalMassProperties(mass, { x: 0, y: .68, z: 0 }, { x: mass * .23, y: mass * .12, z: mass * .2 }, IDENTITY).setAngularDamping(.025));
    const boardPoints = [], halfLength = (r.boardLength || 1.7) / 2, width = r.type === 'snowboard' ? .155 : .245;
    // Upturned tips ride over seams and snow features instead of tripping a square nose.
    for (const z of [-halfLength, -halfLength * .68, halfLength * .68, halfLength]) for (const x of [-width, width]) for (const y of [-.035, .035]) boardPoints.push(x, y + (Math.abs(z) === halfLength ? .1 : 0), z);
    this.board = this.world.createCollider(RAPIER.ColliderDesc.convexHull(new Float32Array(boardPoints)).setDensity(0).setFriction(.025).setRestitution(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setContactSkin(.01).setCollisionGroups(0x00020001), this.body);
    this.person = this.world.createCollider(RAPIER.ColliderDesc.capsule(.35, .17).setTranslation(0, .79, 0).setDensity(0).setFriction(.65).setCollisionGroups(0x00020001), this.body);
    this.reset(-6, 34);
  }

  reset(x, z, speed = 6) {
    this.clearRagdoll(); this.person.setEnabled(true); this.setPoseInertia(1, true);
    const n = surfaceNormal(this.surface, x, z), q = surfaceOrientation(n), direction = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    this.body.setTranslation({ x, y: this.surface.surface(x, z) + .075, z }, true); this.body.setRotation(q, true);
    this.body.setLinvel(direction.multiplyScalar(speed), true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.resetForces(true); this.body.resetTorques(true);
  }

  setPoseInertia(factor, force = false) {
    if (!force && Math.abs(factor - this.poseInertia) < .01) return;
    const old = this.poseInertia, mass = this.rider.mass || 75, velocity = this.body.angvel();
    this.body.setAdditionalMassProperties(mass, { x: 0, y: .68, z: 0 }, { x: mass * .23 * factor, y: mass * .12 * factor, z: mass * .2 * factor }, IDENTITY, true);
    this.body.recomputeMassPropertiesFromColliders(); this.poseInertia = factor;
    // Pulling in the limbs reduces inertia; preserve angular momentum.
    if (!force) this.body.setAngvel({ x: velocity.x * old / factor, y: velocity.y * old / factor, z: velocity.z * old / factor }, true);
  }

  contact() {
    const result = { supported: false, normal: null, rail: null, obstacle: false, person: false };
    for (const [part, isPerson] of [[this.board, false], [this.person, true]]) this.world.contactPairsWith(part, other => {
      const tag = this.kinds.get(other.handle); if (!tag) return;
      this.world.contactPair(part, other, manifold => {
        if (!manifold.numSolverContacts()) return;
        let touching = false;
        for (let i = 0; i < manifold.numSolverContacts(); i++) if (manifold.solverContactDist(i) < .035) touching = true;
        if (!touching) return;
        if (isPerson) { result.person = true; return; }
        if (tag.kind === 'obstacle') result.obstacle = true;
        else {
          const n = new THREE.Vector3().copy(manifold.normal()); if (n.y < 0) n.negate();
          if (n.y > .4) { result.supported = true; result.normal = n; if (tag.kind === 'rail') result.rail = tag.data; }
        }
      });
    });
    return result;
  }

  orientTorque(target, stiffness = 18, damping = 3.2) {
    const current = new THREE.Quaternion().copy(this.body.rotation()), error = target.clone().multiply(current.invert());
    if (error.w < 0) error.set(-error.x, -error.y, -error.z, -error.w);
    const omega = this.body.angvel(), mass = this.rider.mass || 75;
    const torque = new THREE.Vector3(error.x, error.y, error.z).multiplyScalar(2 * mass * stiffness).addScaledVector(omega, -mass * damping);
    torque.clampLength(0, mass * 12); this.body.addTorque(torque, true);
  }

  step() { this.world.step(); }

  createRagdoll(parts, parent) {
    this.clearRagdoll(); this.person.setEnabled(false);
    const velocity = this.body.linvel(), omega = this.body.angvel(), lookup = new Map();
    for (const part of parts) {
      const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(); part.object.matrixWorld.decompose(position, rotation, scale);
      const object = part.object.clone(true); object.position.copy(position); object.quaternion.copy(rotation); object.scale.copy(scale); parent.add(object);
      const rb = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(...position.toArray()).setRotation(rotation).setLinvel(velocity.x, velocity.y, velocity.z).setAngvel(omega).setCcdEnabled(true).setLinearDamping(.12).setAngularDamping(.25));
      const radius = part.radius * scale.y, length = part.length * scale.y;
      this.world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(.001, length / 2 - radius), radius).setMass(part.fraction * this.rider.mass).setFriction(.6).setCollisionGroups(0x00040001), rb);
      const item = { rb, object, part, position, rotation }; this.ragdoll.push(item); lookup.set(part.name, item);
    }
    for (const item of this.ragdoll) {
      const p = lookup.get(item.part.parent); if (!p) continue;
      const anchor = item.part.anchor.clone(), a = anchor.clone().sub(p.position).applyQuaternion(p.rotation.clone().invert()), b = anchor.sub(item.position).applyQuaternion(item.rotation.clone().invert());
      this.world.createImpulseJoint(RAPIER.JointData.spherical(a, b), p.rb, item.rb, true);
    }
    // The detached board now carries equipment mass, rather than the rider's mass.
    this.body.setAdditionalMassProperties(4, { x: 0, y: .02, z: 0 }, { x: 1, y: 1, z: .15 }, IDENTITY, true); this.body.recomputeMassPropertiesFromColliders();
  }

  updateRagdoll() { for (const item of this.ragdoll) { item.object.position.copy(item.rb.translation()); item.object.quaternion.copy(item.rb.rotation()); } }
  clearRagdoll() { for (const item of this.ragdoll) { item.object.removeFromParent(); this.world.removeRigidBody(item.rb); } this.ragdoll.length = 0; }
  dispose() { this.clearRagdoll(); this.world.free(); }
}
