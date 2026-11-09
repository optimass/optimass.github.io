import * as THREE from './lib/three.module.js';

export const RIDERS = {
  massimo: { name: 'Massimo', type: 'snowboard', color: 0xcadf77, pants: 0x354a39, helmet: 0x34473a, skin: '#bd8b68', height: 1.12, pop: 1.13, spin: 1.12, agility: 1.15, motto: 'LOW CENTER. HIGH STYLE.', grab: 'Indy grab', tweak: 'Stalefish', special: 'Steazy method' },
  benn: { name: 'Benn', type: 'snowboard', color: 0xb58bba, pants: 0x354245, helmet: 0xe9dbca, skin: '#d2a481', height: 1.52, pop: 1.06, spin: .96, agility: .96, motto: 'LONG LIMBS. LONGER LINES.', grab: 'Melon grab', tweak: 'Nosebone', special: 'Lanky method' },
  jeece: { name: 'Jeece', type: 'ski', color: 0x466b91, pants: 0x293c53, helmet: 0x2c4054, skin: '#c59471', height: 1.32, pop: 1, spin: 1.02, agility: 1.08, motto: 'OFF DUTY. ON EDGE.', grab: 'Safety grab', tweak: 'Daffy', special: 'The law & order' },
  fred: { name: 'Fred B', type: 'telemark', color: 0xdc724b, pants: 0x564b40, helmet: 0xe3bd53, skin: '#cfa07c', height: 1.31, pop: 1.08, spin: .98, agility: 1.04, motto: 'FREE THE HEEL. FEEL THE TURN.', grab: 'Tail grab', tweak: 'Tele cross', special: 'Free-heel flair' },
};

