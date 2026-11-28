-- Keep the currently published winter timetable, then show the two newer posts ahead of it.
update public.student_home_slides set display_order = 30, updated_at = now()
where published->>'linkUrl' like '%224465437422';
update public.student_home_slides set display_order = 40, updated_at = now()
where published->>'kind' = 'home';
update public.student_home_slides set display_order = 50, updated_at = now()
where published->>'kind' = 'ai';
update public.student_home_slides set is_active = false, updated_at = now()
where published->>'linkUrl' like '%224465314793'
   or published->>'linkUrl' like '%224442015757'
   or published->>'linkUrl' like '%224437617530';
insert into public.student_home_slides (draft, published, display_order, is_active)
select '{"kind":"blog","title":"26년 고1 2학기 중간고사 과학 성적우수자","description":"SG 고등관 과학 성적우수자를 확인하세요.","eyebrow":"학원 소식","imageUrl":"/sg-blog-science-midterm-2026.png","linkUrl":"https://blog.naver.com/ulsansgg/224479629492"}'::jsonb, '{"kind":"blog","title":"26년 고1 2학기 중간고사 과학 성적우수자","description":"SG 고등관 과학 성적우수자를 확인하세요.","eyebrow":"학원 소식","imageUrl":"/sg-blog-science-midterm-2026.png","linkUrl":"https://blog.naver.com/ulsansgg/224479629492"}'::jsonb, 10, true
where not exists (select 1 from public.student_home_slides where published->>'linkUrl' like '%224479629492');
insert into public.student_home_slides (draft, published, display_order, is_active)
select '{"kind":"blog","title":"26년 고1 2학기 중간고사 수학 성적우수자","description":"SG 고등관 수학 성적우수자를 확인하세요.","eyebrow":"학원 소식","imageUrl":"/sg-blog-math-midterm-2026.png","linkUrl":"https://blog.naver.com/ulsansgg/224476134438"}'::jsonb, '{"kind":"blog","title":"26년 고1 2학기 중간고사 수학 성적우수자","description":"SG 고등관 수학 성적우수자를 확인하세요.","eyebrow":"학원 소식","imageUrl":"/sg-blog-math-midterm-2026.png","linkUrl":"https://blog.naver.com/ulsansgg/224476134438"}'::jsonb, 20, true
where not exists (select 1 from public.student_home_slides where published->>'linkUrl' like '%224476134438');
