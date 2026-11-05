import * as THREE from './three.js';

export const AVATAR_OPTIONS = {
  outfit: ['#2a5bd7', '#c0282d', '#2f8f5b', '#7b3fb0', '#e8b83a', '#f2f2f2', '#333a45', '#e57aa6'],
  skin: ['#f6d7bd', '#e8b98f', '#c98e62', '#8d5a3b', '#5a3824'],
  hair: ['#1c1410', '#5a3a1e', '#b07a3a', '#d8c27a', '#9a9a9a'],
  style: [
    { id: 'robe', label: 'Robe' },
    { id: 'casual', label: 'Casual' },
    { id: 'little', label: 'Little one' },
  ],
  accessory: [
    { id: 'none', label: 'None' },
    { id: 'hat', label: 'Hat' },
    { id: 'flowers', label: 'Flower crown' },
    { id: 'scarf', label: 'Scarf' },
  ],
};

export function randomAvatar() {
  const pick = a => a[Math.floor(Math.random() * a.length)];
  return {
    outfit: pick(AVATAR_OPTIONS.outfit), skin: pick(AVATAR_OPTIONS.skin), hair: pick(AVATAR_OPTIONS.hair),
    style: pick(AVATAR_OPTIONS.style).id, accessory: 'none',
  };
}

function nameTag(name) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 54px system-ui, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const w = Math.min(500, ctx.measureText(name).width + 56);
  ctx.fillStyle = 'rgba(20, 16, 12, 0.6)';
  const x = (512 - w) / 2, r = 40;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, 20, w, 88, r) : ctx.rect(x, 20, w, 88); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(name, 256, 66, 470);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1); s.renderOrder = 10;
  return s;
}

export function createAvatar(profile) {
  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig); // bobbing part
  let tag = null, tagVisible = true;

  function build(p) {
    rig.clear();
    const a = { ...randomAvatar(), ...(p.avatar || {}) };
    const outfit = new THREE.MeshStandardMaterial({ color: a.outfit, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: a.skin, roughness: 0.7 });
    const hair = new THREE.MeshStandardMaterial({ color: a.hair, roughness: 0.9 });
    const scale = a.style === 'little' ? 0.72 : 1;

    let body;
    if (a.style === 'robe') {
      body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 16, 1, true), outfit); body.position.y = 0.78;
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 6, 16), new THREE.MeshStandardMaterial({ color: 0xd9a830 }));
      belt.rotation.x = Math.PI / 2; belt.position.y = 1.08; rig.add(belt);
    } else {
      body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.7, 6, 12), outfit); body.position.y = 0.85;
      const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x2c3340 }));
      legs.position.y = 0.25; rig.add(legs);
    }
    rig.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), skin); head.position.y = 1.78; rig.add(head);
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.315, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.y = 1.8; hairCap.rotation.x = -0.25; rig.add(hairCap);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1410 });
    [-0.1, 0.1].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat); e.position.set(x, 1.8, 0.27); rig.add(e); });
    const arms = [-1, 1].map(side => {
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.5, 4, 8), outfit);
      arm.geometry.translate(0, -0.3, 0); arm.position.set(side * 0.38, 1.4, 0); rig.add(arm); return arm;
    });
    rig.userData.arms = arms;

    if (a.accessory === 'hat') {
      const hm = new THREE.MeshStandardMaterial({ color: 0x3a2a1d });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 20), hm); brim.position.y = 2.0; rig.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.32, 20), hm); crown.position.y = 2.16; rig.add(crown);
    } else if (a.accessory === 'flowers') {
      const cols = [0xff8fb1, 0xffffff, 0xffd36b];
      for (let k = 0; k < 9; k++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: cols[k % 3] }));
        const ang = (k / 9) * Math.PI * 2; f.position.set(Math.cos(ang) * 0.28, 2.0, Math.sin(ang) * 0.28); rig.add(f);
      }
    } else if (a.accessory === 'scarf') {
      const sc = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.08, 8, 20), new THREE.MeshStandardMaterial({ color: 0xc0282d }));
      sc.rotation.x = Math.PI / 2; sc.position.y = 1.5; rig.add(sc);
    }
    rig.scale.setScalar(scale);

    if (tag) root.remove(tag);
    tag = nameTag(p.name || 'Guest');
    tag.position.y = 2.55 * scale + 0.2; tag.visible = tagVisible; root.add(tag);
    root.userData.key = JSON.stringify([p.name, a]);
  }

  build(profile);
  let phase = 0;
  return {
    showTag(v) { tagVisible = v; if (tag) tag.visible = v; },
    object: root,
    setProfile(p) { const a = { ...randomAvatar(), ...(p.avatar || {}) }; if (JSON.stringify([p.name, a]) !== root.userData.key) build(p); },
    animate(dt, moving) {
      phase += dt * (moving ? 10 : 2);
      const amt = moving ? 1 : 0.15;
      rig.position.y = Math.abs(Math.sin(phase)) * 0.08 * amt;
      const [l, r] = rig.userData.arms || [];
      if (l) { l.rotation.x = Math.sin(phase) * 0.6 * amt; r.rotation.x = -Math.sin(phase) * 0.6 * amt; }
    },
    dispose() { root.traverse(o => { o.geometry && o.geometry.dispose(); }); },
  };
}
