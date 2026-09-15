CREATE OR REPLACE FUNCTION public.record_app_open(_device_id TEXT, _platform TEXT DEFAULT NULL, _app_version TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_opens (device_id, platform, app_version)
  VALUES (_device_id, _platform, _app_version)
  ON CONFLICT (device_id) DO UPDATE
    SET last_seen = now(),
        open_count = public.app_opens.open_count + 1,
        platform = COALESCE(EXCLUDED.platform, public.app_opens.platform),
        app_version = COALESCE(EXCLUDED.app_version, public.app_opens.app_version);
END;
$$;

REVOKE ALL ON FUNCTION public.record_app_open(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_app_open(TEXT, TEXT, TEXT) TO service_role;