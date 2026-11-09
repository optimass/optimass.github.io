import * as THREE from './lib/three.module.js';

export const RUN_LENGTH = 1800;
export function groundHeight(x, z) {
  const side = Math.max(0, Math.abs(x) - 37);
  return 64 - z * .225 + Math.sin(z * .025) * 1.25 + Math.cos(x * .055) * .8 + side * side * .0035 + Math.sin(z * .013 + x * .032) * Math.min(side * .04, 3);
}

function random(seed) { let n = seed; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; }
const mat = color => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: .95 });
function mesh(geometry, material, pos, shadow = true) { const m = new THREE.Mesh(geometry, material); if (pos) m.position.set(...pos); m.castShadow = shadow; m.receiveShadow = true; return m; }

export class MountainWorld {
  constructor(scene) {
    this.scene = scene; this.features = new THREE.Group(); this.scene.add(this.features); this.ramps = []; this.landings = []; this.rails = []; this.obstacles = []; this.tracks = []; this.route = 'park'; this.collisionTrees = []; this.collisionRocks = []; this.baseHeight = groundHeight;
    this.snowMat = new THREE.MeshStandardMaterial({ color: 0xf3f5ee, roughness: .88 }); this.orange = mat(0xd8784e); this.dark = mat(0x344e43); this.wood = mat(0x927757);
    this.buildSky(); this.buildTerrain(); this.buildTrees(); this.buildRocks(); this.buildLift(); this.buildLodge(); this.buildBackdrop(); this.setRoute('park'); this.buildParticles(); this.buildTracks();
  }

