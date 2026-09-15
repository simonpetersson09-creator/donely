REVOKE ALL ON FUNCTION public.record_app_open(TEXT, TEXT, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_app_open(TEXT, TEXT, TEXT) TO service_role;