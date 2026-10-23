-- Account withdrawal is a status change. Roster, attendance and learning history remain intact.
begin;
alter table public.users add column if not exists phone text not null default '';
alter table public.users add column if not exists withdrawn_at timestamptz;
alter table public.university_users add column if not exists phone text not null default '';
alter table public.university_users add column if not exists withdrawn_at timestamptz;
create index if not exists users_withdrawn_at_idx on public.users(withdrawn_at) where withdrawn_at is not null;
create index if not exists university_users_withdrawn_at_idx on public.university_users(withdrawn_at) where withdrawn_at is not null;
commit;
