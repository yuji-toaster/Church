// ─────────────────────────────────────────────────────────────
//  Site configuration. Edit this file; no build step needed.
// ─────────────────────────────────────────────────────────────
window.CHURCH_CONFIG = {
  churchName: 'Grace Metaverse Church',

  // Leave `firebase` as null to run in DEMO mode: prayers are saved only in
  // this browser, and "other people" only appear across tabs on the same device.
  // Paste your Firebase web config here to make prayers and presence shared
  // by everyone (see README → "Turn on shared prayers").
  firebase: null,
  // firebase: {
  //   apiKey: '...',
  //   authDomain: 'your-project.firebaseapp.com',
  //   databaseURL: 'https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app',
  //   projectId: 'your-project',
  //   appId: '...',
  // },

  // Optional: Kakao JavaScript key (developers.kakao.com → My Application).
  // With it, the Share button opens KakaoTalk's friend picker with a rich card.
  // Without it, the button uses the phone's share sheet or copies the link.
  kakaoJsKey: '',

  // Optional: pin a specific verse to a date (YYYY-MM-DD, local time).
  verseOverrides: {
    // '2026-12-25': { text: 'For unto you is born this day in the city of David a Saviour, which is Christ the Lord.', ref: 'Luke 2:11' },
  },
};
