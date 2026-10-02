# Promo video pipeline

MusicPromo AI builds **short-form promo MP4s in your browser** with Remotion + WebCodecs.

| What | How | Cost |
|------|-----|------|
| Campaign plan, hooks, captions | Groq / OpenAI-compatible LLM | Free tier — [FREE_AI.md](./FREE_AI.md) |
| Cover motion (Ken Burns, hype zoom) | Remotion on your device | **Free** |
| Final MP4 + your song | Remotion export | **Free** |
| Optional “AI B-roll” from cover | fal.ai or Replicate | **Pay-per-use** (~$0.20/clip fal Wan 480p) |

**Groq cannot render video.** It only processes text. There is no Groq endpoint for image→video.

## Recommended path (zero video API cost)

1. Upload song + cover → accept **auto-suggested promo style** (cover colors + energy).
2. In the video editor **Look** tab, tap **AI Studio feel** preset, or under **Media** choose **AI studio feel (free)** motion.
3. That enables film grain, beat flashes, light sweeps, chromatic cover edges, and prism-friendly defaults — reads like generative AI without an API.
4. Add hooks, lyrics → **Export** — full-length audio is baked in.

New campaign video drafts default to **AI studio feel** motion when possible.

## Optional cloud AI clips (cheaper than Runway)

If you want the cover to “morph” with a generative model:

### fal.ai (recommended default in code)

- Sign up at [fal.ai](https://fal.ai), create **`FAL_KEY`**.
- Supabase secrets:
  - `FAL_KEY` — required for cloud clips
  - `FAL_VIDEO_MODEL` — optional, default **`fal-ai/wan-i2v`**
  - `AI_VIDEO_PROVIDER` — optional, set to `fal` to force fal
- Default Wan 480p is about **$0.20 per generation** (see fal model page for current pricing).
- Your existing **Groq** setup (`OPENAI_BASE_URL` + key) can **rewrite the motion prompt** (text only) before fal runs — no extra Groq product needed.

### Replicate (alternative)

The old Stable Video Diffusion slug is often missing or renamed. Use a current Wan model instead:

- `REPLICATE_API_TOKEN`
- `REPLICATE_VIDEO_MODEL` = **`wavespeedai/wan-2.1-i2v-480p`** (default in code)
- Billed about **$0.09 per second** of output — a 5s clip ≈ **$0.45**, usually **more expensive than fal** for short promos.

If both `FAL_KEY` and Replicate are set, **fal is preferred** unless `AI_VIDEO_PROVIDER=replicate`.

### Disable paid video entirely

Set `AI_VIDEO_PROVIDER=off` — the **pay-per-use cloud clip block is hidden** in the video editor (free AI studio / cinematic motion still works). Same when no `FAL_KEY` or Replicate token is configured.

## Editing cloud clips

Cloud output is a **short loop**. In the editor you composite it with cover, text, and particles, then **Export** once with your track — you are not editing the raw AI file in a NLE.

## Deploy

Redeploy Supabase Edge Functions after changing secrets (`generateAiVideoClip` + shared `aiVideoClip` module).
