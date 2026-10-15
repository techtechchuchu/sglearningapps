-- Student check-ins and staff review. Existing learning records are unchanged.
-- Access is through authenticated server routes only, never the browser Supabase client.
create table if not exists public.attendance_codes (
  id bigint generated always as identity primary key,
  teacher_name text not null,
  class_name text not null,
  attendance_date date not null,
  code_hash text not null,
  created_at timestamptz not null default now(),
  unique (teacher_name, class_name, attendance_date)
);

create table if not exists public.attendance_records (
  id bigint generated always as identity primary key,
  student_name text not null,
  teacher_name text not null,
  class_name text not null,
  attendance_date date not null,
  status text not null default 'pending' check (status in ('pending', 'present', 'late', 'absent')),
  check_in_at timestamptz,
  location_accuracy_m integer check (location_accuracy_m is null or location_accuracy_m between 0 and 100000),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_name, teacher_name, class_name, attendance_date)
);

create index if not exists attendance_records_date_teacher_idx
  on public.attendance_records (attendance_date, teacher_name);
create index if not exists attendance_records_student_date_idx
  on public.attendance_records (student_name, attendance_date desc);

alter table public.attendance_codes enable row level security;
alter table public.attendance_records enable row level security;
revoke all on public.attendance_codes from anon, authenticated;
revoke all on public.attendance_records from anon, authenticated;

