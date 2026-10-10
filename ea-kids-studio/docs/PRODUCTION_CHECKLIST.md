# Production checklist

Local single-user use (`HOST=127.0.0.1`) needs none of the network items. Do **all** of these before exposing the studio beyond your own machine.

## Network & access
- [ ] Keep `HOST=127.0.0.1` and reach it over an SSH tunnel / VPN **or** put an HTTPS reverse proxy (Caddy, nginx) in front.
- [ ] `TRUST_PROXY=true` (behind the proxy), `SECURE_COOKIES=true`, `PUBLIC_URL=https://…`.
- [ ] Set `APP_SECRET` (≥ 32 random bytes): `openssl rand -hex 32`. It encrypts YouTube tokens — losing it means reconnecting.
- [ ] Create the owner with `npm run create-owner -- you@example.com` (or `SETUP_TOKEN` for the first-run page). Strong password; create separate editor/reviewer accounts for helpers.
- [ ] Never expose the dashboard publicly without authentication — it always requires a session, but add the proxy/VPN layer too.
- [ ] Firewall: only 443 (and SSH) open.

## Secrets
- [ ] `.env` is not committed (`.gitignore` covers it) and is readable only by the service user (`chmod 600 .env`).
- [ ] Provider keys have spend caps set **in the provider's console** as well as in Costs & limits.
- [ ] Google OAuth redirect URI matches the HTTPS URL.

## Data safety
- [ ] Schedule backups: `npm run backup` (database snapshot) — e.g. nightly cron; copy `data/backups/` and `data/media/` off the machine.
- [ ] **Restore:** stop the server, replace `data/studio.db` (and delete `studio.db-wal/-shm`) with a backup `.db`, start the server — migrations bring older backups up to date. Restore `data/media/` from your media archive.
- [ ] Disk: renders need a few GB; monitor free space (Settings → Diagnostics).

## Running as a service
- [ ] Process manager (systemd/pm2/Docker) with restart-on-failure; jobs interrupted by a restart are re-queued automatically.
- [ ] `NODE_ENV=production`.
- [ ] Log rotation for `data/logs/app.log`.
- [ ] Docker: `docker build -t ea-kids-studio .` then run with `-p 127.0.0.1:4300:4300 -v eakids-data:/app/data --env-file .env` (the Dockerfile has not been built in the authoring environment — treat it as a starting point).

## Content & channel
- [ ] Every video: facts verified, scenes reviewed, licences recorded, audience designation decided, human watched the full final video, **private** first upload.
- [ ] Re-read YouTube's current made-for-kids, monetization and inauthentic-content policies (Monetization page links them) before each batch of uploads.
- [ ] Vary scripts and ideas — templates re-skinned with little variation risk the "inauthentic content" monetization policy.
- [ ] Do not mark kids content "not made for kids" to avoid restrictions; do not request children's personal information; no manipulative calls to action.
