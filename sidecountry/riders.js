import * as THREE from './lib/three.module.js';

export const RIDERS = {
  massimo: { name: 'Massimo', type: 'snowboard', mass: 58, boardLength: 1.5, color: 0xcadf77, pants: 0x354a39, helmet: 0x34473a, skin: '#bd8b68', height: 1.58, pop: 1.09, spin: 1.12, agility: 1.15, motto: 'LOW CENTER. HIGH STYLE.', grab: 'Indy grab', tweak: 'Stalefish', special: 'Steazy method' },
  benn: { name: 'Benn', type: 'snowboard', mass: 78, boardLength: 1.7, color: 0xb58bba, pants: 0x354245, helmet: 0xe9dbca, skin: '#d2a481', height: 1.96, pop: 1.01, spin: .96, agility: .96, motto: 'LONG LIMBS. LONGER LINES.', grab: 'Melon grab', tweak: 'Nosebone', special: 'Lanky method' },
  jeece: { name: 'Jeece', type: 'ski', mass: 82, boardLength: 1.82, color: 0x466b91, pants: 0x293c53, helmet: 0x2c4054, skin: '#c59471', height: 1.8, pop: 1, spin: 1.02, agility: 1.08, motto: 'OFF DUTY. ON EDGE.', grab: 'Safety grab', tweak: 'Daffy', special: 'The law & order' },
  fred: { name: 'Fred B', type: 'telemark', mass: 80, boardLength: 1.88, color: 0xdc724b, pants: 0x564b40, helmet: 0xe3bd53, skin: '#cfa07c', height: 1.78, pop: 1.04, spin: .98, agility: 1.04, motto: 'FREE THE HEEL. FEEL THE TURN.', grab: 'Tail grab', tweak: 'Tele cross', special: 'Free-heel flair' },
};

