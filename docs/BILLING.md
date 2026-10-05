# Plans, credits & Stripe

**Free tier:** monthly credits, campaign plans and cloud video clips always free, daily 🎁 claims in the header.

**Paid tiers (monthly or yearly via Stripe):**

| Plan | Target price | Credits / month | Premium |
|------|----------------|-----------------|--------|
| **Creator** | $15/mo · $144/yr | 450 | Suno songs + stem splitter |
| **Pro** | $29/mo · $278/yr | 1,200 | Same premium tools, more credits |
| **Studio** | $49/mo · $470/yr | 3,500 | Power-user volume |

Premium tools live at **`/premium`** (AI songs & stems). Requires active **Creator, Pro, or Studio** subscription (or staff `dev`/`admin`).

## Database migrations

Run in **Supabase → SQL editor**:

- `supabase/migrations/20261005_user_billing.sql`
- `supabase/migrations/20261006_daily_credit_claim.sql`
- `supabase/migrations/20261006_subscription_tiers.sql`
- `supabase/migrations/20261005_user_role_guard.sql` (staff roles)

## Stripe products & secrets

Create **6 recurring Prices** in Stripe (or 3 products with monthly + yearly). Map each to Supabase secrets:

| Secret | Plan |
|--------|------|
| `STRIPE_CREATOR_MONTHLY_PRICE_ID` | Creator monthly (~$15) |
| `STRIPE_CREATOR_YEARLY_PRICE_ID` | Creator yearly (~$144) |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Pro monthly (~$29) — legacy alias: `STRIPE_PRO_PRICE_ID` |
| `STRIPE_PRO_YEARLY_PRICE_ID` | Pro yearly (~$278) |
| `STRIPE_STUDIO_MONTHLY_PRICE_ID` | Studio monthly (~$49) |
| `STRIPE_STUDIO_YEARLY_PRICE_ID` | Studio yearly (~$470) |

Also required:

| Secret | Purpose |
|--------|---------|
| `STRIPE_SECRET_KEY` | Stripe API |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing (`whsec_…`) |
| `PUBLIC_APP_URL` | Checkout return URLs |

Checkout body: `{ "plan": "creator"|"pro"|"studio", "interval": "month"|"year" }` → `createSubscriptionCheckout`.

Webhook maps **Price id → plan tier** and sets `user_billing.plan` to `creator` | `pro` | `studio`.

## Premium AI backends

| Secret | Feature |
|--------|---------|
| `SUNO_API_BASE_URL` + `SUNO_API_KEY` | Suno-compatible song API (`generateSunoTrack`) |
| `REPLICATE_API_TOKEN` | Stem splitter via Demucs (`splitAudioStems`) |

Credit costs (defaults): `suno_generation` 25, `stem_split` 18. Premium gate returns **403** `PREMIUM_REQUIRED` on free tier.

## Credits & claims

| Secret | Default |
|--------|---------|
| `BILLING_FREE_MONTHLY_CREDITS` | 120 |
| `BILLING_CREATOR_MONTHLY_CREDITS` | 450 |
| `BILLING_PRO_MONTHLY_CREDITS` | 1200 |
| `BILLING_STUDIO_MONTHLY_CREDITS` | 3500 |
| `DAILY_CLAIM_BASE_CREDITS` | 2 (day 3 = 2×, day 7 = 4×) |

Always-free actions: `generate_campaign`, `ai_video_clip`.

Daily claim: `getUserBilling` `{ "action": "claim" }` or header 🎁 UI.

## Deploy functions

- `getUserBilling`, `createSubscriptionCheckout`, `stripeBillingWebhook`
- `generateSunoTrack`, `splitAudioStems`
- Updated billing on existing AI functions

Webhook URL: `https://<project-ref>.supabase.co/functions/v1/stripeBillingWebhook`

## Staff roles

`dev` / `admin` on `public.users.role` or JWT `app_metadata.role` — unlimited credits and all premium features. See earlier migration for self-service role guard.

## App UX

- **Settings → Plan & credits** — tier picker (monthly/yearly), balance, costs
- **Header 🎁** — daily claim streak
- **`/premium`** — Suno + stem splitter

Manage billing in [Stripe Customer Portal](https://dashboard.stripe.com/settings/billing/portal) when enabled.
