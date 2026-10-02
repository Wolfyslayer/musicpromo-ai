-- Public @handle for profiles (Community-friendly URLs).
alter table public.users add column if not exists handle text;

create unique index if not exists users_handle_unique
  on public.users (lower(handle))
  where handle is not null and handle <> '';
