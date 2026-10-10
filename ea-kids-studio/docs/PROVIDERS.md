# Provider setup

Keys live **only** in the server environment (`.env`). The dashboard shows whether a variable is set — never its value. Restart the server after editing `.env`. Everything defaults to **free & local**; paid providers stay blocked until you set a spending limit and then each job asks you to confirm its estimate.

## Script & storyboard generation
| Provider | Setup | Cost | Status |
|---|---|---|---|
| **Offline lesson kits** (default) | built in | free | tested |
| **Claude (Anthropic)** | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` (default `claude-opus-5-5`) | paid per token (price table verified 2026-10-06; re-check) | tested against a local mock of the Messages API (streaming, refusal, auth errors); not run against the live API |
| **OpenAI** | `OPENAI_API_KEY`, optional `OPENAI_TEXT_MODEL`, `OPENAI_BASE_URL` | paid; **price unverified** | implemented (chat completions, JSON mode), not tested live |
| **Local / OpenAI-compatible (e.g. Ollama)** | `OPENAI_COMPAT_BASE_URL=http://localhost:11434/v1`, `OPENAI_COMPAT_MODEL=<model>` | free | implemented, not tested live; small models may produce weak Arabic |

All AI output is forced through the same validator: unknown props/characters are replaced, coordinates are clamped, claims start as **unverified**, and the result is saved as a new version (the previous script is restorable). Optional refusal-fallback routing for Claude is not enabled; see `server/providers/llm.js` if you want it.

## Narration (text-to-speech)
| Provider | Setup | Notes |
|---|---|---|
| **Your own recording** | import per scene (Voice & narration → Import) | best quality, no licence questions |
| **espeak-ng** | `apt install espeak-ng` / `brew install espeak-ng` | free, local, **robotic** — drafts & timing only (tested) |
| **Azure Speech** | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | has Iraqi Arabic voices (`ar-IQ-RanaNeural`, `ar-IQ-BasselNeural`); verify availability in your region and pricing/free tier |
| **OpenAI TTS** | `OPENAI_API_KEY` | model `gpt-4o-mini-tts` by default (`OPENAI_TTS_MODEL`) |
| **ElevenLabs** | `ELEVENLABS_API_KEY` + a voice id you are licensed to use | commercial use needs an eligible paid plan — verify |
| **Google Cloud TTS** | `GOOGLE_TTS_API_KEY` | enable the Text-to-Speech API |

Cloud adapters are implemented to each provider's documented REST API but **were not run live**. Narration is synthesised **per sentence**, so caption timing is measured, not guessed.
**Never clone a real person's voice without their written permission.** Record the provider's licence terms; the compliance gate checks imported audio for a recorded commercial licence.

## Images & video
Scenes are **drawn locally** from the EA KIDS art library (motion graphics). You can import images/video you are licensed to use. **No image- or video-generation API is integrated** — the dashboard says so, and an `ai_video_clip` scene requires a clip you attach yourself. A slideshow is never labelled AI video.

## Music & sound effects
Synthesised in-house (original, royalty-free). To use a licensed track: Voice & narration → *Import a licensed track* and fill in the licence; YouTube's Audio Library and other sources have their own terms — read them.
