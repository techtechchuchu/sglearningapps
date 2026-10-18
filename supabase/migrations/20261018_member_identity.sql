-- Additive migration: existing academy users, roster and learning records are preserved.
begin;
alter table public.university_users alter column email drop not null;
alter table public.university_users alter column password_hash drop not null;
alter table public.university_users add column if not exists learner_type text not null default 'university' check (learner_type in ('school','university','general'));
alter table public.university_users add column if not exists school text not null default '';
alter table public.university_users add column if not exists grade text not null default '';
alter table public.university_users add column if not exists major text not null default '';
alter table public.university_users add column if not exists onboarding_complete boolean not null default true;
-- Existing university users keep access; only newly created accounts must onboard.
alter table public.university_users alter column onboarding_complete set default false;
alter table public.university_users add column if not exists consent_version text;
alter table public.university_users add column if not exists consent_at timestamptz;
alter table public.university_users add column if not exists academy_username text unique;

create table if not exists public.sg_identities (
  provider text not null check (provider in ('kakao','email')),
  subject text not null,
  target_role text not null check (target_role in ('student','member')),
  target_key text not null,
  created_at timestamptz not null default now(),
  primary key(provider,subject), unique(provider,target_role,target_key)
);
create table if not exists public.sg_oauth_attempts (
  state_hash text primary key, browser_hash text not null, session_hash text,
  target_role text check(target_role in ('student','member')), target_key text,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.sg_auth_limits (
  key text primary key, attempts integer not null default 1, created_at timestamptz not null default now()
);
create table if not exists public.sg_academy_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null unique references public.university_users(id) on delete cascade,
  student_name text not null, teacher_name text not null, school text not null default '', grade text not null default '',
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  reviewer text, reviewed_at timestamptz, created_at timestamptz not null default now()
);
alter table public.sg_identities enable row level security;
alter table public.sg_oauth_attempts enable row level security;
alter table public.sg_auth_limits enable row level security;
alter table public.sg_academy_requests enable row level security;
revoke all on public.sg_identities, public.sg_oauth_attempts, public.sg_auth_limits, public.sg_academy_requests from anon, authenticated;
grant all on public.sg_identities, public.sg_oauth_attempts, public.sg_auth_limits, public.sg_academy_requests to service_role;

create or replace function public.sg_auth_rate_limit(p_key text,p_limit integer) returns boolean
language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  delete from sg_auth_limits where created_at < now()-interval '1 day';
  delete from sg_oauth_attempts where expires_at < now();
  insert into sg_auth_limits(key) values(p_key) on conflict(key) do update set attempts=sg_auth_limits.attempts+1 returning attempts into n;
  return n<=p_limit;
end $$;

-- Serialize provider identity creation: retries cannot produce duplicate accounts.
create or replace function public.sg_resolve_identity(p_provider text,p_subject text,p_email text default null,p_role text default null,p_key text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare ident sg_identities; uid uuid;
begin
  if p_provider not in ('email','kakao') or length(p_subject)>200 or p_subject='' then raise exception 'invalid_identity'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provider||':'||p_subject,0));
  select * into ident from sg_identities where provider=p_provider and subject=p_subject;
  if found then
    if p_role is not null and (ident.target_role<>p_role or ident.target_key<>p_key) then raise exception 'identity_already_linked'; end if;
    return jsonb_build_object('role',ident.target_role,'key',ident.target_key);
  end if;
  if p_role is not null then
    if p_role='student' then
      if not exists(select 1 from users where username=p_key) then raise exception 'missing_account'; end if;
    elsif p_role='member' then
      if not exists(select 1 from university_users where id::text=p_key) then raise exception 'missing_account'; end if;
    else raise exception 'invalid_role'; end if;
    insert into sg_identities(provider,subject,target_role,target_key) values(p_provider,p_subject,p_role,p_key);
    return jsonb_build_object('role',p_role,'key',p_key);
  end if;
  -- Never automatically merge an existing account on email or name.
  if p_email is not null and exists(select 1 from university_users where lower(email)=lower(p_email)) then raise exception 'existing_email_login_required'; end if;
  insert into university_users(email,display_name,password_hash) values(p_email,'',null) returning id into uid;
  insert into sg_identities(provider,subject,target_role,target_key) values(p_provider,p_subject,'member',uid::text);
  return jsonb_build_object('role','member','key',uid::text);
end $$;

create or replace function public.sg_review_academy(p_request uuid,p_actor text,p_approve boolean,p_roster bigint default null) returns void
language plpgsql security definer set search_path=public as $$
declare req sg_academy_requests; roster student_roster; linked text;
begin
  select * into req from sg_academy_requests where id=p_request for update;
  if not found or req.status<>'pending' then raise exception 'request_not_pending'; end if;
  if p_actor<>'전체 관리자' and p_actor<>req.teacher_name then raise exception 'forbidden'; end if;
  select academy_username into linked from university_users where id=req.user_id for update;
  if linked is not null then raise exception 'already_connected'; end if;
  if not p_approve then
    update sg_academy_requests set status='rejected',reviewer=p_actor,reviewed_at=now() where id=p_request; return;
  end if;
  select * into roster from student_roster where id=p_roster;
  if not found or roster.enrollment_status='퇴원' or roster.teacher_name<>req.teacher_name or roster.student_name<>req.student_name then raise exception 'roster_mismatch'; end if;
  -- Existing users must prove ownership themselves. A staff click cannot take over their history.
  perform pg_advisory_xact_lock(hashtextextended('academy-user:'||roster.student_name,0));
  if exists(select 1 from users where username=roster.student_name) then raise exception 'existing_student_login_required'; end if;
  insert into users(username,password_hash,grade,temp_password,created_at)
    values(roster.student_name,encode(extensions.digest(gen_random_uuid()::text,'sha256'),'hex'),roster.grade,'',now());
  update university_users set academy_username=roster.student_name where id=req.user_id;
  update sg_academy_requests set status='approved',reviewer=p_actor,reviewed_at=now() where id=p_request;
end $$;
revoke all on function public.sg_auth_rate_limit(text,integer),public.sg_resolve_identity(text,text,text,text,text),public.sg_review_academy(uuid,text,boolean,bigint) from public,anon,authenticated;
grant execute on function public.sg_auth_rate_limit(text,integer),public.sg_resolve_identity(text,text,text,text,text),public.sg_review_academy(uuid,text,boolean,bigint) to service_role;
commit;
