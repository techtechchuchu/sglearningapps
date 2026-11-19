-- Registers the 2025 천상고 공통수학2 2학기 기말 exam as a 학교 기출 시험 and links the
-- 2026-11-16 class recording (https://youtu.be/mPLLgO8J9kY) to the four problems it explains.
-- Start times were read off the recording: 20번 75:10, 21번 78:06, 22번 83:20, 23번 85:14.
-- Safe to run more than once. A solution image already linked to a problem is kept.
with created as (
  insert into public.school_exam_master
    (exam_year, school_name, subject, exam_type, question_count, scope, display_name, is_active, created_at)
  select 2025, '천상고', '공통수학2', '2학기 기말', 23, '고1 2학기 기말', '2025 천상고 공통수학2 2학기 기말', true, now()
  where not exists (
    select 1 from public.school_exam_master
    where exam_year = 2025 and school_name = '천상고' and subject = '공통수학2' and exam_type = '2학기 기말'
  )
  returning id
),
exam as (
  select id from created
  union all
  select id from public.school_exam_master
  where exam_year = 2025 and school_name = '천상고' and subject = '공통수학2' and exam_type = '2학기 기말'
  limit 1
)
insert into public.problem_explanations
  (content_key, title, youtube_video_id, youtube_start_seconds, updated_by, updated_at)
select 'school:' || exam.id || ':' || video.problem, '이주백T 수업 풀이', 'mPLLgO8J9kY', video.start_seconds, '관리자', now()
from exam,
  (values (20, 4510), (21, 4686), (22, 5000), (23, 5114)) as video(problem, start_seconds)
on conflict (content_key) do update set
  title = excluded.title,
  youtube_video_id = excluded.youtube_video_id,
  youtube_start_seconds = excluded.youtube_start_seconds,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at
returning content_key, youtube_start_seconds;
