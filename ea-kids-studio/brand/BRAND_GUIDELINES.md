# EA KIDS — Brand Guidelines

Everything here is **original**. No character, colour scheme, jingle or layout is copied from Disney, Cocomelon or any other creator. Assets are regenerated from code with `npm run build:brand`, so the system stays consistent as it grows.

## 1. Brand idea

EA KIDS is a cheerful, safe, educational channel where four small animal friends help children learn Arabic first, then English. **Warm, bright, calm** — never frantic. One idea per video; slow enough for a 3-year-old to follow.

Voice: kind, simple, encouraging. Short sentences. Asks the child to join in ("هيا نقول معًا") but **never** asks for personal information, never pressures ("subscribe now or…"), and never shames wrong answers.

## 2. Colour palette

| Token | Hex | Use |
|---|---|---|
| Sunny Yellow | `#FFC93C` | Primary, avatar background, highlights |
| Coral Orange | `#FF7A3D` | Energy, "E" in the wordmark, calls to action |
| Sky Blue | `#3FA9F5` | Calm, trust, scarf, "A" |
| Leaf Green | `#3CC47C` | Nature, growth, "K" |
| Berry Pink | `#FF5C8A` | Joy, "I" |
| Grape Purple | `#7B5BF2` | Imagination, "D" |
| Deep Navy | `#23285B` | **All outlines and text** (never pure black) |
| Cream | `#FFF6E0` | Backgrounds, paper |

Rules: navy outline on every illustrated object (4–6 px at 400 px). Backgrounds are soft; subjects are saturated. Keep contrast of text ≥ 4.5:1 (white text always has a navy outline).
Machine-readable copy: `brand/palette.json`.

## 3. Typography (all SIL Open Font License, bundled in `assets/fonts/`)

| Role | Font | Notes |
|---|---|---|
| Latin display / wordmark | **Fredoka** | rounded, friendly |
| Arabic headlines, thumbnails | **Baloo Bhaijaan 2** | playful, heavy weight (800) |
| Arabic body, captions, UI | **Tajawal** | very legible at small sizes |

Captions: Tajawal Bold, white with navy outline, lower third, max 2 lines, ≤ 42 characters per line.

## 4. Logos (`brand/out/`)

| File | Use |
|---|---|
| `logo-main.png` (1600×1320) | Channel art, documents, end screens |
| `logo-horizontal.png` (1800×600) | Video watermark, headers |
| `logo-mono-navy.png` / `logo-mono-white.png` | One-colour watermark on light / dark footage |
| `profile-800x800.png` | YouTube profile picture (subject sits inside the circular crop) |
| `banner-2560x1440.png` | YouTube banner. Primary content is inside the 1546×423 all-device safe area; the chick and turtle are decorative and may be cropped on phones |

Clear space: the height of the "E" on every side. Minimum size: 120 px wide on screen. Do not recolour letters, stretch, add effects, or place on busy photos.

## 5. Mascots (original characters)

Locked designs live in `server/art/characters.js` and the **Characters** screen. Appearance may change only by creating a **new character version** (the previous version is kept).

| Character | Species | Role | Signature features |
|---|---|---|---|
| **ريّان Rayyan** | Lion cub | Host / guide | Scalloped orange mane, teal scarf |
| **نونو Nunu** | Bunny | Counting, kindness | Lavender fur, tall ears, pink bow |
| **سلّومة Sallouma** | Turtle | Nature, habits | Hexagon shell, round glasses |
| **زقزق Zaqzaq** | Chick | Songs, sounds | Round yellow body, 3-feather tuft |

Expressions: happy, smile, wow, wink, proud (eyes closed), love. Mascot PNGs/SVGs are in `brand/out/mascots/`.

**Consistency rules**: same colours and proportions in every scene; outlines never removed; character voices are *licensed TTS voices or consenting voice actors only* — never a cloned real person.

## 6. Thumbnail system

Ten templates (`brand/out/thumbnail-templates/`): colours, numbers, alphabet, animals, nature, story, habits, shapes, songs, general. Rules: one focal subject (mascot), ≤ 3 words of huge outlined Arabic text, props never overlap text, EA KIDS badge top-left, nothing important in the bottom-right (timestamp overlay), no misleading imagery, no arrows/shock faces. Three layout variants per video are generated in the **Thumbnails** screen; the owner picks or edits one.

## 7. Intro / outro concepts

* **Intro bumper (4 s)** — stage background; Rayyan bounces in and waves; wordmark pops with a soft chime; tagline "تعلّم وامرح مع أصدقائك". Built into every generated project as the optional `intro` scene.
* **Outro bumper (6 s)** — Rayyan, Nunu, Zaqzaq and Sallouma wave goodbye; a **gentle** line of Arabic: "إلى اللقاء يا أصدقائي!". Leaves 5–20 s of clean space for YouTube end-screen elements. No "like/subscribe or else" pressure and no requests for children to contact anyone.
* **Audio identity** — an original 3-note ascending chime + soft pentatonic loop synthesised in-house (`server/media/music.js`), so there are **no third-party licensing obligations**.

## 8. Illustration style

Flat colour, rounded geometry, thick navy outline, soft pastel backgrounds, one white highlight per object. Backgrounds are legible but quiet (the mascot and the lesson object always win). No realistic violence, scary imagery, weapons, or fast flashing (> 3 flashes/second) — enforced by the compliance checklist.

## 9. Asset organisation

```
brand/
  BRAND_GUIDELINES.md   this file
  palette.json          tokens
  out/                  generated assets (re-create with npm run build:brand)
assets/fonts/           OFL fonts + licence texts
server/art/             source of truth for characters, props, backgrounds, logos
data/media/projects/    per-project generated media (git-ignored)
```
