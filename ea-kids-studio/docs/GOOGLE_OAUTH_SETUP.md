# Google Cloud & YouTube API setup

EA KIDS Studio talks to YouTube **only** through Google's official OAuth 2.0 flow. You sign in on Google's own page; the app never sees or stores your Google password. Without these steps the rest of the studio still works — use **Compliance & YouTube → Manual export** and upload in YouTube Studio by hand.

> **Status of this integration:** implemented and tested against a local mock of Google's endpoints (OAuth + PKCE, token refresh, resumable upload with retry/resume, thumbnails, playlists, analytics reports). It has **not** been run against live Google services from the build environment (no credentials, and Google's docs pages were not reachable). Expect to do a first upload as **Private** and watch the job log.

## 1. Create a Google Cloud project
1. Open <https://console.cloud.google.com/> and sign in with the Google account that owns the EA KIDS YouTube channel.
2. **Select a project → New project** → name it `EA KIDS Studio`.

## 2. Enable the APIs
**APIs & Services → Library**, enable:
- **YouTube Data API v3** (uploads, thumbnails, playlists, channel info)
- **YouTube Analytics API** (views, watch time, retention; revenue only with the optional scope)

## 3. Configure the OAuth consent screen
**APIs & Services → OAuth consent screen**
- User type: **External**. App name `EA KIDS Studio`, your support email.
- Scopes (add the ones you will tick in the dashboard):
  | Scope | Why |
  |---|---|
  | `youtube.upload` | upload videos & thumbnails |
  | `youtube.readonly` | read channel name |
  | `yt-analytics.readonly` | analytics (no revenue) |
  | `youtube` | *optional* — manage playlists (broad: "manage your YouTube account") |
  | `yt-analytics-monetary.readonly` | *optional* — **estimated** revenue, monetised channels only |
- **Testing vs Production:** while the app is in *Testing*, only listed **Test users** can sign in and **refresh tokens expire after 7 days** (you will need to reconnect weekly). Add yourself as a test user. For a permanent connection, publish the app; Google may require verification for sensitive/restricted scopes — for a personal single-owner tool many owners keep it in Testing and reconnect, or complete verification. Check Google's current rules.

## 4. Create the OAuth client
**APIs & Services → Credentials → Create credentials → OAuth client ID**
- Application type: **Web application**
- **Authorized redirect URI:** exactly the value shown in the dashboard under *Compliance & YouTube* (default `http://localhost:4300/api/youtube/oauth/callback`). If you serve the studio on another host/port or over HTTPS, register that URL and set `YOUTUBE_REDIRECT_URI` to match.
- Copy the **client ID** and **client secret**.

## 5. Configure the studio
Add to `.env` (never commit it) and restart:
```
YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=http://localhost:4300/api/youtube/oauth/callback
```
Open **Compliance & YouTube → Connect with Google**, choose the permissions (least privilege is pre-selected), approve on Google's page. Tokens are encrypted at rest with `APP_SECRET`.

## 6. Quotas, verification and limits — **verify these yourself**
Google changes these; the facts below were seen in search-result snippets of the official pages on 2026-10-10 and are shown in the app as *needs verification*:
- **Upload quota:** the sources conflicted — the current `videos.insert` reference mentions a dedicated "Video Uploads" quota bucket (default ≈100 uploads/day since June 2026), older material says 1,600 units of the 10,000-unit default. Check **Cloud Console → APIs & Services → YouTube Data API v3 → Quotas**.
- **Unverified API projects:** older notices said videos uploaded through `videos.insert` by unverified API projects created after 28 July 2020 are locked to **private** until the project passes an audit; the current reference says this restriction no longer applies. The studio always reports the privacy status YouTube returns. If a video comes back private unexpectedly, change it in YouTube Studio or request an API compliance audit.
- **Custom thumbnails** need a verified (phone-verified) channel; images ≤ 2 MB, 16:9.
- **Captions** are exported (SRT/VTT) but **not uploaded by the API**; add them in YouTube Studio.

## 7. Safety model
- Dry-run first: the exact request is shown; nothing is sent.
- Compliance must be approved (and still valid — any change voids it).
- **Only the owner** can approve an upload; they must type `UPLOAD` (and tick an extra box for **public**).
- Default visibility is **Private**. Scheduling keeps the video private until the chosen time.
- Disconnecting deletes the tokens and asks Google to revoke them.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `redirect_uri_mismatch` | The URI in Google Cloud must equal `YOUTUBE_REDIRECT_URI` character for character. |
| `access_denied` / app not verified | Add your account as a test user, or publish/verify the app. |
| "Google did not return a refresh token" | Remove the app at <https://myaccount.google.com/permissions>, connect again. |
| Connection stops working after ~7 days | OAuth app is in *Testing*; reconnect or publish. |
| `YOUTUBE_FORBIDDEN` | API not enabled, scope not granted (reconnect with the scope), or account/channel not eligible. |
| `YOUTUBE_QUOTA` | Daily quota used up; wait for the reset or request more. |
| Thumbnail not set | Verify the channel with a phone number; set it manually in Studio. |
