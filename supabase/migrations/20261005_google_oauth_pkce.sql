-- Short-lived PKCE verifiers for Google sign-in (native Custom Tab / split storage).

create table if not exists public.google_oauth_pkce (
  state text primary key,
  code_verifier text not null,
  return_to text not null default '/',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists google_oauth_pkce_expires_idx on public.google_oauth_pkce (expires_at);

alter table public.google_oauth_pkce enable row level security;

-- Edge Functions use service role only.
