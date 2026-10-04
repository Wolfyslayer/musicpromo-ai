# In-app support chat (AI + email tickets)

Floating **Help & support** widget: signed-in users can use an optional AI assistant; anyone can **Email the team**, which creates a ticket and sends email to `support@musicpromoai.site` (Reply-To = user).

## Supabase setup (tickets — always)

1. Run the `support_tickets` and `support_chat_usage` section in `supabase/schema.sql` (SQL editor).
2. Deploy:
   ```bash
   supabase functions deploy submitSupportTicket
   ```
3. Secrets:
   - `RESEND_API_KEY` — sends ticket mail
   - `SUPPORT_FROM_EMAIL` — e.g. `MusicPromo AI <notifications@yourdomain.com>` (verified in Resend)
   - Optional: reuse `LAUNCH_DIGEST_FROM_EMAIL` if `SUPPORT_FROM_EMAIL` is unset

Tickets get a public id like `MP-A1B2C3`. Reply from your inbox (Resend sets **Reply-To** on the team notification).

## AI assistant (optional — not required for tickets)

The assistant uses the same **OpenAI-compatible** stack as campaign generation (`invokeLlm` / `invokeLlmChat`). You do **not** have to use OpenAI’s paid API.

### Option A — Free/cheap LLM (recommended): Groq

Same secrets as [FREE_AI.md](./FREE_AI.md) — one setup powers campaigns **and** support chat:

| Secret | Value |
|--------|--------|
| `OPENAI_API_KEY` | Groq key (`gsk_...`) |
| `OPENAI_BASE_URL` | `https://api.groq.com/openai/v1` |
| `OPENAI_MODEL` | `llama-3.1-8b-instant` (fast, generous free tier) or `llama-3.3-70b-versatile` (better answers) |

Then deploy the chat function:

```bash
supabase functions deploy supportChat
```

No OpenAI account or `sk-...` key is involved when `OPENAI_BASE_URL` points at Groq.

Other free-tier providers (Gemini OpenAI compatibility, OpenRouter `:free` models) are listed in **FREE_AI.md**.

### Option B — No AI at all (email only, $0 LLM)

1. Deploy only `submitSupportTicket` (skip `supportChat`).
2. In your **frontend build** (GitHub Actions / `.env.local`), set:
   ```bash
   VITE_SUPPORT_AI=off
   ```
3. Rebuild and deploy the site.

Signed-in users see the **ticket form only** — no chat, no LLM calls. Guests on `/privacy` and `/terms` behave the same as before.

## Rate limits

- AI (when enabled): 40 user messages per hour per user (`support_chat_usage`).

## Troubleshooting “Could not reach Edge Function”

1. **SQL** — In Supabase SQL editor, run the `support_tickets` / `support_chat_usage` block from `supabase/schema.sql`.
2. **Deploy** — The live site calls `submitSupportTicket`. After merging support chat, run **GitHub → Actions → Deploy → Run workflow** (or `supabase functions deploy submitSupportTicket --project-ref YOUR_REF`).
3. **Frontend env** — GitHub Pages build must use the same project as your functions: repository variables/secrets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Supabase → Settings → API** (Project URL + anon public key).
4. **Resend** — Ticket save can succeed even if email fails; check function logs in Supabase → Edge Functions → submitSupportTicket → Logs.
