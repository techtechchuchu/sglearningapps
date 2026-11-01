begin;
create table if not exists public.gyeolgyeoli_messages (
  id uuid primary key default gen_random_uuid(),
  student_username text references public.users(username) on update cascade on delete cascade,
  member_id uuid references public.university_users(id) on delete cascade,
  question text not null check (char_length(question) between 2 and 800),
  answer text not null check (char_length(answer) between 1 and 4000),
  created_at timestamptz not null default now(),
  constraint gyeolgyeoli_one_owner check (num_nonnulls(student_username, member_id) = 1)
);
create index if not exists gyeolgyeoli_student_recent_idx
  on public.gyeolgyeoli_messages (student_username, created_at desc) where student_username is not null;
create index if not exists gyeolgyeoli_member_recent_idx
  on public.gyeolgyeoli_messages (member_id, created_at desc) where member_id is not null;
alter table public.gyeolgyeoli_messages enable row level security;
revoke all on public.gyeolgyeoli_messages from public, anon, authenticated;
grant select, insert, delete on public.gyeolgyeoli_messages to service_role;
commit;
