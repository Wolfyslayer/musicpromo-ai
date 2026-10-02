# Promo video pipeline

MusicPromo AI builds **short-form promo MP4s in your browser** with Remotion + WebCodecs. You upload **song + cover**, pick a **promo style**, and the app:

1. Uses a **free text LLM** (Groq via `OPENAI_BASE_URL` — see [FREE_AI.md](./FREE_AI.md)) for campaign copy and per-day video direction.
2. Creates a **draft video project per campaign day** (hook, template, particles, duration).
3. Encodes MP4s **on your device** (no per-minute cloud render bill).

## Why not a “free AI video API”?

Services like Runway, Pika, or Sora generate pixels from text and are **paid** (or heavily capped). They also struggle with **your exact artwork + audio sync** for music promos.

The practical stack here:

| Layer | Tool | Cost |
|-------|------|------|
| Strategy, hooks, day plan | Groq / OpenAI-compatible LLM | Free tier / your key |
| Video pixels & motion | Remotion in the browser | Free (uses your CPU/GPU) |
| Storage | Supabase public bucket | Your project quota |

For “best promo” quality, invest in **style presets**, **lyrics timing**, and **particle/audio-reactive motion** — not generic AI b-roll.

## Campaign ↔ video integration

- Each **Campaign day** gets a linked **Video project** (`video_project_id`) with AI-chosen `video_template`, `visual_style`, and `particle_effect`.
- **Create Campaign** renders the **first day** immediately (optional: first 3 days if enabled). Other days stay **draft** until you **Render all drafts** on the Videos tab or open a day in the editor.
- **Plan tab → Create Video** opens the studio with that day’s hook and linked project.

## Tips for great exports

- Paste **lyrics** so lyric templates sync cleanly; fine-tune cues in the studio timeline.
- Use **Campaign presets** (15s / 30s) in the video editor for platform-native length.
- Re-render after changing particles or typography — exports bake the current style.
