REVOKE EXECUTE ON FUNCTION public.record_app_open(text, text, text) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_app_open(_device_id text, _platform text DEFAULT NULL::text, _app_version text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.app_opens (device_id, platform, app_version)
  VALUES (_device_id, _platform, _app_version)
  ON CONFLICT (device_id) DO UPDATE
    SET last_seen = now(),
        open_count = public.app_opens.open_count + 1,
        platform = COALESCE(EXCLUDED.platform, public.app_opens.platform),
        app_version = COALESCE(EXCLUDED.app_version, public.app_opens.app_version);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_app_open(text, text, text) TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON public.app_opens TO anon, authenticated;

DROP POLICY IF EXISTS "anon can record app opens" ON public.app_opens;
CREATE POLICY "anon can record app opens" ON public.app_opens FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon can update app opens" ON public.app_opens;
CREATE POLICY "anon can update app opens" ON public.app_opens FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);