# Metaverse Church

A small 3D church you can open from a link, including from inside KakaoTalk. Visitors:

- **pick an avatar** (name, outfit, skin, hair, style, accessory)
- **walk around** the nave, aisle, altar, pews and stained-glass windows (WASD/arrow keys, or an on-screen joystick on phones)
- **share prayer requests**, choosing who sees each one:
  - **Everyone**: it goes on the Prayer Wall for the whole church.
  - **Only people I choose**: it stays off the wall. The author gets a private link to send in KakaoTalk to the people they pick.
  - Either way, they can **hide their name** (anonymous).
- **pray for a request** with one tap. Each person counts once.
- **see how many people prayed for them**: the "Mine" tab shows the count on each request, and returning visitors get a "3 people prayed for you since your last visit" message
- **mark their own request as answered**, with an optional testimony. It then moves to the Answered Prayers wall.
- **report** an inappropriate post. A post reported by 3 people is hidden until a moderator reviews it.
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

## Moderators

Moderators get a **Review** tab listing reported and hidden posts. From there they can hide, unhide or delete any public post. Private requests are never shown to moderators unless someone sent them the link.

To make someone a moderator in live mode:

1. On the moderator's phone, open the site with `#whoami` at the end of the address, e.g. `https://yuji-toaster.github.io/Church/#whoami`. Their user ID is copied and shown on screen.
2. In the Firebase console → Realtime Database, add a node `admins/<that user ID>` with the value `true`.
3. Reload the site on that phone. The Review tab appears.

In demo mode, add `?admin` to the address to try the moderator tools.

Note that the ID belongs to that phone's browser. If they clear KakaoTalk's browser data, repeat these steps.

## How private prayers are protected

A private request is stored at a random, 22-character address. The database refuses to list those addresses, so the only way to read a private request is to have its link. That makes it like an unlisted video: **anyone the link is forwarded to can read it.** The app warns the author about this when it shows the link. Authors can delete a private request at any time.

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

- **Moderation is after the fact:** posts appear immediately and are hidden only after reports or a moderator's action. If you want every public post approved before it appears, that's a small change.
- **Identity:** there are no accounts. Each phone's browser gets an anonymous ID, and "Mine", prayer counts, "mark answered" and the private requests you've received are all tied to that ID. If someone clears KakaoTalk's browser data or switches phones, they lose access to those. Kakao Login would fix this.
- **Scale:** presence updates about 6 times per second per moving visitor. The free Firebase tier comfortably handles a small congregation (tens of people at once). For hundreds of people at once, you'd want a dedicated realtime server.
- **No voice chat or live-stream screen yet.** Both are natural next features.
