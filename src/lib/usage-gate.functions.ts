import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const isUsageUnlocked = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    const { isUnlocked } = await import("@/lib/usage-gate.server");
    return isUnlocked();
  },
);

export const unlockUsage = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["SITE_PASSWORD"];
    if (!expected) return { ok: false as const };
    if (!passwordMatches(String(data.password ?? ""), expected)) {
      return { ok: false as const };
    }
    const { setUnlocked } = await import("@/lib/usage-gate.server");
    await setUnlocked();
    return { ok: true as const };
  });
