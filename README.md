# Metaverse Church

A small 3D church you can open from a link, including from inside KakaoTalk. Visitors:

- **pick an avatar** (name, outfit, skin, hair, style, accessory)
- **walk around** the nave, aisle, altar, pews and stained-glass windows (WASD/arrow keys, or an on-screen joystick on phones)
- **share prayer requests** on the Prayer Wall, tap "I prayed" on other people's requests, and post anonymously if they want
- **mark their own request as answered**, with an optional testimony. It then moves to the Answered Prayers wall.
- **read today's verse**, which rises out of the open Bible on the lectern. Everyone sees the same verse on the same day, and it changes daily.
- **see other visitors** walking around in real time (needs live mode, see below)
- **invite friends** through KakaoTalk, the phone's share sheet, or a copied link

It's plain HTML, CSS and JavaScript with [three.js](https://threejs.org). There's no build step and no server code to run.

## How it works with KakaoTalk

KakaoTalk can't host a 3D world as an app inside the chat. What works is sharing a **web link**: when someone taps it in a KakaoTalk chat, the page opens in KakaoTalk's built-in browser and runs there. So the plan is:

1. Host this site (GitHub Pages works, see below).
2. Paste the link in a KakaoTalk chat or open chat room. The `og:` tags in `index.html` and `assets/og.jpg` produce the preview card.
3. Optionally add a Kakao JavaScript key so the in-app **Invite** button opens KakaoTalk's friend picker with a rich card.

A full KakaoTalk mini-app or channel integration (login with Kakao, push messages) is a separate project and requires registering with Kakao.

## Run it locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. It has to be served over http; opening the file directly won't work because of ES modules.

## Demo mode vs live mode

Out of the box it runs in **demo mode**. Prayers are stored only in the visitor's own browser, and "other people" show up only between tabs on the same device. That's fine for trying it out, but **members can't see each other's prayers in demo mode.** A banner says so.

### Turn on shared prayers and live presence (Firebase, free tier)

1. Create a project at https://console.firebase.google.com.
2. **Build → Authentication → Sign-in method → Anonymous → Enable.**
3. **Build → Realtime Database → Create database.** Pick the region closest to your members (`asia-southeast1` for Korea).
4. In **Realtime Database → Rules**, paste the contents of `database.rules.json` and publish. With these rules, only the author can mark a request answered or delete it, and each "I prayed" adds exactly 1 to the count.
5. **Project settings → Your apps → Web app (</>)**. Copy the config object into `firebase:` in `config.js`. Make sure `databaseURL` is included.
6. **Authentication → Settings → Authorized domains**: add your site's domain, for example `yuji-toaster.github.io`.

## Deploy on GitHub Pages

1. In the repo, go to **Settings → Pages → Source: GitHub Actions**.
2. Merge to `main`. The workflow in `.github/workflows/pages.yml` publishes the site to `https://yuji-toaster.github.io/Church/`.
3. If you host it at a different URL, update `og:image` and `og:url` in `index.html`. KakaoTalk's preview needs absolute URLs. KakaoTalk caches previews; to refresh one, use the Kakao developers cache tool: https://developers.kakao.com/tool/debugger/sharing

## Kakao share button (optional)

1. Go to https://developers.kakao.com and choose **My Application → Add application**.
2. **Platform → Web**: register your site's domain.
3. Copy the **JavaScript key** into `kakaoJsKey` in `config.js`.

Without a key, **Invite** and **Share this verse** use the phone's share sheet. If that isn't available, they copy the link instead.

## Customising

| What | Where |
| --- | --- |
| Church name | `config.js` → `churchName` |
| Daily verse list | `js/verses.js` (60 KJV verses, rotating) |
| Pin a verse to a date (Easter, Christmas…) | `config.js` → `verseOverrides` |
| Building layout, colours, windows | `js/church.js` |
| Avatar options | `js/avatar.js` → `AVATAR_OPTIONS` |

## Known limits and next steps

- **Moderation:** anyone with the link can post. Before sharing widely, add a pastor/admin role that can hide posts. The database rules are the place to enforce that.
- **Identity:** "mark answered" is tied to the browser that posted the request (an anonymous Firebase sign-in). If someone clears KakaoTalk's browser data, they lose the ability to mark their old requests answered. Kakao Login would fix this.
- **Scale:** presence updates about 6 times per second per moving visitor. The free Firebase tier comfortably handles a small congregation (tens of people at once). For hundreds of people at once, you'd want a dedicated realtime server.
- **No voice chat or live-stream screen yet.** Both are natural next features.
