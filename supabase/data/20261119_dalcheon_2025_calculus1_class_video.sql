-- Registers the 2025 달천고 미적분1 1학기 기말 exam as a 학교 기출 시험 and links the
-- 2026-11-17 class recording (https://youtu.be/Ikz1vGLsVhA) to the eight problems it explains.
-- Safe to run more than once: the exam is created only if missing and the links are upserted.
-- Requires 20261119_problem_explanation_start_seconds.sql to have been applied first.
with created as (
  insert into public.school_exam_master
    (exam_year, school_name, subject, exam_type, question_count, scope, display_name, is_active, created_at)
  select 2025, '달천고', '미적분1', '1학기 기말', 22,
         '함수의 증가와 감소 ~ 정적분의 활용', '2025 달천고 미적분1 1학기 기말', true, now()
  where not exists (
    select 1 from public.school_exam_master
    where exam_year = 2025 and school_name = '달천고' and subject = '미적분1' and exam_type = '1학기 기말'
  )
  returning id
),
exam as (
  select id from created
  union all
  select id from public.school_exam_master
  where exam_year = 2025 and school_name = '달천고' and subject = '미적분1' and exam_type = '1학기 기말'
  limit 1
)
insert into public.problem_explanations
  (content_key, title, youtube_video_id, youtube_start_seconds, updated_by, updated_at)
select 'school:' || exam.id || ':' || video.problem, '이주백T 수업 풀이', 'Ikz1vGLsVhA', video.start_seconds, '관리자', now()
from exam,
  (values (4, 77), (8, 145), (7, 338), (16, 437), (18, 627), (20, 834), (21, 918), (22, 1132))
    as video(problem, start_seconds)
on conflict (content_key) do update set
  title = excluded.title,
  youtube_video_id = excluded.youtube_video_id,
  youtube_start_seconds = excluded.youtube_start_seconds,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at
returning content_key, youtube_start_seconds;
