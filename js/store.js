// Data layer. Two interchangeable backends with the same interface:
//   LocalStore    – demo mode, no server. Everything lives in this browser's
//                   localStorage; presence is shared between tabs via BroadcastChannel.
//   FirebaseStore – live mode. Prayers + presence in Firebase Realtime Database.
//
// Prayer visibility:
//   public  – stored under /prayers, listed for everyone, shown on the 3D wall.
//   private – stored under /private/<random id>. It can't be listed; it can only be
//             read by someone who knows the id, i.e. who received the share link.
//
// Interface (p = a prayer object from onPrayers):
//   await store.init()                  -> this.userId, this.isAdmin
//   store.onPrayers(cb)                 cb(list): public + private ones this device knows
//   store.addPrayer({name, text, anonymous, visibility}) -> {id, private}
//   store.openPrivate(id)               remember a private prayer received by link
//   store.prayFor(p) / markAnswered(p, testimony) / deletePrayer(p)
//   store.report(p) / setHidden(p, hidden)   (setHidden is admin only)
//   store.updatePresence(state) / onPresence(cb)
//   store.mode                          'demo' | 'live'

const MAX_TEXT = 500;
export const REPORT_HIDE_THRESHOLD = 3;
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// 20+ chars from a CSPRNG: private prayers are protected only by being unguessable.
export function secureId(len = 22) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => abc[b % abc.length]).join('');
}

