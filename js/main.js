import * as THREE from './three.js';
import { buildChurch, BOUNDS, ALTAR_Z, SPAWN } from './church.js';
import { createAvatar, AVATAR_OPTIONS, randomAvatar } from './avatar.js';
import { verseForToday } from './verses.js';
import { createStore } from './store.js';

const CFG = window.CHURCH_CONFIG || {};
const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const storage = (() => { try { localStorage.setItem('__t', '1'); return localStorage; } catch { return { getItem() { return null; }, setItem() {} }; } })();

// ───────────────────────── Scene ─────────────────────────
const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.75 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c140e);
scene.fog = new THREE.Fog(0x2a1e14, 30, 70);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 120);

const church = buildChurch(scene);
const verse = verseForToday();
church.setVerse(verse);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 70 : 60; // a bit wider on portrait phones
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

// ───────────────────────── Player ─────────────────────────
const saved = (() => { try { return JSON.parse(storage.getItem('church.profile') || 'null'); } catch { return null; } })();
const profile = saved || { name: '', avatar: randomAvatar() };
const me = createAvatar({ ...profile, name: profile.name || 'You' });
scene.add(me.object);
const player = { x: SPAWN.x, z: SPAWN.z, ry: SPAWN.ry, moving: false };
const RADIUS = 0.35, SPEED = 4.2;

function collides(x, z) {
  if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) return true;
  for (const c of church.colliders) {
    if (x + RADIUS > c.minX && x - RADIUS < c.maxX && z + RADIUS > c.minZ && z - RADIUS < c.maxZ) return true;
  }
  return false;
}
const floorY = (z) => (z < ALTAR_Z ? 0.6 : 0);

// ───────────────────────── Input ─────────────────────────
const keys = new Set();
const joy = { x: 0, y: 0 };
let camYaw = 0, camPitch = 0.26; // yaw 0 => camera behind player looking toward the altar (-z)
let uiOpen = true; // avatar picker is open at start

window.addEventListener('keydown', (e) => { if (!e.target.closest('input, textarea')) keys.add(e.key.toLowerCase()); });
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

// drag to look + tap to interact
const drag = { id: null, x: 0, y: 0, moved: 0 };
canvas.addEventListener('pointerdown', (e) => { if (drag.id !== null) return; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY; drag.moved = 0; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
  camYaw -= dx * 0.006;
  camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.004, 0.02, 1.1);
});
const endDrag = (e) => {
  if (e.pointerId !== drag.id) return;
  drag.id = null;
  if (drag.moved < 8 && !uiOpen) tapAt(e.clientX, e.clientY);
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (e) => { if (e.pointerId === drag.id) drag.id = null; });

const raycaster = new THREE.Raycaster();
function tapAt(x, y) {
  const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(church.interactables.map(i => i.mesh), false);
  if (hits.length && hits[0].distance < 30) openPanel(hits[0].object.userData.action);
}

// virtual joystick
const joyEl = $('#joystick'), stick = joyEl.querySelector('.stick');
let joyId = null;
const joyMove = (e) => {
  const r = joyEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2 - 10, len = Math.hypot(dx, dy);
  if (len > max) { dx *= max / len; dy *= max / len; }
  joy.x = dx / max; joy.y = dy / max;
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
};
joyEl.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; joy.x = joy.y = 0; stick.style.transform = ''; };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);

// ───────────────────────── Other people ─────────────────────────
const others = new Map(); // id -> {avatar, target, ...}
function syncOthers(map) {
  for (const [id, o] of others) if (!map[id]) { scene.remove(o.avatar.object); o.avatar.dispose(); others.delete(id); }
  for (const id in map) {
    const s = map[id];
    if (typeof s.x !== 'number') continue;
    let o = others.get(id);
    if (!o) {
      o = { avatar: createAvatar(s), x: s.x, z: s.z, ry: s.ry || 0 };
      o.avatar.object.position.set(s.x, floorY(s.z), s.z);
      scene.add(o.avatar.object); others.set(id, o);
    } else o.avatar.setProfile(s);
    Object.assign(o, { tx: s.x, tz: s.z, try: s.ry || 0, moving: !!s.moving });
  }
  $('#online-count').textContent = others.size + 1;
}

