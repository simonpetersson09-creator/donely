import { useSession } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export type GateSession = { unlocked?: boolean };

export const sessionConfig = () => ({
  password: process.env["SESSION_SECRET"]!,
  name: "usage-gate",
  maxAge: 60 * 60 * 24 * 30,
  // "none" so the cookie also survives when the app runs inside the Lovable
  // preview iframe (cross-site context); "lax" is dropped there.
  cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
});

/**
 * Some browsers (and the preview iframe) block third-party cookies entirely,
 * so the encrypted session alone is not enough to keep the page unlocked.
 * As a fallback the unlock call also returns a signed token that the client
 * stores locally and sends back on every request.
 */
export function makeToken(): string {
  const secret = process.env["SESSION_SECRET"] ?? "";
  return createHmac("sha256", secret).update("usage-unlocked").digest("hex");
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const expected = makeToken();
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function sessionUnlocked(): Promise<boolean> {
  try {
    const session = await useSession<GateSession>(sessionConfig());
    return session.data.unlocked === true;
  } catch {
    return false;
  }
}

export async function requireUnlocked(token?: string): Promise<void> {
  if (verifyToken(token)) return;
  if (await sessionUnlocked()) return;
  throw new Error("Locked");
}

export async function isUnlocked(token?: string): Promise<boolean> {
  if (verifyToken(token)) return true;
  return sessionUnlocked();
}

export async function setUnlocked(): Promise<void> {
  try {
    const session = await useSession<GateSession>(sessionConfig());
    await session.update({ unlocked: true });
  } catch {
    // Cookie could not be set (blocked context) — the signed token still works.
  }
}
