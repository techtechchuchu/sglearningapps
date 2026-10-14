-- Additive only: existing student, roster, exam and wrong-answer tables are unchanged.
-- API routes use the server-only Supabase key; browser clients have no direct table access.
create table if not exists public.problem_explanations (
  content_key text primary key,
  title text not null default '',
  youtube_video_id text,
  image_url text,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  constraint problem_explanations_youtube_id_format
    check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  constraint problem_explanations_content_key_length
    check (length(content_key) between 8 and 400)
);

alter table public.problem_explanations enable row level security;
revoke all on public.problem_explanations from anon, authenticated;

