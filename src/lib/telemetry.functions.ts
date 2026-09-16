import { createServerFn } from "@tanstack/react-start";

export type TelemetryOverview = {
  devices: number;
  opens: number;
  active7: number;
  active30: number;
  newLast7: number;
};

export const getTelemetryOverview = createServerFn({ method: "GET" })
  .inputValidator((data: { token?: string } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<TelemetryOverview> => {
    const { requireUnlocked } = await import("@/lib/usage-gate.server");
    await requireUnlocked(data?.token);
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) return { devices: 0, opens: 0, active7: 0, active30: 0, newLast7: 0 };

    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error } = await admin
      .from("app_opens")
      .select("first_seen, last_seen, open_count");

    if (error || !rows) return { devices: 0, opens: 0, active7: 0, active30: 0, newLast7: 0 };

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    let opens = 0;
    let active7 = 0;
    let active30 = 0;
    let newLast7 = 0;

    for (const row of rows as Array<{
      first_seen: string;
      last_seen: string;
      open_count: number;
    }>) {
      opens += row.open_count ?? 0;
      const last = new Date(row.last_seen).getTime();
      const first = new Date(row.first_seen).getTime();
      if (now - last <= 7 * day) active7 += 1;
      if (now - last <= 30 * day) active30 += 1;
      if (now - first <= 7 * day) newLast7 += 1;
    }

    return { devices: rows.length, opens, active7, active30, newLast7 };
  });

export type FeedbackItem = {
  id: string;
  message: string;
  platform: string | null;
  created_at: string;
};

export const getFeedback = createServerFn({ method: "GET" })
  .inputValidator((data: { token?: string } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<FeedbackItem[]> => {
    const { requireUnlocked } = await import("@/lib/usage-gate.server");
    await requireUnlocked(data?.token);
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) return [];

    const admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error } = await admin
      .from("app_feedback")
      .select("id, message, platform, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !rows) return [];
    return rows as FeedbackItem[];
  });
