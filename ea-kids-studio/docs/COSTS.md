# Realistic monthly cost breakdown

**Prices below are estimates.** Only the Anthropic token prices were checked against a source (the Claude API reference cached 2026-10-06); every other number is *unverified* — the app labels them the same way. Always confirm on the provider's pricing page. Nothing here is a promise about revenue.

Assumptions: landscape video ≈ 90 s ≈ 1,500 Arabic characters of narration; a script generation ≈ 2,500 tokens in / 4,000–6,000 tokens out.

## Three setups (12 videos / month)

| Item | A. Free & local | B. Hybrid (suggested once you publish) | C. Premium voice |
|---|---|---|---|
| Scripts | $0 (offline kits; or local LLM) | Claude `claude-opus-5-5` ≈ $4/$20 per 1M tokens in/out → ≈ $0.09–0.13 / script → **≈ $1–2** | same |
| Narration | $0 (own recording; espeak-ng for drafts only) | Neural cloud TTS ≈ $15–16 per 1M characters (unverified) → ≈ $0.02–0.03 / video → **< $1** (free tiers may cover it) | Premium voice plan ≈ $5–100/mo (unverified; commercial rights need a paid plan) |
| Images / animation | $0 (local art library) | $0 | $0 (no image/video API integrated) |
| Music & SFX | $0 (in-house) | $0 | optional music library ≈ $10–15/mo (unverified) |
| Rendering | $0 (your CPU; ~1–2 min of CPU per minute of video on 4 cores) | $0 | $0 |
| Storage | $0 local disk (≈ 10–25 MB final per episode + cache) | $0 | $0 |
| Hosting | $0 (runs on your PC) | $0 (or ≈ $5–10/mo VPS if you want it online; unverified) | same |
| Domain / HTTPS | not needed | optional ≈ $1/mo | same |
| Backups | $0 external drive | $0–3 cloud storage | same |
| **Total** | **≈ $0** (+ electricity/internet) | **≈ $2–4 / month** | **≈ $10–110 / month** |

## Where costs can surprise you
- Long videos or many revisions multiply LLM tokens — use scene-level revision instead of regenerating.
- Cloud voices bill per character, including re-generations; the studio only re-synthesises scenes whose text changed.
- Currency conversion and bank fees on **incoming** AdSense wires are deducted from your payout (Iraqi bank + intermediaries) — ask your bank.

## Controls in the app
- Costs & limits → daily/monthly limits (default $0 = paid providers blocked).
- Every paid job shows its estimate and price-verification status and needs your confirmation.
- Cost per video and machine time per video are listed under Analytics → Production and exportable as CSV.