function safeStorage() {
  try { const k = '__t'; localStorage.setItem(k, k); localStorage.removeItem(k); return localStorage; }
  catch { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
}
const readJSON = (ls, k, d) => { try { return JSON.parse(ls.getItem(k)) ?? d; } catch { return d; } };

// Shared bookkeeping for both backends.
class BaseStore {
  constructor() {
    this.ls = safeStorage();
    this.publicList = [];
    this.privateMap = {};
    this.prayerCbs = [];
    this.presenceCbs = [];
    this.known = new Set(readJSON(this.ls, 'church.knownPrivate', []));
    this.isAdmin = false;
  }
  _saveKnown() { this.ls.setItem('church.knownPrivate', JSON.stringify([...this.known])); }

  _decorate(p, isPrivate) {
    const prayedBy = p.prayedBy || {}, reports = p.reports || {};
    return {
      ...p, private: isPrivate,
      mine: p.authorId === this.userId,
      iPrayed: !!prayedBy[this.userId],
      prayCount: p.prayCount || 0,
      reportCount: Object.keys(reports).length,
      iReported: !!reports[this.userId],
    };
  }
  _emitPrayers() {
    const list = [
      ...this.publicList.map(p => this._decorate(p, false)),
      ...Object.values(this.privateMap).map(p => this._decorate(p, true)),
    ].filter(p => this.isAdmin || p.mine || !(p.hidden || p.reportCount >= REPORT_HIDE_THRESHOLD));
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    this.prayerCbs.forEach(cb => cb(list));
  }
  onPrayers(cb) { this.prayerCbs.push(cb); this._emitPrayers(); }
  onPresence(cb) { this.presenceCbs.push(cb); }

  _newPrayer({ name, text, anonymous }) {
    text = clean(text, MAX_TEXT);
    if (!text) throw new Error('Please write a prayer request.');
    return { authorId: this.userId, name: anonymous ? '' : clean(name, 24), text, prayCount: 0, answered: false };
  }
}

// ───────────────────────────── Demo backend ─────────────────────────────
class LocalStore extends BaseStore {
  constructor() { super(); this.mode = 'demo'; this.others = {}; this.lastSeen = {}; }

  async init() {
    this.userId = this.ls.getItem('church.userId') || secureId(12);
    this.ls.setItem('church.userId', this.userId);
    // demo only: add ?admin to the URL to try the moderator tools
    this.isAdmin = /[?&]admin\b/.test(location.search);
    if (!this.ls.getItem('church.prayers')) this.ls.setItem('church.prayers', JSON.stringify(seedPrayers()));
    try { this.bc = new BroadcastChannel('church'); this.bc.onmessage = (e) => this._onMessage(e.data); } catch { this.bc = null; }
    window.addEventListener('storage', (e) => { if (e.key === 'church.prayers' || e.key === 'church.privateDb') this._reload(); });
    window.addEventListener('beforeunload', () => this.bc && this.bc.postMessage({ type: 'leave', id: this.userId }));
    setInterval(() => this._expire(), 1000);
    this._reload(false);
    return this.userId;
  }

  _db() { return { pub: readJSON(this.ls, 'church.prayers', []), priv: readJSON(this.ls, 'church.privateDb', {}) }; }
  _reload(emit = true) {
    const { pub, priv } = this._db();
    this.publicList = pub;
    this.privateMap = {};
    for (const id of this.known) if (priv[id]) this.privateMap[id] = { ...priv[id], id };
    if (emit) this._emitPrayers();
  }
  _mutate(p, fn) {
    const { pub, priv } = this._db();
    const target = p.private ? priv[p.id] : pub.find(x => x.id === p.id);
    if (!target) return;
    const res = fn(target);
    if (res === 'delete') { if (p.private) delete priv[p.id]; else pub.splice(pub.indexOf(target), 1); }
    this._commit(pub, priv);
  }
  _commit(pub, priv) {
    this.ls.setItem('church.prayers', JSON.stringify(pub));
    this.ls.setItem('church.privateDb', JSON.stringify(priv));
    this._reload();
    this.bc && this.bc.postMessage({ type: 'prayers' });
  }

  async addPrayer(input) {
    const p = { ...this._newPrayer(input), createdAt: Date.now() };
    const { pub, priv } = this._db();
    const isPrivate = input.visibility === 'private';
    const id = secureId(isPrivate ? 22 : 10);
    if (isPrivate) { priv[id] = p; this.known.add(id); this._saveKnown(); }
    else pub.push({ ...p, id });
    this._commit(pub, priv);
    return { id, private: isPrivate };
  }

  async openPrivate(id) {
    if (!/^[A-Za-z0-9]{20,40}$/.test(id)) return false;
    this.known.add(id); this._saveKnown(); this._reload();
    return !!this.privateMap[id];
  }

  async prayFor(p) {
    this._mutate(p, t => {
      t.prayedBy = t.prayedBy || {};
      if (t.prayedBy[this.userId]) return;
      t.prayedBy[this.userId] = true; t.prayCount = (t.prayCount || 0) + 1;
    });
  }
  async markAnswered(p, testimony) {
    this._mutate(p, t => { if (t.authorId === this.userId) Object.assign(t, { answered: true, answeredAt: Date.now(), testimony: clean(testimony, MAX_TEXT) }); });
  }
  async deletePrayer(p) {
    this._mutate(p, t => (t.authorId === this.userId || this.isAdmin ? 'delete' : null));
    if (p.private) { this.known.delete(p.id); this._saveKnown(); }
  }
  async report(p) { this._mutate(p, t => { t.reports = t.reports || {}; t.reports[this.userId] = true; }); }
  async setHidden(p, hidden) { if (this.isAdmin) this._mutate(p, t => { t.hidden = hidden; }); }

  updatePresence(state) { this.bc && this.bc.postMessage({ type: 'pos', id: this.userId, state }); }
  _onMessage(msg) {
    if (!msg) return;
    if (msg.type === 'prayers') this._reload();
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

class FirebaseStore extends BaseStore {
  constructor(config) { super(); this.config = config; this.mode = 'live'; this.privSubs = {}; }

  async init() {
    const [{ initializeApp }, auth, db] = await Promise.all([
      import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-database.js'),
    ]);
    this.db = db;
    const app = initializeApp(this.config);
    const cred = await auth.signInAnonymously(auth.getAuth(app));
    this.userId = cred.user.uid;
    this.database = db.getDatabase(app);
    try { this.isAdmin = (await db.get(db.ref(this.database, 'admins/' + this.userId))).val() === true; } catch { this.isAdmin = false; }

    this.presenceRef = db.ref(this.database, 'presence/' + this.userId);
    db.onDisconnect(this.presenceRef).remove();

    const { ref, query, orderByChild, limitToLast, onValue } = db;
    onValue(query(ref(this.database, 'prayers'), orderByChild('createdAt'), limitToLast(300)), snap => {
      const list = [];
      snap.forEach(child => { list.push({ ...child.val(), id: child.key }); });
      this.publicList = list;
      this._emitPrayers();
    });
    for (const id of this.known) this._subscribePrivate(id);
    return this.userId;
  }

  _path(p) { return (p.private ? 'private/' : 'prayers/') + p.id; }
  _ref(path) { return this.db.ref(this.database, path); }

  _subscribePrivate(id) {
    if (this.privSubs[id]) return;
    this.privSubs[id] = this.db.onValue(this._ref('private/' + id), snap => {
      if (snap.exists()) this.privateMap[id] = { ...snap.val(), id };
      else { delete this.privateMap[id]; this.known.delete(id); this._saveKnown(); }
      this._emitPrayers();
    }, () => { delete this.privateMap[id]; this._emitPrayers(); });
  }

  async addPrayer(input) {
    const p = { ...this._newPrayer(input), createdAt: this.db.serverTimestamp() };
    const isPrivate = input.visibility === 'private';
    if (isPrivate) {
      const id = secureId(22);
      await this.db.set(this._ref('private/' + id), p);
      this.known.add(id); this._saveKnown(); this._subscribePrivate(id);
      return { id, private: true };
    }
    const r = this.db.push(this._ref('prayers'));
    await this.db.set(r, p);
    return { id: r.key, private: false };
  }

  async openPrivate(id) {
    if (!/^[A-Za-z0-9]{20,40}$/.test(id)) return false;
    const snap = await this.db.get(this._ref('private/' + id)).catch(() => null);
    if (!snap || !snap.exists()) return false;
    this.known.add(id); this._saveKnown(); this._subscribePrivate(id);
    return true;
  }

  async prayFor(p) {
    if (p.iPrayed) return;
    await this.db.update(this._ref(this._path(p)), { prayCount: this.db.increment(1), ['prayedBy/' + this.userId]: true });
  }
  async markAnswered(p, testimony) {
    await this.db.update(this._ref(this._path(p)), { answered: true, answeredAt: this.db.serverTimestamp(), testimony: clean(testimony, MAX_TEXT) });
  }
  async deletePrayer(p) {
    await this.db.remove(this._ref(this._path(p)));
    if (p.private) { this.known.delete(p.id); this._saveKnown(); }
  }
  async report(p) { await this.db.set(this._ref(this._path(p) + '/reports/' + this.userId), true); }
  async setHidden(p, hidden) { await this.db.set(this._ref(this._path(p) + '/hidden'), !!hidden); }

  updatePresence(state) {
    this.db.set(this.presenceRef, { ...state, t: this.db.serverTimestamp() }).catch(() => {});
  }
  onPresence(cb) {
    super.onPresence(cb);
    if (this.presenceSub) return;
    this.presenceSub = this.db.onValue(this._ref('presence'), snap => {
      const others = {}, cutoff = Date.now() - 60000;
      snap.forEach(child => { const v = child.val(); if (child.key !== this.userId && v && (!v.t || v.t > cutoff)) others[child.key] = v; });
      this.presenceCbs.forEach(f => f(others));
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
