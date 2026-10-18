-- Run after 20261018_member_identity.sql. A staff approval creates the
-- roster assignment and linked academy login together, or creates neither.
begin;
alter table public.sg_academy_requests
  add column if not exists requested_class text not null default '';
alter table public.sg_academy_requests
  add column if not exists requested_books text[] not null default '{}'::text[];
create or replace function public.sg_register_and_review_academy(
  p_request uuid, p_actor text, p_class text, p_school text,
  p_grade text, p_books text[]
) returns bigint
language plpgsql security definer set search_path=public as $$
declare
  req public.sg_academy_requests;
  member public.university_users;
  book_count integer;
  roster_id bigint;
  books text[];
begin
  select * into req from public.sg_academy_requests where id=p_request for update;
  if not found or req.status<>'pending' then raise exception 'request_not_pending'; end if;
  if p_actor<>'전체 관리자' and p_actor<>req.teacher_name then raise exception 'forbidden'; end if;
  select * into member from public.university_users where id=req.user_id for update;
  if not found or member.academy_username is not null then raise exception 'already_connected'; end if;
  if length(btrim(p_class))<1 or length(btrim(p_class))>120 or
     length(btrim(coalesce(p_school,'')))>120 or
     length(btrim(coalesce(p_grade,'')))>30 then raise exception 'invalid_assignment'; end if;
  select array_agg(distinct btrim(book) order by btrim(book)) into books
    from unnest(p_books) as supplied(book) where btrim(book)<>'';
  if books is null or cardinality(books)>20 then raise exception 'invalid_books'; end if;
  select count(*) into book_count from public.book_master
    where is_active=true and book_name=any(books);
  if book_count<>cardinality(books) then raise exception 'invalid_books'; end if;
  perform pg_advisory_xact_lock(hashtextextended('academy-user:'||req.student_name,0));
  if exists(select 1 from public.users where username=req.student_name) then
    raise exception 'existing_student_login_required';
  end if;
  if exists(select 1 from public.student_roster where student_name=req.student_name
    and teacher_name=req.teacher_name and enrollment_status<>'퇴원') then
    raise exception 'roster_exists';
  end if;
  insert into public.student_roster(
    student_name,teacher_name,class_name,school_name,grade,book_name,
    created_at,enrollment_status,exited_at,status_note
  ) values (
    req.student_name,req.teacher_name,btrim(p_class),btrim(coalesce(p_school,'')),
    btrim(coalesce(p_grade,'')),array_to_string(books,', '),
    now(),'재원',null,'스터디결 학원 연결 신청 승인'
  ) returning id into roster_id;
  insert into public.users(username,password_hash,grade,temp_password,created_at)
    values(req.student_name,encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),
           btrim(coalesce(p_grade,'')),'',now());
  update public.university_users set academy_username=req.student_name where id=req.user_id;
  update public.sg_academy_requests set status='approved',reviewer=p_actor,reviewed_at=now()
    where id=p_request;
  return roster_id;
end $$;
revoke all on function public.sg_register_and_review_academy(uuid,text,text,text,text,text[])
  from public,anon,authenticated;
grant execute on function public.sg_register_and_review_academy(uuid,text,text,text,text,text[])
  to service_role;
commit;
