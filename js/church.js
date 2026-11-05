import * as THREE from './three.js';
import { textTexture, stainedGlassTexture, roseWindowTexture, floorTexture, glowSprite } from './textures.js';

// Church interior, centred on the origin.
//   x: -10 … 10 (width)   z: -20 (altar) … 20 (entrance)   y: 0 … 10 (walls)
export const BOUNDS = { minX: -9.5, maxX: 9.5, minZ: -19.3, maxZ: 19.3 };
export const ALTAR_Z = -14; // platform starts here, raised 0.6
export const SPAWN = { x: 0, z: 17, ry: Math.PI };

const SERIF = '"Noto Serif KR", "Nanum Myeongjo", Georgia, "Times New Roman", serif';

export function buildChurch(scene) {
  const colliders = [];
  const interactables = [];
  const addCollider = (cx, cz, w, d) => colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });

  const mat = {
    wall: new THREE.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.95 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xcbbca3, roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.7 }),
    darkWood: new THREE.MeshStandardMaterial({ color: 0x3e2614, roughness: 0.75 }),
    red: new THREE.MeshStandardMaterial({ color: 0x8e1b22, roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a830, emissive: 0x7a5410, metalness: 0.6, roughness: 0.35 }),
    white: new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.8 }),
  };
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); scene.add(b); return b; };

  // ── Lighting ──
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4632, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d0, 1.0);
  sun.position.set(6, 14, 8); scene.add(sun);
  const altarLight = new THREE.PointLight(0xffd59a, 40, 22, 1.6);
  altarLight.position.set(0, 7, -15); scene.add(altarLight);

  // ── Floor & aisle carpet ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 40), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 33.5), mat.red);
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.01, 2.75); scene.add(carpet);

  // ── Walls ──
  box(0.4, 10, 40, mat.wall, -10.2, 5, 0);
  box(0.4, 10, 40, mat.wall, 10.2, 5, 0);
  box(20.8, 10, 0.4, mat.wall, 0, 5, -20.2);
  // front wall with a doorway
  box(8.2, 10, 0.4, mat.wall, -6.3, 5, 20.2);
  box(8.2, 10, 0.4, mat.wall, 6.3, 5, 20.2);
  box(4.4, 4, 0.4, mat.wall, 0, 8, 20.2);
  const door = box(4.4, 6, 0.1, new THREE.MeshBasicMaterial({ color: 0xfff3d6 }), 0, 3, 20.35); // bright daylight outside
  door.material.toneMapped = false;
  // baseboard trim
  box(0.1, 0.5, 40, mat.trim, -9.95, 0.25, 0);
  box(0.1, 0.5, 40, mat.trim, 9.95, 0.25, 0);

  // gables + roof
  const gableShape = new THREE.Shape([new THREE.Vector2(-10.4, 0), new THREE.Vector2(10.4, 0), new THREE.Vector2(0, 5.2)]);
  const gableGeo = new THREE.ShapeGeometry(gableShape);
  [-20.2, 20.2].forEach(z => { const g = new THREE.Mesh(gableGeo, mat.wall); g.position.set(0, 10, z); scene.add(g); const g2 = g.clone(); g2.rotation.y = Math.PI; scene.add(g2); });
  const slope = Math.atan2(5, 10), roofLen = Math.hypot(10, 5) + 0.6;
  [-1, 1].forEach(side => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(roofLen, 0.3, 41), mat.darkWood);
    r.position.set(side * 5, 12.5, 0); r.rotation.z = -side * slope; scene.add(r);
  });
  for (let z = -18; z <= 18; z += 4) {
    box(20, 0.4, 0.4, mat.darkWood, 0, 10, z); // tie beams
    [-1, 1].forEach(side => { const b = box(roofLen - 0.6, 0.35, 0.35, mat.darkWood, side * 5, 12.3, z); b.rotation.z = -side * slope; });
  }

  // pillars between windows
  [-14, -6, 2, 10].forEach(z => [-1, 1].forEach(side => {
    box(0.8, 10, 0.8, mat.trim, side * 9.6, 5, z);
    addCollider(side * 9.6, z, 0.8, 0.8);
  }));

  // ── Stained glass windows ──
  const palettes = [
    ['#1d3f9e', '#2a5bd7', '#c0282d', '#e8b83a', '#1d3f9e'],
    ['#2f8f5b', '#e8b83a', '#1f8fbf', '#7b3fb0', '#2f8f5b'],
    ['#c0282d', '#e8b83a', '#7b3fb0', '#1d3f9e', '#c0282d'],
  ];
  let seed = 7;
  [-10, -2, 6].forEach((z, i) => [-1, 1].forEach(side => {
    const m = new THREE.MeshBasicMaterial({ map: stainedGlassTexture(seed += 13, palettes[i]), toneMapped: false });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.8), m);
    w.position.set(side * 9.98, 5.2, z); w.rotation.y = -side * Math.PI / 2; scene.add(w);
  }));
  const rose = new THREE.Mesh(new THREE.CircleGeometry(2.1, 48), new THREE.MeshBasicMaterial({ map: roseWindowTexture(), toneMapped: false }));
  rose.position.set(0, 11.6, -19.97); scene.add(rose);

  // ── Altar platform, table, cross ──
  box(16, 0.6, 6, mat.wood, 0, 0.3, -17);
  box(16.2, 0.08, 6.2, mat.darkWood, 0, 0.62, -17);
  box(4, 1.1, 1.4, mat.white, 0, 1.15, -18); // altar table
  box(4.2, 0.08, 1.6, mat.gold, 0, 1.74, -18);
  addCollider(0, -18, 4.2, 1.6);
  box(0.5, 6, 0.3, mat.gold, 0, 5.5, -19.8);
  box(3.0, 0.5, 0.3, mat.gold, 0, 7.0, -19.8);
  // altar candles
  const glowTex = glowSprite();
  const flame = (x, y, z, size = 0.5) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.set(x, y, z); s.scale.setScalar(size); scene.add(s); return s;
  };
  const flames = [];
  [-1.5, 1.5].forEach(x => { box(0.12, 0.6, 0.12, mat.white, x, 2.08, -18); flames.push(flame(x, 2.48, -18)); });

  // ── Pews ──
  const pewSeat = new THREE.BoxGeometry(5.8, 0.15, 0.55);
  const pewBack = new THREE.BoxGeometry(5.8, 0.8, 0.12);
  const pewEnd = new THREE.BoxGeometry(0.12, 1.0, 0.7);
  const rows = []; for (let z = -10; z <= 9.5; z += 1.75) rows.push(z);
  const count = rows.length * 2;
  const seats = new THREE.InstancedMesh(pewSeat, mat.wood, count);
  const backs = new THREE.InstancedMesh(pewBack, mat.wood, count);
  const ends = new THREE.InstancedMesh(pewEnd, mat.darkWood, count * 2);
  const m4 = new THREE.Matrix4();
  let i = 0, e = 0;
  rows.forEach(z => [-1, 1].forEach(side => {
    const cx = side * 4.85;
    seats.setMatrixAt(i, m4.makeTranslation(cx, 0.48, z));
    backs.setMatrixAt(i, m4.makeTranslation(cx, 0.9, z + 0.3));
    ends.setMatrixAt(e++, m4.makeTranslation(cx - 2.9, 0.5, z + 0.05));
    ends.setMatrixAt(e++, m4.makeTranslation(cx + 2.9, 0.5, z + 0.05));
    addCollider(cx, z + 0.05, 6.0, 0.75);
    i++;
  }));
  scene.add(seats, backs, ends);

  // ── Lectern with the Bible ──
  const BIBLE = new THREE.Vector3(0, 0.6, -14.9);
  const lectern = new THREE.Group(); lectern.position.copy(BIBLE); scene.add(lectern);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 1.1, 12), mat.darkWood); post.position.y = 0.55; lectern.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.12, 16), mat.darkWood); base.position.y = 0.06; lectern.add(base);
  const top = new THREE.Group(); top.position.set(0, 1.18, 0); top.rotation.x = 0.35; lectern.add(top);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.0), mat.darkWood); top.add(desk);
  const cover = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.06, 0.92), new THREE.MeshStandardMaterial({ color: 0x4a1418, roughness: 0.6 })); cover.position.y = 0.07; top.add(cover);
  addCollider(BIBLE.x, BIBLE.z, 1.4, 1.1);

  const pageTex = textTexture({ width: 512, height: 512, bg: '#fbf3df', draw: (ctx, { width, height, wrap }, verse) => {
    ctx.fillStyle = '#c9b68f'; ctx.fillRect(0, 0, width, 6); ctx.fillRect(0, height - 6, width, 6);
    if (!verse) return;
    ctx.fillStyle = '#5b3a1a'; ctx.textAlign = 'center';
    ctx.font = `bold 44px ${SERIF}`; ctx.fillText(verse.ref, width / 2, 90);
    ctx.font = `30px ${SERIF}`; ctx.fillStyle = '#3a2a1a';
    wrap(verse.text, width - 70).slice(0, 9).forEach((l, k) => ctx.fillText(l, width / 2, 160 + k * 40));
  }});
  const pageMat = new THREE.MeshStandardMaterial({ map: pageTex.texture, roughness: 0.9 });
  const blankMat = new THREE.MeshStandardMaterial({ color: 0xfbf3df, roughness: 0.9 });
  [-1, 1].forEach(side => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.86), side < 0 ? blankMat : pageMat);
    p.rotation.x = -Math.PI / 2; p.rotation.y = side * 0.12;
    p.position.set(side * 0.33, 0.11, 0); top.add(p);
  });
  // invisible, generous hit target for tapping the Bible
  const bibleHit = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 1.6), new THREE.MeshBasicMaterial({ visible: false }));
  bibleHit.position.set(BIBLE.x, BIBLE.y + 1.1, BIBLE.z); bibleHit.userData.action = 'verse'; scene.add(bibleHit);
  interactables.push({ action: 'verse', label: 'Read today\'s verse', pos: new THREE.Vector3(BIBLE.x, 0, BIBLE.z + 1.2), mesh: bibleHit });

  // Floating verse that rises out of the Bible
  const floatTex = textTexture({ width: 1024, height: 560, draw: (ctx, { width, height, wrap }, verse) => {
    if (!verse) return;
    // soft oval backing so the text stays readable against the bright cross
    ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(1, height / width);
    const g = ctx.createRadialGradient(0, 0, 40, 0, 0, width / 2);
    g.addColorStop(0, 'rgba(40, 24, 8, 0.88)'); g.addColorStop(0.7, 'rgba(40, 24, 8, 0.7)'); g.addColorStop(1, 'rgba(40, 24, 8, 0)');
    ctx.fillStyle = g; ctx.fillRect(-width / 2, -width / 2, width, width); ctx.restore();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 200, 90, 0.95)'; ctx.shadowBlur = 24;
    ctx.fillStyle = '#fff8e2'; ctx.font = `46px ${SERIF}`;
    const lines = wrap(verse.text, width - 120).slice(0, 7);
    const lh = 58, startY = (height - (lines.length * lh + 70)) / 2 + 46;
    lines.forEach((l, k) => ctx.fillText(l, width / 2, startY + k * lh));
    ctx.font = `italic bold 40px ${SERIF}`; ctx.fillStyle = '#ffd36b';
    ctx.fillText('— ' + verse.ref, width / 2, startY + lines.length * lh + 30);
  }});
  const floatMat = new THREE.MeshBasicMaterial({ map: floatTex.texture, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const verseBoard = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.5), floatMat);
  verseBoard.position.copy(BIBLE); scene.add(verseBoard);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffcf70, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(9, 5.5, 1); scene.add(halo);

  // light particles streaming from the book up to the verse
  const N = 70, pPos = new Float32Array(N * 3), pSpeed = new Float32Array(N);
  const resetP = (k, randomY) => {
    pPos[k * 3] = BIBLE.x + (Math.random() - 0.5) * 1.0;
    pPos[k * 3 + 1] = BIBLE.y + 1.3 + (randomY ? Math.random() * 2.6 : 0);
    pPos[k * 3 + 2] = BIBLE.z + (Math.random() - 0.5) * 0.7;
    pSpeed[k] = 0.5 + Math.random() * 0.9;
  };
  for (let k = 0; k < N; k++) resetP(k, true);
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.22, color: 0xffe2a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(particles);
  const bookGlow = new THREE.PointLight(0xffd88a, 6, 6, 2); bookGlow.position.set(BIBLE.x, BIBLE.y + 1.8, BIBLE.z); scene.add(bookGlow);

  let riseStart = -1;
  function setVerse(v) { pageTex.redraw(v); floatTex.redraw(v); riseStart = -1; }

  // ── Prayer wall (left) and Answered wall (right), near the entrance ──
  const noteColors = ['#fff3a8', '#ffd6e0', '#d6f0ff', '#dfffd6', '#ffe4c4', '#e8dcff'];
  const makeWall = (title, accent, answered) => textTexture({ width: 1024, height: 720, bg: answered ? '#2b2416' : '#3b2a1d', draw: (ctx, { width, height, wrap }, list = []) => {
    ctx.strokeStyle = accent; ctx.lineWidth = 14; ctx.strokeRect(7, 7, width - 14, height - 14);
    ctx.textAlign = 'center'; ctx.fillStyle = accent; ctx.font = `bold 60px ${SERIF}`; ctx.fillText(title, width / 2, 82);
    ctx.font = `28px ${SERIF}`; ctx.fillStyle = '#e8dcc6';
    ctx.fillText(list.length ? 'Tap to read and pray along' : (answered ? 'Answers will be shared here' : 'Be the first to share a request'), width / 2, 126);
    list.slice(0, 6).forEach((p, k) => {
      const col = k % 3, row = Math.floor(k / 3);
      const x = 40 + col * 322, y = 160 + row * 270, w = 300, h = 250;
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(((k * 37) % 7 - 3) * 0.012);
      ctx.fillStyle = answered ? '#fff4cf' : noteColors[k % noteColors.length]; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = '#c0282d'; ctx.beginPath(); ctx.arc(0, -h / 2 + 16, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2118'; ctx.textAlign = 'left'; ctx.font = `25px ${SERIF}`;
      const text = answered && p.testimony ? p.testimony : p.text;
      const lines = wrap(text, w - 36);
      lines.slice(0, 6).forEach((l, j) => ctx.fillText(j === 5 && lines.length > 6 ? l + '…' : l, -w / 2 + 18, -h / 2 + 56 + j * 30));
      ctx.font = `italic 22px ${SERIF}`; ctx.fillStyle = '#6b4a2a';
      ctx.fillText(answered ? 'Answered' : `${p.prayCount || 0} praying`, -w / 2 + 18, h / 2 - 16);
      ctx.restore();
    });
  }});
  const prayerTex = makeWall('Prayer Wall', '#e8b83a', false);
  const answeredTex = makeWall('Answered Prayers', '#ffd36b', true);
  const wallPanel = (tex, side, action, label) => {
    const frame = box(0.15, 4.0, 5.6, mat.darkWood, side * 9.92, 2.9, 14);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 3.73), new THREE.MeshBasicMaterial({ map: tex.texture, toneMapped: false }));
    m.position.set(side * 9.82, 2.9, 14); m.rotation.y = -side * Math.PI / 2; m.userData.action = action; scene.add(m);
    frame.userData.action = action;
    interactables.push({ action, label, pos: new THREE.Vector3(side * 8, 0, 14), mesh: m });
  };
  wallPanel(prayerTex, -1, 'prayers', 'Open the Prayer Wall');
  wallPanel(answeredTex, 1, 'answered', 'See answered prayers');

  // votive candle stand under the prayer wall
  box(0.6, 1.0, 3.0, mat.darkWood, -9.4, 0.5, 14);
  addCollider(-9.4, 14, 0.8, 3.2);
  for (let k = 0; k < 10; k++) {
    const x = -9.55 + (k % 2) * 0.3, z = 12.8 + Math.floor(k / 2) * 0.6;
    box(0.12, 0.2, 0.12, mat.white, x, 1.1, z);
    flames.push(flame(x, 1.3, z, 0.35));
  }
  // flower stand under the answered wall
  box(0.6, 1.0, 3.0, mat.darkWood, 9.4, 0.5, 14);
  addCollider(9.4, 14, 0.8, 3.2);
  const petal = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a3a });
  for (let k = 0; k < 7; k++) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), k % 2 ? petal : new THREE.MeshStandardMaterial({ color: 0xffd36b }));
    fl.position.set(9.4 + (Math.random() - 0.5) * 0.3, 1.35 + Math.random() * 0.25, 12.8 + k * 0.4); scene.add(fl);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4), leaf); st.position.set(fl.position.x, 1.15, fl.position.z); scene.add(st);
  }

  function setPrayers(list) {
    prayerTex.redraw(list.filter(p => !p.answered));
    answeredTex.redraw(list.filter(p => p.answered).sort((a, b) => (b.answeredAt || 0) - (a.answeredAt || 0)));
  }

  function update(dt, t, camera) {
    if (riseStart < 0) riseStart = t;
    const p = Math.min(1, (t - riseStart) / 3.0);
    const ease = 1 - Math.pow(1 - p, 3);
    const y = BIBLE.y + 1.4 + ease * 2.4 + Math.sin(t * 1.2) * 0.08 * ease;
    verseBoard.position.set(BIBLE.x, y, BIBLE.z);
    verseBoard.scale.setScalar(0.2 + 0.8 * ease);
    floatMat.opacity = ease;
    verseBoard.rotation.y = Math.atan2(camera.position.x - BIBLE.x, camera.position.z - BIBLE.z) * 0.6;
    halo.position.set(BIBLE.x, y, BIBLE.z - 0.1);
    halo.material.opacity = 0.3 * ease + Math.sin(t * 2) * 0.04;
    const pos = pGeo.attributes.position;
    for (let k = 0; k < N; k++) {
      pPos[k * 3 + 1] += pSpeed[k] * dt;
      pPos[k * 3] += Math.sin(t * 2 + k) * 0.002;
      if (pPos[k * 3 + 1] > BIBLE.y + 4.0) resetP(k, false);
    }
    pos.needsUpdate = true;
    bookGlow.intensity = 5 + Math.sin(t * 3) * 1;
    flames.forEach((f, k) => { const s = f.userData.base || (f.userData.base = f.scale.x); f.scale.setScalar(s * (0.9 + 0.15 * Math.sin(t * 9 + k * 1.7))); });
  }

  return { colliders, interactables, setVerse, setPrayers, update, biblePos: BIBLE };
}
