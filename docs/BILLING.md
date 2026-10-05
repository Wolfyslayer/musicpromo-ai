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

Plus `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (`pk_test_…` / `pk_live_…`, same mode as the secret key), `STRIPE_WEBHOOK_SECRET`, `PUBLIC_APP_URL`.

Checkout opens **in-app** (Stripe Embedded Checkout modal). The publishable key is returned by `getUserBilling` and can also be set at build time as `VITE_STRIPE_PUBLISHABLE_KEY` for GitHub Pages.

Checkout (subscription): `{ "plan": "creator"|"pro"|"studio", "interval": "month"|"year" }`.

### One-time credit packs

| Pack ID | Credits | Target USD |
|---------|---------|------------|
| `boost_100` | 100 | $5 |
| `boost_300` | 300 | $12 |
| `boost_800` | 800 | $28 |
| `boost_2000` | 2000 | $60 |

| Secret | Target USD |
|--------|------------|
| `STRIPE_CREDIT_PACK_BOOST_100_PRICE_ID` | $5 |
| `STRIPE_CREDIT_PACK_BOOST_300_PRICE_ID` | $12 |
| `STRIPE_CREDIT_PACK_BOOST_800_PRICE_ID` | $28 |
| `STRIPE_CREDIT_PACK_BOOST_2000_PRICE_ID` | $60 |

Optional credit overrides: `CREDIT_PACK_100_CREDITS`, `CREDIT_PACK_300_CREDITS`, etc.

Checkout (pack): `{ "checkoutType": "credit_pack", "packId": "boost_100"|"boost_300"|"boost_800"|"boost_2000" }`.

Credits are granted on `checkout.session.completed` (webhook). Catalog in `creditPacks.ts`.

## Premium backends

| Secret | Feature |
|--------|---------|
| `SUNO_API_KEY` (TemPolor API key), `PUBLIC_APP_URL`, optional `SUNO_API_BASE_URL` (default `https://api.tempolor.com`), optional `SUNO_API_MODEL` (default `tempolor-latest`) | `generateSunoTrack` (+ deploy `tempolorSongCallback`) |
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

## Troubleshooting Stripe checkout

### “Missing price” / “No such price” / product id errors

Supabase secrets must hold **Price IDs** (`price_1ABC…`), **not** Product IDs (`prod_…`). Checkout sends `line_items[0][price]=price_…`. If you paste `prod_…`, Stripe returns an error about the product/price.

**How to copy the right ID (matches your catalog names):**

| Stripe product (your list) | Supabase secret | Price type |
|-----------------------------|-----------------|------------|
| Creator Plan · $9.00 | `STRIPE_CREATOR_MONTHLY_PRICE_ID` | Recurring **month** |
| Creator Plan · $86.00 | `STRIPE_CREATOR_YEARLY_PRICE_ID` | Recurring **year** |
| Pro Plan · $18.00 / $172.00 | `STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_YEARLY_PRICE_ID` | month / year |
| Studio Plan · $32.00 / $306.00 | `STRIPE_STUDIO_MONTHLY_PRICE_ID` / `STRIPE_STUDIO_YEARLY_PRICE_ID` | month / year |
| Credits 100 · $5.00 | `STRIPE_CREDIT_PACK_BOOST_100_PRICE_ID` | **One time** |
| Credits 300 · $12.00 | `STRIPE_CREDIT_PACK_BOOST_300_PRICE_ID` | One time |
| Credits 800 · $28.00 | `STRIPE_CREDIT_PACK_BOOST_800_PRICE_ID` | One time |
| Credits 2000 · $60.00 | `STRIPE_CREDIT_PACK_BOOST_2000_PRICE_ID` | One time |

On mobile: open the product → tap the **price row** ($9.00 USD, etc.) → copy **Price ID**. On desktop: **Product catalog → product → Pricing → ⋮ on the price → Copy price ID**.

### Test vs live mismatch

`STRIPE_SECRET_KEY` must match the mode of every `price_…` ID:

- `sk_test_…` → prices created in **Test mode**
- `sk_live_…` → prices created in **Live mode**

Mixing test keys with live prices (or the reverse) produces “no such price” even when the ID looks correct.

### After changing secrets

Edge Function secrets apply immediately; redeploy is not required. Try checkout again in **Settings → Plan & credits**.