// ───────────────────────── Loop ─────────────────────────
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
let nearest = null, lastSent = 0, lastSentKey = '';
const interactBtn = $('#interact');

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;

  // movement in camera space
  let mx = 0, mz = 0;
  if (!uiOpen) {
    if (keys.has('w') || keys.has('arrowup')) mz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) mz += 1;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    mx += joy.x; mz += joy.y;
  }
  const len = Math.hypot(mx, mz);
  player.moving = len > 0.15;
  if (player.moving) {
    if (len > 1) { mx /= len; mz /= len; }
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    const wx = mx * cos + mz * sin, wz = -mx * sin + mz * cos;
    const step = SPEED * dt;
    const nx = player.x + wx * step, nz = player.z + wz * step;
    if (!collides(nx, player.z)) player.x = nx;
    if (!collides(player.x, nz)) player.z = nz;
    const targetRy = Math.atan2(wx, wz);
    let d = targetRy - player.ry; d = Math.atan2(Math.sin(d), Math.cos(d));
    player.ry += d * Math.min(1, dt * 12);
  }
  const py = THREE.MathUtils.lerp(me.object.position.y, floorY(player.z), Math.min(1, dt * 10));
  me.object.position.set(player.x, py, player.z);
  me.object.rotation.y = player.ry;
  me.animate(dt, player.moving);

  // camera
  if (uiOpen && $('#panel-avatar').hidden === false) {
    // showcase the avatar while it is being customised
    const wide = window.innerWidth >= 900;
    camera.position.set(player.x + (wide ? 1.4 : 0), py + 1.7, player.z - 4.6);
    camTarget.set(player.x + (wide ? 1.4 : 0), py + (wide ? 1.1 : 0.35), player.z);
    me.object.rotation.y = Math.PI + Math.sin(t * 0.6) * 0.5;
  } else {
    const dist = camera.aspect < 1 ? 7 : 5.5;
    const back = new THREE.Vector3(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
    const desired = new THREE.Vector3(player.x, py + 1.6, player.z).addScaledVector(back, dist);
    desired.x = THREE.MathUtils.clamp(desired.x, -9.6, 9.6);
    desired.z = THREE.MathUtils.clamp(desired.z, -19.6, 19.8);
    desired.y = THREE.MathUtils.clamp(desired.y, 0.8, 9.5);
    camera.position.lerp(desired, Math.min(1, dt * 8));
    // look up toward the floating verse when standing near the Bible
    const nearBible = THREE.MathUtils.clamp(1 - (Math.hypot(player.x - church.biblePos.x, player.z - church.biblePos.z) - 3) / 5, 0, 1);
    const lookY = py + (camera.aspect < 1 ? 2.0 : 1.5) + nearBible * 1.8;
    camTarget.set(player.x, THREE.MathUtils.lerp(camTarget.y || lookY, lookY, Math.min(1, dt * 4)), player.z);
  }
  camera.lookAt(camTarget);

  // others: smooth toward their latest reported position
  for (const o of others.values()) {
    const k = Math.min(1, dt * 8);
    o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k;
    let d = o.try - o.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); o.ry += d * k;
    o.avatar.object.position.set(o.x, THREE.MathUtils.lerp(o.avatar.object.position.y, floorY(o.z), k), o.z);
    o.avatar.object.rotation.y = o.ry;
    o.avatar.animate(dt, o.moving);
  }

  church.update(dt, t, camera);

  // nearest interactable
  let best = null, bestD = 3.2;
  for (const it of church.interactables) { const d = Math.hypot(it.pos.x - player.x, it.pos.z - player.z); if (d < bestD) { best = it; bestD = d; } }
  if (best !== nearest) {
    nearest = best;
    interactBtn.hidden = !best || uiOpen;
    if (best) interactBtn.textContent = best.label;
  }

  // presence (throttled; only when something changed)
  if (enteredAt && store && t - lastSent > 0.15) {
    const state = { name: profile.name, avatar: profile.avatar, x: +player.x.toFixed(2), z: +player.z.toFixed(2), ry: +player.ry.toFixed(2), moving: player.moving };
    const key = JSON.stringify(state);
    if (key !== lastSentKey || t - lastSent > 2) { store.updatePresence(state); lastSentKey = key; lastSent = t; }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ───────────────────────── Panels ─────────────────────────
const panels = ['avatar', 'verse', 'prayers', 'answer'];
let enteredAt = 0;
function closePanels() { me.showTag(false); panels.forEach(p => { $('#panel-' + p).hidden = true; }); uiOpen = false; interactBtn.hidden = !nearest; }
function openPanel(name, opts = {}) {
  if (name === 'share') return shareInvite();
  closePanels();
  if (name === 'answered') { name = 'prayers'; opts.tab = 'answered'; }
  $('#panel-' + name).hidden = false;
  uiOpen = true; interactBtn.hidden = true; keys.clear();
  if (name === 'prayers') setTab(opts.tab || 'active');
  if (name === 'avatar') { renderAvatarPicker(); me.showTag(true); }
}
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openPanel(b.dataset.open)));
document.querySelectorAll('.sheet .close').forEach(b => b.addEventListener('click', closePanels));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && enteredAt) closePanels();
  if ((e.key === 'e' || e.key === 'Enter') && !uiOpen && nearest && !e.target.closest('input, textarea, button')) openPanel(nearest.action);
});
interactBtn.addEventListener('click', () => nearest && openPanel(nearest.action));

