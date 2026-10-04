# In-app support chat (AI + email tickets)

Floating **Help & support** widget: signed-in users get an AI assistant; anyone can **Email the team**, which creates a ticket and sends email to `support@musicpromoai.site` (Reply-To = user).

## Supabase setup

1. Run the `support_tickets` and `support_chat_usage` section in `supabase/schema.sql` (SQL editor).
2. Deploy edge functions:
   ```bash
   supabase functions deploy supportChat submitSupportTicket
   ```
3. Secrets (Project Settings → Edge Functions):
   - `OPENAI_API_KEY` — required for AI replies
   - `RESEND_API_KEY` — required to email tickets
   - `SUPPORT_FROM_EMAIL` — e.g. `MusicPromo AI <notifications@yourdomain.com>` (verified in Resend)
   - Optional: reuse `LAUNCH_DIGEST_FROM_EMAIL` if `SUPPORT_FROM_EMAIL` is unset

Tickets are stored in `support_tickets` with a public id like `MP-A1B2C3`. You reply from your inbox to the user (Resend sets Reply-To on the team notification).

## Rate limits

- AI: 40 user messages per hour (`support_chat_usage`).
