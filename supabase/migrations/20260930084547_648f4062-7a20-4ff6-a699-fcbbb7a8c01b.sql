DROP POLICY IF EXISTS "anon can update app opens" ON public.app_opens;
DROP POLICY IF EXISTS "anon can record app opens" ON public.app_opens;
REVOKE INSERT, UPDATE, DELETE ON public.app_opens FROM anon, authenticated;

DROP POLICY IF EXISTS "anyone can send feedback" ON public.app_feedback;
CREATE POLICY "anyone can send bounded feedback" ON public.app_feedback
FOR INSERT TO anon, authenticated
WITH CHECK (
  char_length(btrim(message)) BETWEEN 1 AND 2000
  AND char_length(device_id) BETWEEN 1 AND 100
  AND (platform IS NULL OR platform IN ('ios','android','web'))
);