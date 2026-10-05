# Free (or cheap) AI for campaign generation

Campaign **analyze** + **plan** steps call Edge Functions that use **`invokeLlm`** — an **OpenAI-compatible** HTTP API.  
**Promo video pixels** render **on your device** (Remotion/WebCodecs) — Groq does **not** generate video. Groq can still help with **campaign copy** and, if configured, **wording** the motion prompt before an optional paid fal/Replicate clip (see [PROMO_VIDEO.md](./PROMO_VIDEO.md)).

OpenAI is the default. If you see `credit_balance_exhausted`, switch to a provider with a **free tier** by changing Supabase secrets (no app redeploy required for secret-only changes).

## Recommended: Groq (free tier, no card)

1. Sign up at [console.groq.com](https://console.groq.com).
2. Create an **API key**.
3. In **Supabase → Project Settings → Edge Functions → Secrets**, set:

| Secret | Value |
|--------|--------|
| `OPENAI_API_KEY` | Your Groq API key (`gsk_...`) |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` |
| `OPENAI_MODEL` | `llama-3.3-70b-versatile` (quality) or `llama-3.1-8b-instant` (faster / higher daily limits) |

4. Try **Create campaign** again.

**Limits:** Free tier is rate-limited (requests/tokens per minute and per day). Heavy use may hit **429** until the quota resets. Fine for personal promo campaigns; not for high-traffic production.

**Note:** Groq models differ from GPT-4o-mini; JSON shape is usually fine but wording may vary.

## Alternative: Google Gemini (free tier with limits)

Gemini offers a free API tier via [Google AI Studio](https://aistudio.google.com/apikey).  
Use Google’s **OpenAI compatibility** base URL (check current docs; often):

- `OPENAI_BASE_URL` = `https://generativelanguage.googleapis.com/v1beta/openai`
- `OPENAI_API_KEY` = your Gemini API key
- `OPENAI_MODEL` = a current Gemini model id from Google’s compatibility list

Quota and model names change; verify in Google’s docs before production.

## Alternative: OpenRouter (some free models)

[OpenRouter](https://openrouter.ai) can route to models with `:free` suffix on some offerings:

- `OPENAI_BASE_URL` = `https://openrouter.ai/api/v1`
- `OPENAI_API_KEY` = OpenRouter key
- `OPENAI_MODEL` = e.g. a listed free model (see their catalog)

Free routes are often slow or capped.

## Cover lab (AI album covers)

**Cover lab** (`/artwork`) generates images with the **OpenAI Images API** (default model `dall-e-3`), not fal/Replicate.

| Secret | Value |
|--------|--------|
| `OPENAI_API_KEY` | OpenAI `sk-...` with Images access |

If you use **Groq** for campaign copy (`OPENAI_BASE_URL` → Groq), keep Groq for chat but add a real OpenAI key for covers:

| Secret | Value |
|--------|--------|
| `OPENAI_IMAGE_API_KEY` | OpenAI `sk-...` (Images only) |
| `OPENAI_IMAGE_BASE_URL` | Optional; default `https://api.openai.com/v1` |

Optional: `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_SIZE` (default `1024x1024`), `OPENAI_IMAGE_QUALITY` (`standard` or `hd` for DALL·E 3).  
Legacy: `AI_COVER_PROVIDER=fal|replicate` still works if you prefer Flux via `FAL_KEY` / `REPLICATE_API_TOKEN`.

## What stays on-device (no LLM bill)

- Artwork/audio **asset profile** (colors, hooks from title/energy)
- **MP4 promo encode** (WebCodecs / Remotion)
- Optional local **Whisper** workers where enabled in the UI

## Secrets reference (Supabase only)

Never put API keys in GitHub `VITE_*` vars or the frontend bundle.

```bash
supabase secrets set OPENAI_API_KEY="gsk_..." --project-ref YOUR_REF
supabase secrets set OPENAI_BASE_URL="https://api.groq.com/openai/v1" --project-ref YOUR_REF
supabase secrets set OPENAI_MODEL="llama-3.3-70b-versatile" --project-ref YOUR_REF
```

Revert to OpenAI anytime by setting `OPENAI_BASE_URL` back to `https://api.openai.com/v1`, `OPENAI_MODEL` to `gpt-4o-mini`, and an OpenAI `sk-...` key.
