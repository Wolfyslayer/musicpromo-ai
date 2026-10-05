# In-app support chat (AI + email tickets)

Floating **Help & support** widget: signed-in users can use an optional AI assistant; anyone can **Email the team**, which creates a ticket and sends email to `support@musicpromoai.site` (Reply-To = user).

## Supabase setup (tickets — always)

1. Run the `support_tickets` and `support_chat_usage` section in `supabase/schema.sql` (SQL editor).
2. Deploy (required for the in-app form to work):
   ```bash
   supabase functions deploy submitSupportTicket
   ```
   Or run your GitHub **Deploy** workflow so Edge Functions sync to the same project as `VITE_SUPABASE_URL`.
3. Secrets:
   - `RESEND_API_KEY` — sends ticket mail
   - `SUPPORT_FROM_EMAIL` — e.g. `MusicPromo AI <notifications@yourdomain.com>` (verified in Resend)
   - Optional: reuse `LAUNCH_DIGEST_FROM_EMAIL` if `SUPPORT_FROM_EMAIL` is unset

Tickets get a public id like `MP-A1B2C3`. Reply from your inbox (Resend sets **Reply-To** on the team notification).

## AI assistant (optional — not required for tickets)

The assistant uses the same stack as campaign generation (`invokeLlmChat` → **Gemini by default**).

### Option A — Gemini free tier (recommended)

Same secrets as [FREE_AI.md](./FREE_AI.md):

| Secret | Value |
|--------|--------|
| `GEMINI_API_KEY` | [AI Studio](https://aistudio.google.com/apikey) key |
| `GEMINI_MODEL` | Optional — default `gemini-2.5-flash` |

Then deploy:

```bash
supabase functions deploy supportChat
```

### Option B — Groq or OpenAI (text only)

Set `AI_PROVIDER=openai` and `OPENAI_BASE_URL` / `OPENAI_MODEL` per **FREE_AI.md** (Groq or OpenAI).

### Option C — No AI at all (email only, $0 LLM)

1. Deploy only `submitSupportTicket` (skip `supportChat`).
2. In your **frontend build** (GitHub Actions / `.env.local`), set:
   ```bash
   VITE_SUPPORT_AI=off
   ```
