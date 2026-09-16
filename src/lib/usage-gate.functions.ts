import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const isUsageUnlocked = createServerFn({ method: "GET" })
  .inputValidator((data: { token?: string } | undefined) => data ?? {})
  .handler(async ({ data }): Promise<boolean> => {
    const { isUnlocked } = await import("@/lib/usage-gate.server");
    return isUnlocked(data?.token);
  });

export const unlockUsage = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["SITE_PASSWORD"];
    if (!expected) return { ok: false as const, token: "" };
    if (!passwordMatches(String(data.password ?? "").trim(), expected.trim())) {
      return { ok: false as const, token: "" };
    }
    const { setUnlocked, makeToken } = await import("@/lib/usage-gate.server");
    await setUnlocked();
    return { ok: true as const, token: makeToken() };
  });
