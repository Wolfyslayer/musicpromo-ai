-- Multi-tier subscriptions (creator / pro / studio) + billing interval.

alter table public.user_billing drop constraint if exists user_billing_plan_check;

alter table public.user_billing
  add column if not exists billing_interval text not null default 'month'
    check (billing_interval in ('month', 'year')),
  add column if not exists stripe_price_id text;

alter table public.user_billing
  add constraint user_billing_plan_check
  check (plan in ('free', 'creator', 'pro', 'studio'));

comment on column public.user_billing.plan is
  'free | creator ($15/mo tier) | pro | studio — set by Stripe webhook when subscription is active.';
