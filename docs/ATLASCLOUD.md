# Atlas Cloud (optional unified AI provider)

[Atlas Cloud](https://www.atlascloud.ai/) can power **text** (OpenAI-compatible chat), **Wan 3.0 image→video**, and other model APIs on one key. This app does **not** replace browser-based promo video rendering (Remotion/WebCodecs) with Wan — cloud Wan is only for optional **paid AI clip** generation in the video editor.

## What Wan 3.0 can and cannot do here

| Feature | Wan 3.0 / Atlas | Notes |
|--------|------------------|--------|
| Optional cloud AI clip (I2V) | Yes | `AI_VIDEO_PROVIDER=atlas`, model `alibaba/wan-3.0/image-to-video` |
| Song analysis (audio + artwork) | Partial | With `AI_PROVIDER=atlas`, analysis uses **text-only** LLM on Atlas — **not** multimodal audio. Keep `AI_PROVIDER=gemini` + `GEMINI_API_KEY` for full audio analysis. |
| Campaign plan / captions / hooks | Yes | Atlas chat models via `invokeLlm` |
| Cover art pixels | No (today) | Still **Gemini Nano Banana** or OpenAI/fal/Replicate — Atlas image API is not wired in this repo yet |
| Main campaign promo encode | No | Still **on-device** WebCodecs |

## Supabase Edge Function secrets

| Secret | Purpose |
|--------|---------|
| `ATLASCLOUD_API_KEY` | Atlas API key ([console](https://www.atlascloud.ai/console/api-keys)) |
| `AI_PROVIDER` | `atlas` — routes chat/JSON LLM to Atlas |
| `ATLAS_CHAT_MODEL` | Chat model id (default `deepseek-v3`) |
| `AI_VIDEO_PROVIDER` | `atlas` — Wan 3.0 I2V clips |
| `ATLAS_WAN_I2V_MODEL` | Default `alibaba/wan-3.0/image-to-video` |
| `ATLAS_WAN_RESOLUTION` | e.g. `720p`, `1080p` |
| `ATLAS_WAN_USD_PER_SEC` | List price per output second for credit math (default `0.05`) |

## Usage-based in-app credits

When **`USAGE_BASED_CREDITS=true`**, flat per-action credit costs are replaced for **analyze song**, **generate content**, and **cloud AI video clips** by charges derived from estimated provider USD:

| Env | Default | Meaning |
|-----|---------|---------|
| `CREDIT_USD_VALUE` | `0.01` | 1 credit ≈ $0.01 |
| `CREDIT_MARKUP` | `1.15` | Margin on provider cost |
| `ATLAS_LLM_USD_PER_1M_INPUT` / `_OUTPUT` | Atlas token rates | LLM metering |
| `GEMINI_LLM_USD_PER_1M_*` | Gemini-ish defaults | Used when `AI_PROVIDER=gemini` and usage-based is on |

Campaign **plan generation** stays free (`generate_campaign`). Cover art keeps flat credits unless you add separate metering later.

Flow:

1. **Hold** credits from a conservative estimate before the API call.
2. **Settle** to actual usage (tokens or video seconds) after success; refund overage or charge a small top-up.

## Example: Atlas-only stack (text + clips)

```text
AI_PROVIDER=atlas
ATLASCLOUD_API_KEY=...
AI_VIDEO_PROVIDER=atlas
USAGE_BASED_CREDITS=true
```

For **best song analysis with audio**, prefer:

```text
AI_PROVIDER=gemini
GEMINI_API_KEY=...
AI_VIDEO_PROVIDER=atlas
ATLASCLOUD_API_KEY=...
USAGE_BASED_CREDITS=true
```

Redeploy edge functions after code changes; secrets alone do not require a frontend redeploy.

See also [FREE_AI.md](./FREE_AI.md) and [PROMO_VIDEO.md](./PROMO_VIDEO.md).
