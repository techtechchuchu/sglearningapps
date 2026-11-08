create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  requester_role text not null check (requester_role in ('student','teacher','university','member')),
  requester_name text not null,
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open','replied')),
  admin_reply text,
  created_at timestamptz not null default now(),
  replied_at timestamptz
);
create index if not exists support_requests_owner_created_idx on public.support_requests (requester_role, requester_name, created_at desc);
create index if not exists support_requests_status_created_idx on public.support_requests (status, created_at desc);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;
grant select, insert, update on public.support_requests to service_role;