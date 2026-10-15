-- Student-to-teacher learning questions. Only server routes with the service role access this table.
create table if not exists public.student_questions (
  id bigint generated always as identity primary key,
  student_name text not null,
  teacher_name text not null,
  class_name text not null,
  question text not null,
  problem_ref text,
  answer text,
  status text not null default 'open' check (status in ('open', 'answered', 'resolved')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  resolved_at timestamptz
);
create index if not exists student_questions_student_idx on public.student_questions (student_name, created_at desc);
create index if not exists student_questions_teacher_idx on public.student_questions (teacher_name, created_at desc);
alter table public.student_questions enable row level security;
revoke all on public.student_questions from anon, authenticated;

