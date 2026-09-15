import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

const sessionConfig = {
  password: process.env["SESSION_SECRET"]!,
  name: "usage-gate",
  maxAge: 60 * 60 * 24 * 30,
  cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
};

type GateSession = { unlocked?: boolean };

function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function requireUnlocked(): Promise<void> {
  const session = await useSession<GateSession>(sessionConfig);
  if (!session.data.unlocked) throw new Error("Locked");
}

export const isUsageUnlocked = createServerFn({ method: "GET" }).handler(
  async (): Promise<boolean> => {
    const session = await useSession<GateSession>(sessionConfig);
    return session.data.unlocked === true;
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
    const session = await useSession<GateSession>(sessionConfig);
    await session.update({ unlocked: true });
    return { ok: true as const };
  });
