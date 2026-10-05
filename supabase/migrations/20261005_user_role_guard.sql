-- Prevent signed-in users from changing their own role (dev/admin must be set in Dashboard or SQL).

create or replace function public.guard_users_role_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id and new.role is distinct from old.role then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists users_role_guard on public.users;
create trigger users_role_guard
  before update on public.users
  for each row
  execute function public.guard_users_role_self_update();

comment on column public.users.role is
  'artist = default. dev and admin bypass AI credit limits (assign in Supabase Table Editor or SQL; not self-service).';
