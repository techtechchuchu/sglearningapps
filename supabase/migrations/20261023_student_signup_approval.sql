begin;

-- Existing student accounts remain approved; code-based signups start pending.
alter table public.users
  add column if not exists email text,
  add column if not exists signup_status text not null default 'approved',
  add column if not exists signup_reviewed_at timestamptz,
  add column if not exists signup_reviewer text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_signup_status_check'
  ) then
    alter table public.users add constraint users_signup_status_check
      check (signup_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists users_pending_signup_idx
  on public.users (created_at desc) where signup_status = 'pending';

commit;