// avatar picker
function renderAvatarPicker() {
  $('#name').value = profile.name || '';
  document.querySelectorAll('[data-key]').forEach(group => {
    const key = group.dataset.key, opts = AVATAR_OPTIONS[key];
    group.innerHTML = '';
    opts.forEach(o => {
      const value = typeof o === 'string' ? o : o.id;
      const b = document.createElement('button'); b.type = 'button';
      if (typeof o === 'string') { b.style.background = o; b.setAttribute('aria-label', key + ' ' + o); }
      else b.textContent = o.label;
      if (profile.avatar[key] === value) b.classList.add('on');
      b.addEventListener('click', () => { profile.avatar[key] = value; renderAvatarPicker(); refreshMe(); });
      group.appendChild(b);
    });
  });
  $('#enter').textContent = enteredAt ? 'Save' : 'Enter the church';
  $('.welcome').textContent = enteredAt ? 'Your avatar' : 'Welcome';
}
function refreshMe() { me.setProfile({ ...profile, name: profile.name || 'You' }); }
$('#name').addEventListener('input', (e) => { profile.name = e.target.value.trim().slice(0, 24); refreshMe(); });
$('#enter').addEventListener('click', () => {
  if (!profile.name) { $('#name').focus(); toast('Please enter a name'); return; }
  storage.setItem('church.profile', JSON.stringify(profile));
  closePanels();
  if (!enteredAt) {
    enteredAt = Date.now();
    camYaw = 0;
    document.querySelector('.hud-top').hidden = false;
    joyEl.hidden = !isTouch;
    const hint = $('#hint'); hint.hidden = false;
    if (isTouch) hint.textContent = 'Drag to look · joystick to walk · tap the Bible or a wall';
    setTimeout(() => { hint.style.opacity = 0; }, 7000);
    if (store && store.mode === 'demo') $('#demo-banner').hidden = false;
    setTimeout(() => { $('#demo-banner').hidden = true; }, 8000);
  }
});

