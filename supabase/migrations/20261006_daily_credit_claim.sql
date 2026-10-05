-- 7-day monthly login claim streak (resets with credits period).

alter table public.user_billing
  add column if not exists claim_month_start timestamptz,
  add column if not exists claim_days_completed integer not null default 0 check (claim_days_completed >= 0 and claim_days_completed <= 7),
  add column if not exists last_claim_utc_date date;

comment on column public.user_billing.claim_days_completed is
  'How many consecutive daily claims completed this UTC month (max 7).';
