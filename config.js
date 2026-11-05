// ─────────────────────────────────────────────────────────────
//  Site configuration. Edit this file; no build step needed.
// ─────────────────────────────────────────────────────────────
window.CHURCH_CONFIG = {
  churchName: 'Grace Metaverse Church',

  // Firebase web config (safe to be public; database.rules.json protects the data).
  // Set to null to run in DEMO mode, where prayers are saved only in this browser.
  firebase: {
    apiKey: 'AIzaSyAjLqS1HjMyUs-SnYMC64XtvPDKRQXuVCo',
    authDomain: 'church-e8405.firebaseapp.com',
    databaseURL: 'https://church-e8405-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'church-e8405',
    storageBucket: 'church-e8405.firebasestorage.app',
    messagingSenderId: '383944281827',
    appId: '1:383944281827:web:fc0a59c6776f5f6ef73fd6',
  },

  // Optional: Kakao JavaScript key (developers.kakao.com → My Application).
  // With it, the Share button opens KakaoTalk's friend picker with a rich card.
  // Without it, the button uses the phone's share sheet or copies the link.
  kakaoJsKey: '',

  // Optional: pin a specific verse to a date (YYYY-MM-DD, local time).
  verseOverrides: {
    // '2026-12-25': { text: 'For unto you is born this day in the city of David a Saviour, which is Christ the Lord.', ref: 'Luke 2:11' },
  },
};
