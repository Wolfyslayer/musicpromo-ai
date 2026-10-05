# Plan, credits & Stripe Pro

Premium AI (song analysis, content helpers, cover art) uses **monthly credits**. **Campaign plans** and **cloud AI video clips** are always free. Users can also earn extra credits from a **7-day monthly claim streak** (Settings → Plan & credits).

## Database

Run once in **Supabase → SQL editor** (not applied by GitHub Deploy):

- `supabase/migrations/20261005_user_billing.sql`
- `supabase/migrations/20261006_daily_credit_claim.sql`
- `supabase/migrations/20261005_user_role_guard.sql` (staff roles)

Creates `user_billing` and `credit_ledger` with RLS (users can read their own rows; Edge Functions write via service role).

## Supabase Edge secrets

| Secret | Purpose |
|--------|---------|
| `STRIPE_SECRET_KEY` | Stripe API (Checkout + subscription fetch) |
| `STRIPE_PRO_PRICE_ID` | Recurring price id for Pro |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_…`) |
| `PUBLIC_APP_URL` | App origin for Checkout return URLs (e.g. `https://musicpromoai.site`) |

Optional tuning:

| Secret | Default |
|--------|---------|
| `BILLING_FREE_MONTHLY_CREDITS` | 120 |
| `BILLING_PRO_MONTHLY_CREDITS` | 1200 |
| `DAILY_CLAIM_BASE_CREDITS` | 2 (days 1–2, 4–6); day 3 = 2×; day 7 = 4× |
| `CREDIT_COST_ANALYZE_SONG` | 3 |
| `CREDIT_COST_GENERATE_CAMPAIGN` | 0 (always free) |
| `CREDIT_COST_GENERATE_CONTENT` | 2 |
| `CREDIT_COST_COVER_ART` | 8 |
| `CREDIT_COST_COVER_ART_EDIT` | 10 |
| `CREDIT_COST_AI_VIDEO_CLIP` | 0 (always free) |

### 7-day claim streak

Once per UTC day, up to 7 times per calendar month. Consecutive days only — miss a day and the streak restarts at day 1. Bonuses: **day 3 = 2×** base, **day 7 = 4×** base. Claim streak resets when monthly credits reset.

API: `getUserBilling` with `{ "action": "claim" }`.

## Deploy functions

After merge, deploy (GitHub Actions **Deploy** workflow or CLI):

- `getUserBilling`
- `createSubscriptionCheckout`
- `stripeBillingWebhook`
- Updated: `analyzeSong`, `generateCampaign`, `generateContent`, `generateCoverArt`, `generateAiVideoClip`

## Stripe webhook

In Stripe Dashboard → Developers → Webhooks, add endpoint:

`https://<project-ref>.supabase.co/functions/v1/stripeBillingWebhook`

Events (minimum):

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Use the signing secret as `STRIPE_WEBHOOK_SECRET`. The handler verifies the `Stripe-Signature` header (HMAC SHA-256).

## Staff / developer roles (no credits, no Stripe)

Premium AI checks honor **`dev`** and **`admin`** roles. Those accounts never spend credits and do not need Pro checkout.

Assign in either place (both work; JWT metadata wins when set):

1. **Table Editor → `public.users` → `role`**  
   Set to `dev` or `admin` for your user id (SQL example):

   ```sql
   update public.users set role = 'dev' where email = 'you@example.com';
   ```

2. **Authentication → Users → user → Raw user meta → `app_metadata`**  

   ```json
   { "role": "dev" }
   ```

Run `supabase/migrations/20261005_user_role_guard.sql` so users **cannot** change their own `role` from the app.

Optional emergency allowlist (Edge secret, comma-separated UUIDs):

- `BILLING_BYPASS_USER_IDS`

## App UX

- **Settings → Plan & credits** (`/settings/billing`): balance, cost table, **Upgrade to Pro** (Stripe Checkout redirect).
- Insufficient credits return HTTP **402** with `code: INSUFFICIENT_CREDITS`; the UI points users to Plan & credits.

Manage subscription changes (cancel, payment method) in the [Stripe Customer Portal](https://dashboard.stripe.com/settings/billing/portal) once configured; wire a portal link later if needed.
