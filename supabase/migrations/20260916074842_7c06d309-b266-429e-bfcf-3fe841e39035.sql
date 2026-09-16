CREATE TABLE public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  message text not null,
  platform text,
  created_at timestamptz not null default now()
);

GRANT INSERT ON public.app_feedback TO anon, authenticated;
GRANT ALL ON public.app_feedback TO service_role;

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can send feedback"
ON public.app_feedback
FOR INSERT
TO anon, authenticated
WITH CHECK (true);