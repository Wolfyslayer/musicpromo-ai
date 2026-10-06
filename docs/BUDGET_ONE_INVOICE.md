# One invoice, budget-friendly AI

MusicPromo needs **text/JSON**, **audio + artwork analysis**, **cover images**, optional **short I2V clips**, and (optionally) **Suno/stems** — which are different product categories. There is no magic “one API” that includes Suno-class music gen at Groq prices.

The setup below minimizes **your** vendor count and keeps spend predictable for a promo-first app.

## Recommended: one Google bill (Gemini API)

Use a **single [Google AI Studio](https://aistudio.google.com/) / Gemini API** key and one payment method on Google for almost everything users touch in the promo flow:

| Feature | Gemini API | Secret in Supabase |
|---------|------------|-------------------|
| Song analysis (audio + cover) | Multimodal Flash | `GEMINI_API_KEY`, `GEMINI_MODEL_ANALYZE_SONG` |
| Campaign plan & day content | Chat / JSON | `GEMINI_MODEL_GENERATE_CAMPAIGN`, `GEMINI_MODEL_GENERATE_CONTENT` |
| Support chat | Chat | `GEMINI_MODEL_SUPPORT_CHAT` |
| Cover art (Nano Banana) | Image models | `GEMINI_IMAGE_MODEL` |
| Motion prompt wording (text only) | Chat | `GEMINI_MODEL_VIDEO_PROMPT` |

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.8-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

**Why this wins on “one invoice + budget”:**

- **Free tier** for development and light production (rate limits apply).
- When you outgrow free tier, you add **pay-as-you-go** on the **same Google account** — not a second LLM vendor.
- **Audio analysis + covers + copy** share one key; no OpenAI + fal + Groq minimum spend stack.
- Flash-class pricing is usually **much cheaper** than running the same volume on GPT-4o + DALL·E for promo workloads.

**Promo video (main export):** still **free in the browser** (WebCodecs). That avoids a video API bill for every campaign.

**Optional cloud “AI B-roll” clip:** not on the same Gemini key in this repo today. Cheapest pattern is **don’t enable it by default** — use **AI Studio feel / cinematic motion** (no API). If you must offer Wan-style clips, that is a **second** small invoice (fal or Replicate); see below.

**Suno / stems:** always a **separate** music API (TemPolor/Suno, etc.). Keep them behind **Creator+** and **high flat credits** so one Google bill stays your main AI cost center.

## Usage-based credits in the app

Turn on **`USAGE_BASED_CREDITS=true`** so user credits track **estimated provider cost** (tokens for analyze/content, seconds for cloud clips). Tune:

- `CREDIT_USD_VALUE` — e.g. `0.01` (100 credits ≈ $1)
- `CREDIT_MARKUP` — e.g. `1.15`
- `GEMINI_LLM_USD_PER_1M_INPUT` / `GEMINI_LLM_USD_PER_1M_OUTPUT` — align with [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)

See [ATLASCLOUD.md](./ATLASCLOUD.md) for the same metering knobs if you mix in Atlas for video only.

## If you truly want only ONE vendor card (including optional clips)

**Replicate** ([replicate.com](https://replicate.com)) can be **one monthly invoice** for:

- Cheap **Flux** covers (`AI_COVER_PROVIDER=replicate`)
- **Wan** I2V clips (`AI_VIDEO_PROVIDER=replicate`)
- **Demucs** stem fallback
- Small **LLM** runs for text-only tasks

Tradeoff: **song analysis with uploaded audio** is weaker and more awkward than **native Gemini multimodal**. For a promo app, we still recommend **Gemini for analyze + covers + text**, and treat Replicate as optional unless you accept worse analysis or a hybrid (two invoices).

## What we do not recommend for “budget + one invoice”

| Approach | Why |
|----------|-----|
| OpenAI-only for everything | Simple one bill, but analyze + images add up fast vs Gemini Flash + Nano Banana |
| Groq-only | One bill, **no** covers, **no** video, **no** audio understanding |
| Atlas-only | Good for Wan + chat; **no** wired cover art; **no** multimodal audio in this app |
| Runway / premium video APIs | Quality, not budget, for per-user promo volume |

## Summary

**Best balance:** **one Google invoice (Gemini)** for all promo AI that matters, **free browser video** for exports, **optional fal/Replicate** only if you productize paid cloud clips, **Suno/stems** billed separately on premium tiers.

Setup details: [FREE_AI.md](./FREE_AI.md) · Clips: [PROMO_VIDEO.md](./PROMO_VIDEO.md)
