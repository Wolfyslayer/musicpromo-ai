# Free AI (Google Gemini — default)

Campaign **analyze**, **plan**, **support chat**, cover **prompt polish**, and optional **motion prompt** wording all use **`invokeLlm`** — an **OpenAI-compatible** HTTP API pointed at **Gemini** by default.

**Promo video pixels** still render **on your device** (Remotion/WebCodecs). Optional cloud video clips still use **fal/Replicate** when configured (see [PROMO_VIDEO.md](./PROMO_VIDEO.md)).

## Recommended: Gemini free tier (AI Studio)

1. Create a key at [Google AI Studio](https://aistudio.google.com/apikey).
2. In **Supabase → Project Settings → Edge Functions → Secrets**, set:

| Secret | Value |
|--------|--------|
| `GEMINI_API_KEY` | Your AI Studio API key |
| `GEMINI_MODEL` | Optional — default `gemini-3.8-flash` |
| `GEMINI_IMAGE_MODEL` | Optional — default `gemini-2.5-flash-image` (cover lab) |
| `AI_PROVIDER` | Optional — default `gemini` |

No app redeploy is required for secret-only changes (Edge Functions read secrets at runtime).

**Limits:** Free tier is rate-limited (RPM/RPD). Heavy use may return **429** / `RESOURCE_EXHAUSTED` until quotas reset. Image models may have stricter caps than chat — check [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).

### One key for everything

You can store the same AI Studio key as **`GEMINI_API_KEY`** (preferred) or legacy **`OPENAI_API_KEY`** when `AI_PROVIDER=gemini`.

## Cover lab (AI album covers)

Uses **Gemini native image generation** (`generateContent` + `GEMINI_IMAGE_MODEL`, default `gemini-2.5-flash-image`).

| Secret | Purpose |
|--------|---------|
| `GEMINI_API_KEY` | Chat + covers |
| `GEMINI_IMAGE_MODEL` | Override image model (e.g. `gemini-3.1-flash-image` on paid tier) |

Legacy OpenAI covers: set `AI_COVER_PROVIDER=openai` and `OPENAI_IMAGE_API_KEY`.  
Legacy Flux: `AI_COVER_PROVIDER=fal|replicate` + `FAL_KEY` / `REPLICATE_API_TOKEN`.

## Alternative: Groq (free text only)

Groq does **not** generate images. Use it for **text** only:

| Secret | Value |
|--------|--------|
| `AI_PROVIDER` | `openai` (use custom base URL) |
| `OPENAI_API_KEY` | Groq key (`gsk_...`) |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` |
| `OPENAI_MODEL` | e.g. `llama-3.3-70b-versatile` |

Keep **`GEMINI_API_KEY`** for cover lab, or set `AI_COVER_PROVIDER=openai` with a separate image key.

## Alternative: OpenAI (paid)

| Secret | Value |
|--------|--------|
| `AI_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | OpenAI `sk-...` |
| `OPENAI_BASE_URL` | Optional — default `https://api.openai.com/v1` |
| `OPENAI_MODEL` | e.g. `gpt-4o-mini` |
| `OPENAI_IMAGE_API_KEY` | Optional — OpenAI Images only when using Groq for chat |
| `OPENAI_IMAGE_MODEL` / `OPENAI_IMAGE_EDIT_MODEL` | Optional — DALL·E / gpt-image when `AI_COVER_PROVIDER=openai` |

## Troubleshooting: model `404` / “no longer available”

Google retired **`gemini-2.5-flash`** for new API keys. Set in Supabase secrets:

```bash
supabase secrets set GEMINI_MODEL=gemini-3.8-flash --project-ref YOUR_REF
```

Then redeploy edge functions. Latest app code defaults to `gemini-3.8-flash` if `GEMINI_MODEL` is unset.

## Troubleshooting: `Invalid API Key` (401) when generating campaigns

If the app shows **AI request failed (401)** or **invalid_api_key** on **Generate campaign**:

1. Open [Google AI Studio](https://aistudio.google.com/apikey) and create or copy an API key (starts with `AIza…`).
2. In **Supabase → Project Settings → Edge Functions → Secrets**, set **`GEMINI_API_KEY`** to that value (no quotes). Leave **`AI_PROVIDER`** unset or set to `gemini`.
3. **Remove conflicting secrets** (common cause of 401): delete **`OPENAI_API_KEY`** if it is an old `sk-…` OpenAI key, and **delete `OPENAI_BASE_URL`** unless you intentionally use Groq (step 4). With default Gemini, an old Groq/OpenAI base URL sends requests to the wrong host.
4. If you use **Groq** instead of Gemini: `AI_PROVIDER=openai`, `OPENAI_API_KEY=gsk_…`, `OPENAI_BASE_URL=https://api.groq.com/openai/v1`, `OPENAI_MODEL=llama-3.3-70b-versatile`.
5. Redeploy functions after changing secrets: `supabase functions deploy --project-ref YOUR_REF` or run the **Deploy** GitHub Action.

Secrets are **not** stored in GitHub; the frontend bundle never contains the LLM key.

## Multimodal song analysis (artwork + audio)

When **`artwork_url`** and/or **`audio_url`** / **`tracks[]`** are on the analyze/campaign payload, edge functions download public HTTPS media and send it to **Gemini** with the text prompt. Hooks, mood, and campaign days are grounded in what the model **sees** in the cover and **hears** in the clip(s).

- Album/EP: up to **`GEMINI_MAX_CAMPAIGN_AUDIO_TRACKS`** (default **3**) track audios plus release artwork.
- Audio/artwork must be reachable from Supabase Edge (public storage URL or signed URL in the payload).
- Optional limits: **`GEMINI_MAX_AUDIO_BYTES`**, **`GEMINI_MAX_IMAGE_BYTES`**.

## What stays on-device (no LLM bill)

- Artwork/audio **asset profile** (colors, hooks from title/energy) — also sent as text hints when present
- **MP4 promo encode** (WebCodecs / Remotion)
- Optional local **Whisper** workers where enabled in the UI

## Secrets reference (Supabase only)

Never put API keys in GitHub `VITE_*` vars or the frontend bundle.

```bash
supabase secrets set GEMINI_API_KEY="AIza..." --project-ref YOUR_REF
supabase secrets set GEMINI_MODEL="gemini-3.8-flash" --project-ref YOUR_REF
supabase secrets set GEMINI_IMAGE_MODEL="gemini-2.5-flash-image" --project-ref YOUR_REF
```