// verse panel
$('#verse-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
$('#verse-text').textContent = verse.text;
$('#verse-ref').textContent = verse.ref;
$('#share-verse').addEventListener('click', () => share({
  title: `Today's verse · ${verse.ref}`,
  text: `"${verse.text}" — ${verse.ref}`,
}));

// prayers panel
let store = null, prayers = [], tab = 'active', answeringId = null;
function setTab(name) {
  tab = name;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $('#prayer-form').hidden = name !== 'active';
  renderPrayers();
}
document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

function timeAgo(ts) {
  const s = Math.max(1, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function renderPrayers() {
  const list = $('#prayer-list'); list.innerHTML = '';
  const items = tab === 'active' ? prayers.filter(p => !p.answered) : prayers.filter(p => p.answered).sort((a, b) => (b.answeredAt || 0) - (a.answeredAt || 0));
  if (!items.length) { list.appendChild(el('li', 'empty', tab === 'active' ? 'No requests yet. Share the first one.' : 'No answered prayers yet. When God answers, mark your request as answered to encourage others.')); return; }
  for (const p of items) {
    const li = el('li', 'prayer' + (p.answered ? ' answered' : ''));
    const meta = el('div', 'meta');
    meta.append(el('span', '', (p.name || 'Anonymous') + (p.mine ? ' (you)' : '')), el('span', '', p.answered ? 'Answered ' + timeAgo(p.answeredAt || p.createdAt) : timeAgo(p.createdAt)));
    li.append(meta, el('p', 'text', p.text));
    if (p.answered && p.testimony) li.append(el('p', 'testimony', p.testimony));
    const actions = el('div', 'actions');
    const pray = el('button', p.iPrayed ? 'prayed' : '', (p.answered ? '🙌 ' : '🙏 ') + (p.iPrayed ? 'Prayed' : (p.answered ? 'Amen' : 'I prayed')) + ` · ${p.prayCount || 0}`);
    pray.disabled = !!p.iPrayed;
    pray.addEventListener('click', async () => { await store.prayFor(p.id).catch(err); toast(p.answered ? 'Amen!' : 'Thank you for praying 🙏'); });
    actions.append(pray);
    if (p.mine && !p.answered) {
      const ans = el('button', '', '✨ Mark answered');
      ans.addEventListener('click', () => { answeringId = p.id; $('#testimony').value = ''; openPanel('answer'); });
      actions.append(ans);
    }
    if (p.mine) {
      const del = el('button', 'link', 'Delete');
      del.addEventListener('click', async () => { if (confirm('Delete this prayer request?')) await store.deletePrayer(p.id).catch(err); });
      actions.append(del);
    }
    li.append(actions);
    list.appendChild(li);
  }
}
$('#prayer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('#prayer-text').value;
  const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true;
  try {
    await store.addPrayer({ name: profile.name, text, anonymous: $('#anon').checked });
    $('#prayer-text').value = '';
    toast('Your request is on the Prayer Wall');
  } catch (ex) { err(ex); }
  btn.disabled = false;
});
$('#confirm-answer').addEventListener('click', async () => {
  if (!answeringId) return;
  await store.markAnswered(answeringId, $('#testimony').value).catch(err);
  answeringId = null;
  openPanel('prayers', { tab: 'answered' });
  toast('Praise God! 🙌');
});

// ───────────────────────── Sharing (KakaoTalk / share sheet / copy) ─────────────────────────
const pageUrl = location.href.split('#')[0];
let kakaoReady = null;
function loadKakao() {
  if (!CFG.kakaoJsKey) return Promise.resolve(false);
  if (kakaoReady) return kakaoReady;
  kakaoReady = new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = () => { try { if (!window.Kakao.isInitialized()) window.Kakao.init(CFG.kakaoJsKey); resolve(true); } catch { resolve(false); } };
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return kakaoReady;
}
async function share({ title, text }) {
  if (await loadKakao()) {
    try {
      const img = document.querySelector('meta[property="og:image"]').content;
      window.Kakao.Share.sendDefault({
        objectType: 'feed',
        content: { title, description: text.slice(0, 200), imageUrl: img, link: { mobileWebUrl: pageUrl, webUrl: pageUrl } },
        buttons: [{ title: 'Enter the church', link: { mobileWebUrl: pageUrl, webUrl: pageUrl } }],
      });
      return;
    } catch (e) { console.warn('Kakao share failed', e); }
  }
  if (navigator.share) { try { await navigator.share({ title, text, url: pageUrl }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  const payload = `${text}\n${pageUrl}`;
  try { await navigator.clipboard.writeText(payload); toast('Link copied — paste it into KakaoTalk'); }
  catch { prompt('Copy this link:', payload); }
}
function shareInvite() {
  share({ title: CFG.churchName || 'Metaverse Church', text: 'Come walk through our church with me, share a prayer request, and read today\'s verse.' });
}

// ───────────────────────── Utils ─────────────────────────
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200); }
function err(e) { console.error(e); toast(e && e.message ? e.message : 'Something went wrong'); }

// ───────────────────────── Boot ─────────────────────────
if (CFG.churchName) { $('#church-name').textContent = CFG.churchName; document.title = CFG.churchName; }
openPanel('avatar');
uiOpen = true;
requestAnimationFrame(frame);
setTimeout(() => { $('#loading').classList.add('fade'); }, 300);

createStore().then((s) => {
  store = s;
  store.onPrayers((list) => { prayers = list; church.setPrayers(list); if (!$('#panel-prayers').hidden) renderPrayers(); });
  store.onPresence(syncOthers);
  if (enteredAt && store.mode === 'demo') $('#demo-banner').hidden = false;
}).catch(err);
