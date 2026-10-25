-- Launch is configured separately through server-side environment variables.
-- No existing learning records are changed by this additive migration.
begin;
create table if not exists public.university_mock_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_slug text not null,
  user_id uuid not null references public.university_users(id) on delete cascade,
  alias text not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  submitted_at timestamptz,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  score integer check (score between 0 and 100),
  unique (exam_slug, user_id),
  check (deadline_at > started_at),
  check ((submitted_at is null and score is null) or (submitted_at is not null and score is not null))
);
create index if not exists university_mock_attempts_rank_idx
  on public.university_mock_attempts (exam_slug, score desc, submitted_at asc)
  where submitted_at is not null;
alter table public.university_mock_attempts enable row level security;
revoke all on public.university_mock_attempts from public, anon, authenticated;
grant select, insert, update on public.university_mock_attempts to service_role;
commit;
