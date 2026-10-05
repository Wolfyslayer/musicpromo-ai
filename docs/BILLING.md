# Plan, credits & Stripe Pro

Premium AI features (song analysis, campaign generation, content helpers, cover art, optional cloud motion clips) consume **monthly credits** enforced on the server before each model call.

## Database

Run once in **Supabase → SQL editor** (not applied by GitHub Deploy):

- `supabase/migrations/20261005_user_billing.sql`

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
| `BILLING_FREE_MONTHLY_CREDITS` | 40 |
| `BILLING_PRO_MONTHLY_CREDITS` | 400 |
| `CREDIT_COST_ANALYZE_SONG` | 3 |
| `CREDIT_COST_GENERATE_CAMPAIGN` | 12 |
| `CREDIT_COST_GENERATE_CONTENT` | 2 |
| `CREDIT_COST_COVER_ART` | 8 |
| `CREDIT_COST_COVER_ART_EDIT` | 10 |
| `CREDIT_COST_AI_VIDEO_CLIP` | 20 |

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

## App UX

- **Settings → Plan & credits** (`/settings/billing`): balance, cost table, **Upgrade to Pro** (Stripe Checkout redirect).
- Insufficient credits return HTTP **402** with `code: INSUFFICIENT_CREDITS`; the UI points users to Plan & credits.

Manage subscription changes (cancel, payment method) in the [Stripe Customer Portal](https://dashboard.stripe.com/settings/billing/portal) once configured; wire a portal link later if needed.