export function portrait(id) {
  const r = RIDERS[id], color = `#${r.color.toString(16).padStart(6, '0')}`, helmet = `#${r.helmet.toString(16).padStart(6, '0')}`;
  const body = id === 'benn' ? 'M28 96V67Q30 53 50 53T72 67V96' : 'M20 96V73Q22 55 50 55T80 73V96';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="97" rx="41" ry="6" fill="#2b4037" opacity=".07"/><path d="${body}" fill="${color}"/><path d="M48 58v37" stroke="#263c33" stroke-width="1.4" opacity=".35"/><path d="M33 62 44 69l6-11 7 11 12-7" fill="#263c33" opacity=".16"/><rect x="42" y="47" width="16" height="13" rx="5" fill="${r.skin}"/><ellipse cx="50" cy="35" rx="20" ry="23" fill="${r.skin}"/><path d="M29 33V27a21 21 0 0 1 42 0v6H29" fill="${helmet}"/><path d="M32 15q18-14 35 0" fill="none" stroke="#fff" stroke-width="2.5" opacity=".22"/><rect x="27" y="30" width="46" height="14" rx="6" fill="#344541"/><rect x="31" y="32" width="38" height="9" rx="4" fill="#d6bda0"/><path d="m37 33 12 7h6l-12-7" fill="#fff" opacity=".7"/><path d="M46 50q4 3 8 0" fill="none" stroke="#754d3b" stroke-width="1.3" stroke-linecap="round"/>${id === 'jeece' ? '<path d="m64 67 5 2v7l-5 3-5-3v-7Z" fill="#e5c868"/><path d="m64 70 1 2 2 .3-1.5 1.5.4 2-1.9-1-1.9 1 .4-2-1.5-1.5 2-.3Z" fill="#3d5677"/>' : ''}${id === 'fred' ? '<path d="M24 77h53v5H24" fill="#e8dc87"/><path d="M23 76h54v2H23" fill="#9b6d43"/><path d="M39 18h22v8H39" fill="#263c33" opacity=".35"/><path d="m50 19 4 5h-8Z" fill="#efdfb0"/>' : ''}</svg>`;
}

const material = color => new THREE.MeshStandardMaterial({ color, roughness: .87, flatShading: true });
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function limb(length, radius, mat) {
  const group = new THREE.Group(), mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(.05, length - radius * 2), 2, 5), mat);
  mesh.position.y = -length / 2; mesh.castShadow = true; group.add(mesh); return group;
}

export class RiderModel {
  constructor(id) {
    this.id = id; this.info = RIDERS[id]; this.root = new THREE.Group();
    this.spinGroup = new THREE.Group(); this.root.add(this.spinGroup);
    const r = this.info, jacket = material(r.color), pants = material(r.pants), helmet = material(r.helmet), skin = material(r.skin), dark = material(0x253834), boot = material(0x273633), scale = r.height / 1.32;
    this.body = new THREE.Group(); this.body.scale.set(scale * (id === 'benn' ? .8 : 1), scale, scale * (id === 'benn' ? .9 : 1)); this.spinGroup.add(this.body);
    this.hips = new THREE.Group(); this.hips.position.y = .7; this.body.add(this.hips);
    this.torso = box(.46, .52, .3, jacket, 0, .28); this.hips.add(this.torso);
    this.hips.add(box(.03, .48, .315, dark, 0, .29));
    this.head = new THREE.Mesh(new THREE.IcosahedronGeometry(.215, 1), skin); this.head.position.y = .73; this.head.scale.set(.88, 1.05, .9); this.head.castShadow = true; this.hips.add(this.head);
    const helmetMesh = new THREE.Mesh(new THREE.SphereGeometry(.235, 8, 5, 0, Math.PI * 2, 0, Math.PI * .6), helmet); helmetMesh.position.y = .78; helmetMesh.castShadow = true; this.hips.add(helmetMesh);
    this.hips.add(box(.34, .095, .075, material(0xcfae83), 0, .77, .19));
    this.hips.add(box(.4, .026, .2, dark, 0, .85, .08));
    const shoulderL = new THREE.Group(), shoulderR = new THREE.Group(); shoulderL.position.set(-.28, .46, 0); shoulderR.position.set(.28, .46, 0); this.hips.add(shoulderL, shoulderR);
    this.arms = [shoulderL, shoulderR];
    for (const [i, shoulder] of this.arms.entries()) { const arm = limb(.44, .08, jacket); shoulder.add(arm); arm.add(box(.12, .13, .12, dark, 0, -.46)); shoulder.rotation.z = i ? .22 : -.22; }
    this.legs = [];
    for (let i = 0; i < 2; i++) { const leg = limb(.55, .105, pants); leg.position.set(i ? .16 : -.16, -.015, 0); this.hips.add(leg); const foot = box(.14, .14, .31, boot, 0, -.55, .065); leg.add(foot); this.legs.push(leg); }
    this.equipment = new THREE.Group(); this.spinGroup.add(this.equipment);
    if (r.type === 'snowboard') {
      const shape = new THREE.Shape(); shape.moveTo(-.15, -.82); shape.quadraticCurveTo(-.18, -1.03, 0, -1.03); shape.quadraticCurveTo(.18, -1.03, .15, -.82); shape.lineTo(.15, .82); shape.quadraticCurveTo(.18, 1.03, 0, 1.03); shape.quadraticCurveTo(-.18, 1.03, -.15, .82); shape.closePath();
      const board = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: false }), material(id === 'massimo' ? 0xe98557 : 0xe6d57b)); board.rotation.x = -Math.PI / 2; board.position.y = .08; board.castShadow = true; this.equipment.add(board);
      this.equipment.add(box(.22, .018, .52, dark, 0, .13, 0)); this.body.rotation.y = Math.PI / 2;
    } else {
      for (let i = 0; i < 2; i++) {
        const ski = new THREE.Group(); ski.position.x = i ? .19 : -.19;
        ski.add(box(.1, .045, 2.15, material(id === 'fred' ? 0xeac76b : 0xd4e47b), 0, .075)); const tip = box(.1, .045, .26, dark, 0, .13, 1.14); tip.rotation.x = -.33; ski.add(tip); this.equipment.add(ski);
      }
      this.poles = [];
      for (let i = 0; i < 2; i++) { const pole = new THREE.Group(); pole.position.set(i ? .4 : -.4, .53, .05); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .95, 4), dark); shaft.position.y = -.35; shaft.rotation.x = -.32; pole.add(shaft); const basket = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .01, 8), dark); basket.position.set(0, -.77, .14); pole.add(basket); this.body.add(pole); this.poles.push(pole); }
    }
    if (id === 'jeece') this.hips.add(box(.07, .09, .015, material(0xe6c56f), -.12, .39, .163));
    if (id === 'fred') { this.hips.add(box(.465, .06, .31, material(0xe8d68a), 0, .2)); this.hips.add(box(.075, .5, .32, material(0xe8d68a), -.16, .27)); }
  }

  update(state, time) {
    const air = !state.grounded, carve = state.steer || 0, charge = state.charge || 0, grab = air && state.grab, tweak = air && state.tweak;
    this.root.position.set(state.x, state.y + .02, state.z);
    this.root.rotation.set(state.grounded ? -.115 : 0, state.heading || 0, carve * .1);
    this.spinGroup.rotation.set(state.flip || 0, state.spin || 0, 0);
    if (state.bailTimer > 0) { this.spinGroup.rotation.set(1.4, Math.sin(time * 4) * .4, .65); this.root.position.y -= .1; }
    const crouch = charge * .25 + (air ? .09 : 0);
    this.hips.position.y = .7 - crouch;
    this.hips.rotation.set(air ? (grab ? -.35 : -.14) : .12 + charge * .2, 0, -carve * .14);
    this.legs[0].rotation.set(crouch * 1.2, 0, -.05); this.legs[1].rotation.set(crouch * 1.2, 0, .05);
    this.arms[0].rotation.set(grab ? -.8 : -.14 - charge * .4, 0, grab ? -.1 : -.3 - Math.abs(carve) * .24);
    this.arms[1].rotation.set(grab ? -1.1 : .1, 0, grab ? .85 : .28 + Math.abs(carve) * .24);
    if (tweak) { this.legs[0].rotation.x = -.55; this.legs[1].rotation.x = .6; this.hips.rotation.z = .2; }
    if (this.info.type === 'telemark' && state.grounded) {
      const l = carve >= 0 ? 0 : 1, r = 1 - l;
      this.legs[l].rotation.x = -.62; this.legs[r].rotation.x = .65; this.hips.position.y = .56 - charge * .16;
      this.equipment.children[l].position.z = .23; this.equipment.children[r].position.z = -.23;
    }
    if (this.info.type === 'ski' && tweak) { this.equipment.children[0].rotation.y = .32; this.equipment.children[1].rotation.y = -.32; }
    else if (this.info.type !== 'snowboard') { this.equipment.children[0].rotation.y = 0; this.equipment.children[1].rotation.y = 0; }
    if (this.poles) for (const [i, pole] of this.poles.entries()) pole.rotation.z = (i ? 1 : -1) * (air ? .5 : .1);
  }

  dispose() { this.root.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material.dispose(); } }); }
}
