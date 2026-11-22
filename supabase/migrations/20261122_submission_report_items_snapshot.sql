-- Keep the actual recipients printed in each report PDF.
alter table public.submission_report_history
  add column if not exists items jsonb;
