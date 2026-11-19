-- Additive only: lets one long class video serve many problems by storing where each problem starts.
-- Existing rows keep NULL, which plays the video from the beginning as before.
alter table public.problem_explanations
  add column if not exists youtube_start_seconds integer;

alter table public.problem_explanations
  drop constraint if exists problem_explanations_youtube_start_range;

alter table public.problem_explanations
  add constraint problem_explanations_youtube_start_range
    check (youtube_start_seconds is null or youtube_start_seconds between 1 and 43200);

-- Make the API see the new column immediately.
notify pgrst, 'reload schema';