export function portrait(id) {
  const r = RIDERS[id], color = `#${r.color.toString(16).padStart(6, '0')}`, helmet = `#${r.helmet.toString(16).padStart(6, '0')}`;
  const body = id === 'benn' ? 'M28 96V67Q30 53 50 53T72 67V96' : 'M20 96V73Q22 55 50 55T80 73V96';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="97" rx="41" ry="6" fill="#2b4037" opacity=".07"/><path d="${body}" fill="${color}"/><path d="M48 58v37" stroke="#263c33" stroke-width="1.4" opacity=".35"/><path d="M33 62 44 69l6-11 7 11 12-7" fill="#263c33" opacity=".16"/><rect x="42" y="47" width="16" height="13" rx="5" fill="${r.skin}"/><ellipse cx="50" cy="35" rx="20" ry="23" fill="${r.skin}"/><path d="M29 33V27a21 21 0 0 1 42 0v6H29" fill="${helmet}"/><path d="M32 15q18-14 35 0" fill="none" stroke="#fff" stroke-width="2.5" opacity=".22"/><rect x="27" y="30" width="46" height="14" rx="6" fill="#344541"/><rect x="31" y="32" width="38" height="9" rx="4" fill="#d6bda0"/><path d="m37 33 12 7h6l-12-7" fill="#fff" opacity=".7"/><path d="M46 50q4 3 8 0" fill="none" stroke="#754d3b" stroke-width="1.3" stroke-linecap="round"/>${id === 'jeece' ? '<path d="m64 67 5 2v7l-5 3-5-3v-7Z" fill="#e5c868"/><path d="m64 70 1 2 2 .3-1.5 1.5.4 2-1.9-1-1.9 1 .4-2-1.5-1.5 2-.3Z" fill="#3d5677"/>' : ''}${id === 'fred' ? '<path d="M24 77h53v5H24" fill="#e8dc87"/><path d="M23 76h54v2H23" fill="#9b6d43"/><path d="M39 18h22v8H39" fill="#263c33" opacity=".35"/><path d="m50 19 4 5h-8Z" fill="#efdfb0"/>' : ''}</svg>`;
}

const material = color => new THREE.MeshStandardMaterial({ color, roughness: .79 });
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function limb(length, radius, mat) {
  const group = new THREE.Group(), joint = new THREE.Group(), upper = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(.04, length / 2 - radius * 2), 4, 8), mat), lower = upper.clone();
  upper.position.y = -length / 4; lower.position.y = -length / 4; upper.castShadow = lower.castShadow = true;
  joint.position.y = -length / 2; joint.add(lower); group.add(upper, joint); group.userData = { joint, upper, lower, length, radius }; return group;
}

export class RiderModel {
  constructor(id) {
    this.id = id; this.info = RIDERS[id]; this.root = new THREE.Group();
    this.spinGroup = new THREE.Group(); this.root.add(this.spinGroup);
    const r = this.info, jacket = material(r.color), pants = material(r.pants), helmet = material(r.helmet), skin = material(r.skin), dark = material(0x253834), boot = material(0x273633), scale = r.height / 1.76;
    this.body = new THREE.Group(); this.body.scale.set(scale * (id === 'benn' ? .8 : 1), scale, scale * (id === 'benn' ? .9 : 1)); this.spinGroup.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = .7; this.body.add(this.hips);
    this.torso = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .22, 5, 12), jacket); this.torso.scale.z = .72; this.torso.position.y = .29; this.torso.castShadow = true; this.hips.add(this.torso);
    this.torso.add(box(.025, .45, .025, dark, 0, 0, .23)); this.torso.add(box(.34, .15, .3, pants, 0, -.28));
    this.headGroup = new THREE.Group(); this.headGroup.position.y = .76; this.hips.add(this.headGroup);
    this.head = new THREE.Mesh(new THREE.SphereGeometry(.195, 16, 12), skin); this.head.scale.set(.87, 1.06, .9); this.head.castShadow = true; this.headGroup.add(this.head);
    const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(.216, 16, 10, 0, Math.PI * 2, 0, Math.PI * .62), helmet); helmetMesh.position.y = .055; helmetMesh.castShadow = true; this.headGroup.add(helmetMesh);
    this.headGroup.add(box(.34, .095, .065, material(0xcfae83), 0, .025, .17)); this.headGroup.add(box(.36, .026, .1, dark, 0, .09, .15));
    const shoulderL = new THREE.Group(), shoulderR = new THREE.Group(); shoulderL.position.set(-.28, .46, 0); shoulderR.position.set(.28, .46, 0); this.hips.add(shoulderL, shoulderR);
    this.arms = [shoulderL, shoulderR];
    this.armBones = [];
    for (const [i, shoulder] of this.arms.entries()) { const arm = limb(.59, .073, jacket); shoulder.add(arm); arm.userData.lower.add(box(.105, .12, .1, dark, 0, -.15)); shoulder.rotation.z = i ? .22 : -.22; this.armBones.push(arm); }
    this.legs = [];
    for (let i = 0; i < 2; i++) { const leg = limb(.68, .09, pants); leg.position.set(i ? .16 : -.16, -.015, 0); this.hips.add(leg); const foot = box(.14, .14, .27, boot, 0, -.17, .04); leg.userData.lower.add(foot); this.legs.push(leg); }
    this.equipment = new THREE.Group(); this.spinGroup.add(this.equipment);
    if (r.type === 'snowboard') {
      const shape = new THREE.Shape(); shape.moveTo(-.15, -.82); shape.quadraticCurveTo(-.18, -1.03, 0, -1.03); shape.quadraticCurveTo(.18, -1.03, .15, -.82); shape.lineTo(.15, .82); shape.quadraticCurveTo(.18, 1.03, 0, 1.03); shape.quadraticCurveTo(-.18, 1.03, -.15, .82); shape.closePath();
      const board = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .03, bevelEnabled: false }), material(id === 'massimo' ? 0x557c55 : 0x655775)); board.geometry.rotateX(-Math.PI / 2); const positions = board.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) { const z = positions.getZ(i) * r.boardLength / 2.06; positions.setZ(i, z); positions.setY(i, positions.getY(i) + Math.max(0, Math.abs(z) - r.boardLength * .36) ** 2 * 2.4); } board.geometry.computeVertexNormals(); board.position.y = .015; board.castShadow = true; this.equipment.add(board);
      this.equipment.add(box(.22, .018, .52, dark, 0, .13, 0)); this.body.rotation.y = Math.PI / 2;
    } else {
      for (let i = 0; i < 2; i++) {
        const ski = new THREE.Group(); ski.position.x = i ? .19 : -.19;
        ski.add(box(.09, .035, r.boardLength, material(id === 'fred' ? 0xeac76b : 0x6f8c73), 0, .015)); const tip = box(.09, .035, .17, dark, 0, .055, r.boardLength / 2); tip.rotation.x = -.33; ski.add(tip); this.equipment.add(ski);
      }
      this.poles = [];
      for (let i = 0; i < 2; i++) { const pole = new THREE.Group(); pole.position.set(i ? .4 : -.4, .53, .05); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .95, 4), dark); shaft.position.y = -.35; shaft.rotation.x = -.32; pole.add(shaft); const basket = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .01, 8), dark); basket.position.set(0, -.77, .14); pole.add(basket); this.body.add(pole); this.poles.push(pole); }
    }
    if (id === 'jeece') this.torso.add(box(.07, .09, .015, material(0xe6c56f), -.12, .1, .21));
    if (id === 'fred') { this.torso.add(box(.43, .035, .035, material(0xe8d68a), 0, -.08, .22)); this.torso.add(box(.035, .42, .035, material(0xe8d68a), -.15, -.02, .19)); }
  }

  update(state, time) {
    const air = !state.grounded, carve = state.steer || 0, charge = state.charge || 0, grab = air && state.grab, tweak = air && state.tweak;
    this.root.position.set(state.x, state.y + .02, state.z);
    this.root.quaternion.copy(state.orientation); this.spinGroup.rotation.set(0, 0, 0);
    if (this.ragdollActive) return;
    const crouch = charge * .23 + (state.compression || 0) * .22 + (state.tuck || 0) * .1 + (air ? (grab ? .12 : .04) : 0);
    this.hips.position.y = .7 - crouch;
    this.hips.rotation.set(0, 0, 0); this.torso.rotation.x = .08 + charge * .15 + (state.tuck || 0) * .4; this.headGroup.rotation.x = -(state.tuck || 0) * .2;
    this.arms[0].rotation.set(grab ? -.8 : -.14 - charge * .4, 0, grab ? -.1 : -.3 - Math.abs(carve) * .24);
    this.arms[1].rotation.set(grab ? -1.1 : .1, 0, grab ? .85 : .28 + Math.abs(carve) * .24);
    for (const arm of this.armBones) arm.userData.joint.rotation.x = grab ? -1.15 : -.25 - charge * .35;
    let teleOffset = 0;
    if (this.info.type === 'telemark' && state.grounded) {
      const l = carve >= 0 ? 0 : 1, r = 1 - l;
      teleOffset = .24 * (carve >= 0 ? 1 : -1); this.hips.position.y -= Math.abs(carve) * .06;
      this.equipment.children[0].position.z = teleOffset; this.equipment.children[1].position.z = -teleOffset;
    }
    for (let i = 0; i < 2; i++) { const offset = this.info.type === 'telemark' ? (i ? -teleOffset : teleOffset) : 0, vertical = this.hips.position.y - .085, distance = Math.min(.675, Math.hypot(vertical, offset)), bend = Math.acos(distance / .68), direction = Math.atan2(offset, vertical); this.legs[i].rotation.x = direction + bend; this.legs[i].userData.joint.rotation.x = -2 * bend; }
    if (tweak && air) { this.legs[0].rotation.x += .35; this.legs[1].rotation.x -= .2; }
    if (this.info.type === 'ski' && tweak) { this.equipment.children[0].rotation.y = .32; this.equipment.children[1].rotation.y = -.32; }
    else if (this.info.type !== 'snowboard') { this.equipment.children[0].rotation.y = 0; this.equipment.children[1].rotation.y = 0; }
    if (this.poles) for (const [i, pole] of this.poles.entries()) pole.rotation.z = (i ? 1 : -1) * (air ? .5 : .1);
  }

  beginRagdoll(engine, scene) {
    if (this.ragdollActive) return;
    this.root.updateMatrixWorld(true);
    const parts = [{ name: 'torso', object: this.torso, radius: .2, length: .56, fraction: .38 }, { name: 'head', object: this.headGroup, radius: .18, length: .36, fraction: .075, parent: 'torso', anchor: this.headGroup.localToWorld(new THREE.Vector3(0, -.17, 0)) }];
    for (let i = 0; i < 2; i++) {
      for (const [name, bone, parent, fraction] of [[`arm${i}`, this.armBones[i], 'torso', .045], [`leg${i}`, this.legs[i], 'torso', .13]]) {
        const data = bone.userData;
        parts.push({ name, object: data.upper, radius: data.radius, length: data.length / 2, fraction, parent, anchor: bone.getWorldPosition(new THREE.Vector3()) });
        parts.push({ name: `${name}lower`, object: data.lower, radius: data.radius, length: data.length / 2, fraction: name.startsWith('arm') ? .025 : .065, parent: name, anchor: data.joint.getWorldPosition(new THREE.Vector3()) });
      }
    }
    engine.createRagdoll(parts, scene); this.body.visible = false; this.ragdollActive = true;
  }
  endRagdoll() { this.body.visible = true; this.ragdollActive = false; }

  dispose() { this.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } }); }
}
