import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Anonymous "app opened" ping.
 *
 * Stores nothing but a random device id generated on the device, a first/last
 * seen timestamp and an open counter. No personal data, no activity content.
 */
export const Route = createFileRoute("/api/public/ping")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { deviceId?: unknown; platform?: unknown; appVersion?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response(JSON.stringify({ error: "invalid body" }), { status: 400 });
        }

        const deviceId = typeof body.deviceId === "string" ? body.deviceId.slice(0, 64) : "";
        if (!/^[a-zA-Z0-9-]{8,64}$/.test(deviceId)) {
          return new Response(JSON.stringify({ error: "invalid deviceId" }), { status: 400 });
        }
        const platform =
          typeof body.platform === "string" ? body.platform.slice(0, 32) : null;
        const appVersion =
          typeof body.appVersion === "string" ? body.appVersion.slice(0, 32) : null;

        const url = process.env["SUPABASE_URL"];
        const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: "not configured" }), { status: 500 });
        }

        const admin = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error } = await admin.rpc("record_app_open", {
          _device_id: deviceId,
          _platform: platform,
          _app_version: appVersion,
        });

        if (error) {
          console.error("ping failed", error.message);
          return new Response(JSON.stringify({ ok: false }), { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
