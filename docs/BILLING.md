# Plans, credits & Stripe

**Free tier:** 120 monthly credits, free campaign plans & cloud video clips, daily 🎁 claims.

**Paid tiers** — priced **below** typical standalone AI music apps (Suno-class ~$10–30/mo) while bundling **promo campaigns, covers, and social tools**:

| Plan | Our price | Typical stack* | Credits / mo | Premium |
|------|-----------|----------------|--------------|---------|
| **Creator** | **$9/mo** · $86/yr | ~$18/mo | 500 | Suno + stems |
| **Pro** | **$18/mo** · $172/yr | ~$32/mo | 1,400 | Same |
| **Studio** | **$32/mo** · $306/yr | ~$55/mo | 4,000 | Same |

\*Display comparison only — “elsewhere” = common Suno/UGC/design subscriptions combined, not a specific competitor.

Set **Stripe Prices** to these USD amounts (or lower for promos). The app catalog is in `subscriptionPlans.ts`.

Premium: **`/premium`** (AI songs & stems). Requires Creator, Pro, or Studio (or staff `dev`/`admin`).

## Migrations

- `20261005_user_billing.sql`
- `20261006_daily_credit_claim.sql`
- `20261006_subscription_tiers.sql`
- `20261005_user_role_guard.sql`

## Stripe secrets

| Secret | Target USD |
|--------|------------|
| `STRIPE_CREATOR_MONTHLY_PRICE_ID` | $9/mo |
| `STRIPE_CREATOR_YEARLY_PRICE_ID` | $86/yr |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | $18/mo (legacy: `STRIPE_PRO_PRICE_ID`) |
| `STRIPE_PRO_YEARLY_PRICE_ID` | $172/yr |
| `STRIPE_STUDIO_MONTHLY_PRICE_ID` | $32/mo |
| `STRIPE_STUDIO_YEARLY_PRICE_ID` | $306/yr |

Plus `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_APP_URL`.

Checkout: `{ "plan": "creator"|"pro"|"studio", "interval": "month"|"year" }`.

## Premium backends

| Secret | Feature |
|--------|---------|
| `SUNO_API_BASE_URL` + `SUNO_API_KEY` | `generateSunoTrack` |
| `REPLICATE_API_TOKEN` | `splitAudioStems` |

Credit defaults: `suno_generation` 25, `stem_split` 18.

## Credit env overrides

| Secret | Default |
|--------|---------|
| `BILLING_FREE_MONTHLY_CREDITS` | 120 |
| `BILLING_CREATOR_MONTHLY_CREDITS` | 500 |
| `BILLING_PRO_MONTHLY_CREDITS` | 1400 |
| `BILLING_STUDIO_MONTHLY_CREDITS` | 4000 |

Always free: campaign plan, cloud AI video clip. Daily claim via header 🎁.

## Deploy

`getUserBilling`, `createSubscriptionCheckout`, `stripeBillingWebhook`, `generateSunoTrack`, `splitAudioStems`, plus existing AI functions.

Webhook: `https://<project-ref>.supabase.co/functions/v1/stripeBillingWebhook`