  buildSky() {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(750, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color(0x90bccb) }, bottom: { value: new THREE.Color(0xf4d4b7) } }, vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vPosition; void main(){float t=smoothstep(-.04,.55,normalize(vPosition).y);gl_FragColor=vec4(mix(bottom,top,t),1.);\n#include <colorspace_fragment>\n}' }));
    this.sky = sky; this.scene.add(sky);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffedce, fog: false })); sun.position.set(-260, 220, 650); this.sunDisk = sun; this.scene.add(sun);
  }

  buildTerrain() {
    const geometry = new THREE.PlaneGeometry(520, RUN_LENGTH + 600, 80, 280); geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, RUN_LENGTH / 2 + 100);
    const p = geometry.attributes.position, colors = [], rng = random(6);
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, groundHeight(x, z)); const n = rng() * .03, c = new THREE.Color().setRGB(.88 + n, .93 + n * .7, .91 + n * .8); colors.push(c.r, c.g, c.b); }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.computeVertexNormals();
    const textureCanvas = document.createElement('canvas'); textureCanvas.width = textureCanvas.height = 256; const ctx = textureCanvas.getContext('2d'), noise = ctx.createImageData(256, 256);
    for (let i = 0; i < noise.data.length; i += 4) { const value = 125 + Math.floor(rng() * 34); noise.data.set([value, value, value, 255], i); } ctx.putImageData(noise, 0, 0);
    const grain = new THREE.CanvasTexture(textureCanvas); grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(100, 460); grain.anisotropy = 4;
    const terrain = mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .91, bumpMap: grain, bumpScale: .018 }), null, false); terrain.receiveShadow = true; this.terrain = terrain; this.scene.add(terrain);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x74867f, transparent: true, opacity: .13 });
    for (let j = 0; j < 7; j++) { const points = []; for (let z = -50; z < RUN_LENGTH; z += 8) { const x = -28 + j * 9 + Math.sin(z * .031 + j) * 2.7; points.push(new THREE.Vector3(x, groundHeight(x, z) + .025, z)); } this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMat)); }
  }

  buildTrees() {
    const rng = random(235), positions = [];
    for (let i = 0; i < 580; i++) { const z = -120 + rng() * (RUN_LENGTH + 440), side = rng() > .5 ? 1 : -1, x = side * (24 + rng() * 145); positions.push({ x, z, h: 3.2 + rng() * 5.4, s: .7 + rng() * .7 }); }
    for (let i = 0; i < 20; i++) { const z = 155 + i * 80, x = (i % 2 ? -1 : 1) * (15 + rng() * 10); positions.push({ x, z, h: 4.2 + rng() * 2, s: .8 }); this.obstacles.push({ x, z, radius: .75 }); }
    this.collisionTrees = positions.filter(p => Math.abs(p.x) < 150).map(p => ({ x: p.x, z: p.z, y: groundHeight(p.x, p.z), h: p.h * .6, radius: .22 }));
    const count = positions.length, trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.11, .2, 1, 5), this.wood, count), greens = [], snows = [], dummy = new THREE.Object3D();
    for (let j = 0; j < 3; j++) { greens.push(new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 10), new THREE.MeshStandardMaterial({ color: [0x2a5141, 0x3e6350, 0x4f705b][j], roughness: .98 }), count)); snows.push(new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 10), this.snowMat, count)); }
    positions.forEach((p, i) => { const y = groundHeight(p.x, p.z); dummy.position.set(p.x, y + .55, p.z); dummy.scale.set(1, 1.1, 1); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 3; j++) { const radius = p.h * (.24 - j * .038) * p.s, h = p.h * .5; dummy.rotation.y = i * 1.2; dummy.position.set(p.x, y + p.h * (.32 + j * .21), p.z); dummy.scale.set(radius, h, radius); dummy.updateMatrix(); greens[j].setMatrixAt(i, dummy.matrix); dummy.position.y += h * .125; dummy.scale.set(radius * .78, h * .83, radius * .78); dummy.updateMatrix(); snows[j].setMatrixAt(i, dummy.matrix); }
    });
    for (const m of [trunks, ...greens, ...snows]) { m.castShadow = true; m.receiveShadow = true; this.scene.add(m); }
  }

  buildRocks() {
    const rng = random(9823), g = new THREE.IcosahedronGeometry(1, 0), stone = mat(0x84928c);
    for (let i = 0; i < 80; i++) { const x = (rng() > .5 ? 1 : -1) * (32 + rng() * 75), z = rng() * (RUN_LENGTH + 100), h = 1 + rng() * 4; const rock = mesh(g, stone, [x, groundHeight(x, z), z]); rock.scale.set(h * 1.5, h, h); rock.rotation.y = rng() * 6; this.scene.add(rock); const snow = mesh(g, this.snowMat, [x, groundHeight(x, z) + h * .4, z]); snow.scale.set(h * 1.45, h * .65, h * .9); snow.rotation.y = rock.rotation.y; this.scene.add(snow); this.collisionRocks.push({ x, y: groundHeight(x, z), z, radius: h * .85 }); }
  }

  buildLift() {
    const steel = mat(0x657d76), seat = mat(0xdf8259), cableMat = new THREE.LineBasicMaterial({ color: 0x566960 }); this.chairs = [];
    const points = [];
    for (let z = -40; z < RUN_LENGTH + 80; z += 110) { const x = -43, y = groundHeight(x, z); const pole = mesh(new THREE.CylinderGeometry(.18, .29, 12, 6), steel, [x, y + 6, z]); this.scene.add(pole); this.scene.add(mesh(new THREE.BoxGeometry(6.5, .25, .4), steel, [x, y + 12, z])); points.push(new THREE.Vector3(x + 2.7, y + 12.1, z)); }
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), cableMat));
    for (let z = -30; z < RUN_LENGTH + 100; z += 30) { const x = -40.3, y = groundHeight(-43, z) + 10; const chair = new THREE.Group(); chair.position.set(x, y, z); chair.add(mesh(new THREE.BoxGeometry(.06, 2.3, .06), steel, [0, 1, 0])); chair.add(mesh(new THREE.BoxGeometry(2.1, .12, .8), seat, [0, -.2, 0])); chair.add(mesh(new THREE.BoxGeometry(2.1, .8, .08), seat, [0, .2, -.35])); chair.add(mesh(new THREE.BoxGeometry(2.1, .1, .1), steel, [0, .35, .45])); this.scene.add(chair); this.chairs.push(chair); }
  }

  buildLodge() {
    const x = 42, z = 135, y = groundHeight(x, z); const lodge = new THREE.Group(); lodge.position.set(x, y, z); lodge.add(mesh(new THREE.BoxGeometry(12, 6, 9), mat(0x9d7356), [0, 3, 0]));
    const roof = mesh(new THREE.CylinderGeometry(0, 10, 4, 4, 1), this.snowMat, [0, 7, 0]); roof.rotation.y = Math.PI / 4; roof.scale.z = .75; lodge.add(roof); const glass = mat(0x3c6468);
    for (let i = -1; i <= 1; i++) { lodge.add(mesh(new THREE.BoxGeometry(2.1, 1.6, .05), glass, [i * 3.3, 3.5, -4.52])); lodge.add(mesh(new THREE.BoxGeometry(.12, 1.8, .08), this.wood, [i * 3.3, 3.5, -4.6])); }
    lodge.add(mesh(new THREE.BoxGeometry(1.2, 4, 1.2), mat(0x7b8173), [3, 8, 1])); this.scene.add(lodge);
    this.makeSign(-10, 10, 'THE GOOD SIDE', 'JUNIPER PARK  ↗', this.scene);
  }

  makeSign(x, z, title, subtitle, parent) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 280; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#2b4437'; ctx.fillRect(0, 0, 768, 280); ctx.fillStyle = '#e7eccc'; ctx.font = 'bold 57px Arial'; ctx.textAlign = 'center'; ctx.fillText(title, 384, 110); ctx.font = '24px Arial'; ctx.fillText(subtitle, 384, 190); const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Group(); sign.position.set(x, groundHeight(x, z), z); sign.add(mesh(new THREE.BoxGeometry(.2, 3.3, .2), this.wood, [-1.5, 1.65, 0])); sign.add(mesh(new THREE.BoxGeometry(.2, 3.3, .2), this.wood, [1.5, 1.65, 0])); const panel = mesh(new THREE.BoxGeometry(4, 1.46, .14), [this.dark, this.dark, this.dark, this.dark, new THREE.MeshBasicMaterial({ map: texture }), new THREE.MeshBasicMaterial({ map: texture })], [0, 2.75, 0]); parent.add(sign); sign.add(panel);
  }

  buildBackdrop() {
    this.backdrop = new THREE.Group(); const rng = random(990);
    for (let i = 0; i < 15; i++) {
      const x = -600 + i * 90, z = 420 + rng() * 200, h = 160 + rng() * 140, radius = 110 + rng() * 90;
      const geometry = new THREE.ConeGeometry(radius, h, 24, 12), p = geometry.attributes.position, c = [];
      for (let j = 0; j < p.count; j++) { const px = p.getX(j), py = p.getY(j), pz = p.getZ(j), f = 1 + Math.sin(px * .09 + i) * Math.cos(pz * .08) * .14; p.setXYZ(j, px * f, py + Math.sin(px * .06 + pz * .1) * 5 * (1 - Math.abs(py / h)), pz * f); }
      geometry.computeVertexNormals();
      for (let j = 0; j < p.count; j++) { const y = p.getY(j); if (y < h * .16) { const color = new THREE.Color(i % 2 ? 0x94a6a7 : 0xa1b2b2); c.push(color.r, color.g, color.b); } else { const color = new THREE.Color(0xe6eae3); c.push(color.r, color.g, color.b); } }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); const mountain = mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, fog: false }), [x, -z * .225 - 35 + h / 2, z], false); mountain.rotation.y = rng() * Math.PI; mountain.scale.z = .7; this.backdrop.add(mountain);
    }
    this.scene.add(this.backdrop);
  }

  clearFeatures() { this.features.traverse(o => { if (o.isMesh) { o.geometry.dispose(); for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (![this.snowMat, this.orange, this.dark, this.wood].includes(m)) { m.map?.dispose(); m.dispose(); } } } }); this.features.clear(); this.ramps = []; this.landings = []; this.rails = []; }

  setRoute(route) {
    this.clearFeatures(); this.route = route;
    if (route === 'park') {
      for (let i = 0; i < 22; i++) { const z = 76 + i * 74, x = [-6, 8, 0, -13, 13, 0][i % 6], height = i % 4 === 2 ? 4 : 2.8; this.makeRamp(x, z, 7, 10, height); if (i % 3 !== 2) this.makeRail(x + (x < 0 ? 10 : -10), z + 28, 12 + i % 3 * 2); }
    } else {
      for (let i = 0; i < 18; i++) { const z = 78 + i * 92, x = [-8, 10, -15, 0, 16, -4][i % 6]; this.makeRamp(x, z, 10, 13, 4.4 + i % 3 * .65, true); if (i % 4 === 0) this.makeRail(x + 13, z + 35, 14); }
    }
    for (let i = 0; i < 30; i++) { const z = 40 + i * 60; for (const x of [-23, 23]) { const y = groundHeight(x, z); this.features.add(mesh(new THREE.CylinderGeometry(.055, .055, 2.2, 4), this.dark, [x, y + 1.1, z])); const flag = mesh(new THREE.BoxGeometry(.75, .55, .04), this.orange, [x + (x < 0 ? .38 : -.38), y + 1.8, z]); this.features.add(flag); } }
    this.makeSign(13, 27, route === 'park' ? 'JUNIPER PARK' : 'THE RIDGELINE', route === 'park' ? 'FIND YOUR FLOW  ◆' : 'GO BIG. STAY WILD.  ◆◆', this.features);
    this.makeSign(0, RUN_LENGTH + 14, 'NICE LINE.', 'SAME TIME TOMORROW?', this.features);
    const finishY = groundHeight(0, RUN_LENGTH); for (const x of [-18, 18]) this.features.add(mesh(new THREE.CylinderGeometry(.15, .15, 7, 6), this.dark, [x, finishY + 3.5, RUN_LENGTH]));
    this.features.add(mesh(new THREE.BoxGeometry(36.2, .5, .5), this.orange, [0, finishY + 7, RUN_LENGTH]));
  }

  makeRamp(x, z, width, length, height, natural = false) {
    const vertices = [], indices = [], segments = 10;
    for (let i = 0; i <= segments; i++) { const t = i / segments, zz = z + t * length, rise = height * t * t; for (const xx of [x - width / 2, x + width / 2]) vertices.push(xx, groundHeight(xx, zz) + rise + .025, zz); if (i < segments) { const k = i * 2; indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); this.features.add(mesh(g, this.snowMat, null, false));
    const lipZ = z + length, y = groundHeight(x, lipZ), back = mesh(new THREE.BoxGeometry(width, height, .18), natural ? this.snowMat : this.orange, [x, y + height / 2, lipZ]); this.features.add(back);
    if (!natural) { for (const side of [-1, 1]) { const sideG = new THREE.BufferGeometry(); const p = []; for (let i = 0; i <= segments; i++) { const zz = z + i / segments * length, yy = groundHeight(x + side * width / 2, zz); p.push(x + side * width / 2, yy, zz, x + side * width / 2, yy + height * (i / segments) ** 2, zz); } sideG.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); sideG.setIndex(indices); sideG.computeVertexNormals(); const m = this.orange.clone(); m.side = THREE.DoubleSide; this.features.add(mesh(sideG, m, null, false)); }
      const stripe = mesh(new THREE.BoxGeometry(width, .04, .17), this.orange, [x, y + height + .06, lipZ - .23]); this.features.add(stripe);
    }
    this.ramps.push({ x, z, width, length, height, geometry: g });
    this.makeLanding(x, lipZ + 5, width + 2, natural ? 24 : 19, height * .88);
  }

  makeLanding(x, z, width, length, height) {
    const vertices = [], indices = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, zz = z + t * length; for (const xx of [x - width / 2, x + width / 2]) vertices.push(xx, groundHeight(xx, zz) + height * (1 - t) ** 2 + .025, zz); if (i < 12) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals(); this.features.add(mesh(g, this.snowMat, null, false));
    this.features.add(mesh(new THREE.BoxGeometry(width, height, .15), this.snowMat, [x, groundHeight(x, z) + height / 2, z]));
    for (const side of [-1, 1]) { const p = []; for (let i = 0; i <= 12; i++) { const zz = z + i / 12 * length, xx = x + side * width / 2, yy = groundHeight(xx, zz); p.push(xx, yy, zz, xx, yy + height * (1 - i / 12) ** 2, zz); } const sideG = new THREE.BufferGeometry(); sideG.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); sideG.setIndex(indices); sideG.computeVertexNormals(); const m = this.snowMat.clone(); m.side = THREE.DoubleSide; this.features.add(mesh(sideG, m, null, false)); }
    this.landings.push({ x, z, width, length, height, geometry: g });
  }

  makeRail(x, z, length) {
    const y = groundHeight(x, z), endY = groundHeight(x, z + length), rail = { x, z, length, height: 1.1 }; this.rails.push(rail);
    const group = new THREE.Group(), top = mesh(new THREE.BoxGeometry(.38, .22, Math.hypot(length, endY - y)), mat(0x939c98), [x, (y + endY) / 2 + 1.1, z + length / 2]); top.rotation.x = -Math.atan2(endY - y, length); group.add(top);
    for (let i = 0; i <= 2; i++) group.add(mesh(new THREE.BoxGeometry(.13, 1.1, .13), this.dark, [x, y + (endY - y) * i / 2 + .55, z + length * i / 2])); this.features.add(group);
  }

  surface(x, z) { let y = groundHeight(x, z); for (const r of this.ramps) if (z >= r.z && z <= r.z + r.length && Math.abs(x - r.x) <= r.width / 2) y += r.height * ((z - r.z) / r.length) ** 2; for (const l of this.landings) if (z >= l.z && z <= l.z + l.length && Math.abs(x - l.x) <= l.width / 2) y += l.height * (1 - (z - l.z) / l.length) ** 2; return y; }
  rampAt(x, z) { return this.ramps.find(r => z >= r.z && z <= r.z + r.length && Math.abs(x - r.x) <= r.width / 2); }
  normalAt(x, z) { const e = .1, gx = (groundHeight(x + e, z) - groundHeight(x - e, z)) / (2 * e); let gz = (groundHeight(x, z + e) - groundHeight(x, z - e)) / (2 * e); const r = this.rampAt(x, z); if (r) gz += 2 * r.height * (z - r.z) / (r.length * r.length); const l = this.landings.find(a => z >= a.z && z <= a.z + a.length && Math.abs(x - a.x) <= a.width / 2); if (l) gz -= 2 * l.height * (1 - (z - l.z) / l.length) / l.length; return new THREE.Vector3(-gx, 1, -gz).normalize(); }

  buildParticles() {
    this.particleCount = 120; this.particleData = Array.from({ length: this.particleCount }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 })); this.particleCursor = 0; this.particles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.07, 0), new THREE.MeshBasicMaterial({ color: 0xf8f8ed, transparent: true, opacity: .75 }), this.particleCount); this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.particles.frustumCulled = false; this.scene.add(this.particles); this.particleDummy = new THREE.Object3D();
  }

  emitSnow(state, count, burst = false) {
    for (let i = 0; i < count; i++) { const p = this.particleData[this.particleCursor++ % this.particleCount]; p.life = .3 + Math.random() * .5; p.x = state.x + (Math.random() - .5) * .6; p.y = state.y + .12; p.z = state.z - .3; p.vx = (Math.random() - .5) * (burst ? 8 : 3) - (state.steer || 0) * 2; p.vy = 1 + Math.random() * (burst ? 6 : 2); p.vz = -Math.random() * 5; }
  }

  buildTracks() {
    this.trackCapacity = 2200; this.trackPositions = new Float32Array(this.trackCapacity * 6); this.trackCursor = 0; this.lastTrack = null;
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(this.trackPositions, 3).setUsage(THREE.DynamicDrawUsage)); geometry.setDrawRange(0, 0);
    this.trackLines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x8caaa4, transparent: true, opacity: .32 })); this.trackLines.frustumCulled = false; this.scene.add(this.trackLines);
  }

  track(state, isSki) {
    if (!state.grounded || state.bailTimer > 0) { this.lastTrack = null; return; }
    if (this.lastTrack && Math.hypot(state.z - this.lastTrack.z, state.x - this.lastTrack.x) < .45) return;
    if (this.lastTrack) for (const offset of isSki ? [-.18, .18] : [0]) { const index = this.trackCursor++ % this.trackCapacity, a = this.lastTrack, b = state, dx = Math.cos(state.heading) * offset, dz = -Math.sin(state.heading) * offset; this.trackPositions.set([a.x + dx, this.surface(a.x + dx, a.z + dz) + .04, a.z + dz, b.x + dx, this.surface(b.x + dx, b.z + dz) + .04, b.z + dz], index * 6); }
    this.lastTrack = { x: state.x, z: state.z }; this.trackLines.geometry.setDrawRange(0, Math.min(this.trackCursor, this.trackCapacity) * 2); this.trackLines.geometry.attributes.position.needsUpdate = true;
  }

  reset() { this.trackCursor = 0; this.lastTrack = null; this.trackLines.geometry.setDrawRange(0, 0); this.particleData.forEach(p => p.life = 0); }

  update(dt, state, time) {
    this.sky.position.copy(state ? new THREE.Vector3(state.x, state.y, state.z) : new THREE.Vector3());
    if (state) { this.backdrop.position.set(0, groundHeight(0, state.z), state.z); this.sunDisk.position.z = state.z + 650; this.sunDisk.position.y = groundHeight(0, state.z) + 180; }
    for (let i = 0; i < this.particleCount; i++) { const p = this.particleData[i], d = this.particleDummy; p.life -= dt; if (p.life > 0) { p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= dt * 8; d.position.set(p.x, p.y, p.z); d.scale.setScalar(Math.min(p.life * 3, 1)); } else d.scale.setScalar(0); d.updateMatrix(); this.particles.setMatrixAt(i, d.matrix); } this.particles.instanceMatrix.needsUpdate = true;
  }
}
