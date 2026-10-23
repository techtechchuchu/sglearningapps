begin;

-- Legacy students continue to sign in with their existing name.
-- New signups choose a unique login ID, while username remains the roster name.
alter table public.users add column if not exists login_id text;

create unique index if not exists users_login_id_unique_idx
  on public.users (lower(login_id)) where login_id is not null;

commit;
