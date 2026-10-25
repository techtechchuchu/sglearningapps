-- Private, university-only lecture transcript and study notes.
begin;
create table if not exists public.university_lecture_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.university_users(id) on delete cascade,
  course_id uuid not null references public.university_courses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  transcript jsonb not null default '[]'::jsonb check (jsonb_typeof(transcript) = 'array'),
  summary text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists university_lecture_notes_user_updated_idx
  on public.university_lecture_notes (user_id, updated_at desc);
alter table public.university_lecture_notes enable row level security;
revoke all on public.university_lecture_notes from public, anon, authenticated;
grant select, insert, update, delete on public.university_lecture_notes to service_role;
commit;

