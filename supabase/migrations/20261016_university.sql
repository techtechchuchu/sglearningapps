-- 대학생 계정은 학원 users / student_roster와 별도로 보관합니다.
create table if not exists public.university_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.university_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.university_users(id) on delete cascade,
  title text not null,
  semester text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists university_courses_user_id_idx on public.university_courses(user_id);

create table if not exists public.university_exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.university_users(id) on delete cascade,
  course_id uuid not null references public.university_courses(id) on delete cascade,
  title text not null,
  exam_date date not null,
  created_at timestamptz not null default now()
);
create index if not exists university_exams_user_id_idx on public.university_exams(user_id);

create table if not exists public.university_mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.university_users(id) on delete cascade,
  course_id uuid not null references public.university_courses(id) on delete cascade,
  problem_label text not null,
  memo text not null default '',
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists university_mistakes_user_id_idx on public.university_mistakes(user_id);

alter table public.university_users enable row level security;
alter table public.university_courses enable row level security;
alter table public.university_exams enable row level security;
alter table public.university_mistakes enable row level security;
-- 현재 앱은 서버 전용 서비스 키에서 세션 검증 후 user_id를 제한합니다. anon 정책은 만들지 않습니다.

