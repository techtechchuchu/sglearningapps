create table if not exists public.support_request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete cascade,
  uploader_role text not null,
  uploader_name text not null,
  file_name text not null,
  content_type text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists support_request_attachments_request_idx
  on public.support_request_attachments (request_id, created_at);

alter table public.support_request_attachments enable row level security;
revoke all on public.support_request_attachments from anon, authenticated;
grant select, insert, delete on public.support_request_attachments to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-request-attachments',
  'support-request-attachments',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
)
on conflict (id) do update set public = false, file_size_limit = 4194304,
  allowed_mime_types = excluded.allowed_mime_types;
