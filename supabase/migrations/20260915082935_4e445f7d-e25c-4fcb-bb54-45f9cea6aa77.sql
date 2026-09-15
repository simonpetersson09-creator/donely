CREATE TABLE public.app_opens (
  device_id TEXT PRIMARY KEY,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  open_count INTEGER NOT NULL DEFAULT 1,
  app_version TEXT,
  platform TEXT
);

GRANT ALL ON public.app_opens TO service_role;

ALTER TABLE public.app_opens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.app_opens FOR ALL TO service_role USING (true) WITH CHECK (true);