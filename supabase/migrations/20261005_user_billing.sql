-- Monthly AI credits + optional Stripe subscription (Pro).

create table if not exists public.user_billing (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  credits_balance integer not null default 0 check (credits_balance >= 0),
  credits_period_start timestamptz not null default date_trunc('month', now() at time zone 'utc'),
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  subscription_current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

alter table public.user_billing enable row level security;
alter table public.credit_ledger enable row level security;

create policy "user_billing read own" on public.user_billing
  for select using (user_id = auth.uid());

create policy "credit_ledger read own" on public.credit_ledger
  for select using (user_id = auth.uid());
