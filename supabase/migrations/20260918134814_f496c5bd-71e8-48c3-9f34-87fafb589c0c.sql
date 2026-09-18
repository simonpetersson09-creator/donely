DELETE FROM public.app_opens;

CREATE OR REPLACE FUNCTION public.record_app_open(_device_id text, _platform text DEFAULT NULL::text, _app_version text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _device_id IS NULL OR length(trim(_device_id)) = 0 THEN
    RETURN;
  END IF;

  -- Only installed mobile app opens are counted; web/preview sessions are ignored.
  IF _platform IS NULL OR lower(_platform) NOT IN ('ios', 'android') THEN
    RETURN;
  END IF;

  INSERT INTO public.app_opens (device_id, platform, app_version)
  VALUES (_device_id, lower(_platform), _app_version)
  ON CONFLICT (device_id) DO UPDATE
    SET last_seen = now(),
        open_count = public.app_opens.open_count + 1,
        platform = EXCLUDED.platform,
        app_version = COALESCE(EXCLUDED.app_version, public.app_opens.app_version);
END;
$$;