-- 2025 천상고 공통수학2 2학기 기말: links the hand-solution image of every problem (1~24) and corrects the
-- class-recording links. The exam has 24 problems (선택형 21 + 단답형 3 = 22, 23, 24); the recording
-- explains 20, 21, 22 and 24, so the link first saved on 23 moves to 24.
-- Images must be in the private "problem-solutions" bucket under 2025-cheonsang-g1-2-final/NN.webp.
-- Safe to run more than once.
update public.school_exam_master set question_count = 24, is_active = true
where exam_year = 2025 and school_name = '천상고' and subject = '공통수학2' and exam_type = '2학기 기말';

insert into public.problem_explanations
  (content_key, title, youtube_video_id, youtube_start_seconds, image_url, updated_by, updated_at)
select 'school:' || exam.id || ':' || g.n,
       case when video.start_seconds is null then '손풀이' else '이주백T 수업 풀이 · 손풀이' end,
       case when video.start_seconds is null then null else 'mPLLgO8J9kY' end,
       video.start_seconds,
       '/api/files/problem-solution/2025-cheonsang-g1-2-final/' || lpad(g.n::text, 2, '0') || '.webp',
       '관리자', now()
from (select id from public.school_exam_master
      where exam_year = 2025 and school_name = '천상고' and subject = '공통수학2' and exam_type = '2학기 기말'
      order by id limit 1) exam
cross join generate_series(1, 24) as g(n)
left join (values (20, 4510), (21, 4686), (22, 5000), (24, 5114)) as video(problem, start_seconds)
  on video.problem = g.n
on conflict (content_key) do update set
  title = excluded.title,
  youtube_video_id = excluded.youtube_video_id,
  youtube_start_seconds = excluded.youtube_start_seconds,
  image_url = excluded.image_url,
  updated_by = excluded.updated_by,
  updated_at = excluded.updated_at;

select count(*) as problems,
       count(p.youtube_video_id) as with_video,
       count(p.image_url) as with_image
from public.problem_explanations p
join public.school_exam_master e on p.content_key like 'school:' || e.id || ':%'
where e.exam_year = 2025 and e.school_name = '천상고' and e.subject = '공통수학2' and e.exam_type = '2학기 기말';
