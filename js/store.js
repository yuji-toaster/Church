// Data layer. Two interchangeable backends with the same interface:
//   LocalStore    – demo mode, no server. Prayers live in localStorage; presence
//                   is shared between tabs of the same browser via BroadcastChannel.
//   FirebaseStore – real mode. Prayers + live presence in Firebase Realtime Database.
//
// Interface:
//   await store.init()            -> resolves with this.userId
//   store.onPrayers(cb)           cb(list) on every change, newest first
//   store.addPrayer({name, text, anonymous})
//   store.prayFor(id)
//   store.markAnswered(id, testimony)
//   store.deletePrayer(id)        author only
//   store.updatePresence(state)   {name, avatar, x, y, z, ry, moving}
//   store.onPresence(cb)          cb(mapOfOthers) {id: state}
//   store.mode                    'demo' | 'live'

const MAX_TEXT = 500;
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function safeStorage() {
  try { const k = '__t'; localStorage.setItem(k, k); localStorage.removeItem(k); return localStorage; }
  catch { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
}

// ───────────────────────────── Demo backend ─────────────────────────────
class LocalStore {
  constructor() {
    this.mode = 'demo';
    this.ls = safeStorage();
    this.prayerCbs = [];
    this.presenceCbs = [];
    this.others = {};
    this.lastSeen = {};
  }

  async init() {
    this.userId = this.ls.getItem('church.userId') || randomId();
    this.ls.setItem('church.userId', this.userId);
    this.prayed = new Set(JSON.parse(this.ls.getItem('church.prayed') || '[]'));
    if (!this.ls.getItem('church.prayers')) this._save(seedPrayers());
    try {
      this.bc = new BroadcastChannel('church');
      this.bc.onmessage = (e) => this._onMessage(e.data);
    } catch { this.bc = null; }
    window.addEventListener('storage', (e) => { if (e.key === 'church.prayers') this._emitPrayers(); });
    window.addEventListener('beforeunload', () => this.bc && this.bc.postMessage({ type: 'leave', id: this.userId }));
    setInterval(() => this._expire(), 1000);
    return this.userId;
  }

  _load() { try { return JSON.parse(this.ls.getItem('church.prayers') || '[]'); } catch { return []; } }
  _save(list) { this.ls.setItem('church.prayers', JSON.stringify(list)); }
  _emitPrayers() {
    const list = this._load().sort((a, b) => b.createdAt - a.createdAt);
    list.forEach(p => { p.mine = p.authorId === this.userId; p.iPrayed = this.prayed.has(p.id); });
    this.prayerCbs.forEach(cb => cb(list));
  }
  _mutate(fn) {
    const list = this._load(); fn(list); this._save(list); this._emitPrayers();
    this.bc && this.bc.postMessage({ type: 'prayers' });
  }

  onPrayers(cb) { this.prayerCbs.push(cb); this._emitPrayers(); }

  async addPrayer({ name, text, anonymous }) {
    text = clean(text, MAX_TEXT);
    if (!text) throw new Error('Please write a prayer request.');
    this._mutate(list => list.push({
      id: randomId(), authorId: this.userId,
      name: anonymous ? '' : clean(name, 24), text,
      createdAt: Date.now(), prayCount: 0, answered: false,
    }));
  }

  async prayFor(id) {
    if (this.prayed.has(id)) return;
    this.prayed.add(id);
    this.ls.setItem('church.prayed', JSON.stringify([...this.prayed]));
    this._mutate(list => { const p = list.find(x => x.id === id); if (p) p.prayCount = (p.prayCount || 0) + 1; });
  }

  async markAnswered(id, testimony) {
    this._mutate(list => {
      const p = list.find(x => x.id === id);
      if (p && p.authorId === this.userId) { p.answered = true; p.answeredAt = Date.now(); p.testimony = clean(testimony, MAX_TEXT); }
    });
  }

  async deletePrayer(id) {
    this._mutate(list => { const i = list.findIndex(x => x.id === id && x.authorId === this.userId); if (i >= 0) list.splice(i, 1); });
  }

  updatePresence(state) {
    this.bc && this.bc.postMessage({ type: 'pos', id: this.userId, state });
  }
  onPresence(cb) { this.presenceCbs.push(cb); }

  _onMessage(msg) {
    if (!msg) return;
    if (msg.type === 'prayers') this._emitPrayers();
    else if (msg.type === 'pos') { this.others[msg.id] = msg.state; this.lastSeen[msg.id] = Date.now(); this._emitPresence(); }
    else if (msg.type === 'leave') { delete this.others[msg.id]; this._emitPresence(); }
  }
  _expire() {
    const now = Date.now(); let changed = false;
    for (const id in this.lastSeen) if (now - this.lastSeen[id] > 5000) { delete this.others[id]; delete this.lastSeen[id]; changed = true; }
    if (changed) this._emitPresence();
  }
  _emitPresence() { this.presenceCbs.forEach(cb => cb({ ...this.others })); }
}

function seedPrayers() {
  const now = Date.now(), h = 3600000;
  return [
    { id: 'seed1', authorId: 'seed', name: 'Grace', text: 'Please pray for my mother\'s surgery this Friday, that the doctors have wisdom and she recovers quickly.', createdAt: now - 5 * h, prayCount: 12, answered: false },
    { id: 'seed2', authorId: 'seed', name: '', text: 'Looking for a new job after being laid off. Praying for direction and peace while I wait.', createdAt: now - 26 * h, prayCount: 8, answered: false },
    { id: 'seed3', authorId: 'seed', name: 'Daniel', text: 'For our youth retreat next month, that hearts would be open.', createdAt: now - 72 * h, prayCount: 21, answered: true, answeredAt: now - 2 * h, testimony: 'Registration filled up and we got a scholarship donation for every student who needed one. Thank you all!' },
  ];
}

// ───────────────────────────── Firebase backend ─────────────────────────────
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

class FirebaseStore {
  constructor(config) { this.config = config; this.mode = 'live'; this.ls = safeStorage(); }

  async init() {
    const [{ initializeApp }, auth, db] = await Promise.all([
      import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-database.js'),
    ]);
    this.db = db;
    const app = initializeApp(this.config);
    const a = auth.getAuth(app);
    const cred = await auth.signInAnonymously(a);
    this.userId = cred.user.uid;
    this.database = db.getDatabase(app);
    this.prayed = new Set(JSON.parse(this.ls.getItem('church.prayed') || '[]'));

    this.presenceRef = db.ref(this.database, 'presence/' + this.userId);
    db.onDisconnect(this.presenceRef).remove();
    return this.userId;
  }

  onPrayers(cb) {
    const { ref, query, orderByChild, limitToLast, onValue } = this.db;
    const q = query(ref(this.database, 'prayers'), orderByChild('createdAt'), limitToLast(200));
    onValue(q, snap => {
      const list = [];
      snap.forEach(child => { const p = child.val(); p.id = child.key; p.mine = p.authorId === this.userId; p.iPrayed = this.prayed.has(p.id); list.push(p); });
      list.sort((a, b) => b.createdAt - a.createdAt);
      cb(list);
    });
  }

  async addPrayer({ name, text, anonymous }) {
    text = clean(text, MAX_TEXT);
    if (!text) throw new Error('Please write a prayer request.');
    const { ref, push, set, serverTimestamp } = this.db;
    await set(push(ref(this.database, 'prayers')), {
      authorId: this.userId, name: anonymous ? '' : clean(name, 24), text,
      createdAt: serverTimestamp(), prayCount: 0, answered: false,
    });
  }

  async prayFor(id) {
    if (this.prayed.has(id)) return;
    this.prayed.add(id);
    this.ls.setItem('church.prayed', JSON.stringify([...this.prayed]));
    const { ref, update, increment } = this.db;
    await update(ref(this.database, 'prayers/' + id), { prayCount: increment(1) });
  }

  async markAnswered(id, testimony) {
    const { ref, update, serverTimestamp } = this.db;
    await update(ref(this.database, 'prayers/' + id), { answered: true, answeredAt: serverTimestamp(), testimony: clean(testimony, MAX_TEXT) });
  }

  async deletePrayer(id) {
    const { ref, remove } = this.db;
    await remove(ref(this.database, 'prayers/' + id));
  }

  updatePresence(state) {
    const { set, serverTimestamp } = this.db;
    set(this.presenceRef, { ...state, t: serverTimestamp() }).catch(() => {});
  }

  onPresence(cb) {
    const { ref, onValue } = this.db;
    onValue(ref(this.database, 'presence'), snap => {
      const others = {};
      const cutoff = Date.now() - 60000;
      snap.forEach(child => {
        const v = child.val();
        if (child.key !== this.userId && v && (!v.t || v.t > cutoff)) others[child.key] = v;
      });
      cb(others);
    });
  }
}

export async function createStore() {
  const cfg = window.CHURCH_CONFIG || {};
  if (cfg.firebase) {
    try { const s = new FirebaseStore(cfg.firebase); await s.init(); return s; }
    catch (err) { console.error('Firebase failed, falling back to demo mode', err); }
  }
  const s = new LocalStore(); await s.init(); return s;
}
