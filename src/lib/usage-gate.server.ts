import { useSession } from "@tanstack/react-start/server";

export type GateSession = { unlocked?: boolean };

export const sessionConfig = () => ({
  password: process.env["SESSION_SECRET"]!,
  name: "usage-gate",
  maxAge: 60 * 60 * 24 * 30,
  // "none" so the cookie also survives when the app runs inside the Lovable
  // preview iframe (cross-site context); "lax" is dropped there.
  cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
});

export async function requireUnlocked(): Promise<void> {
  const session = await useSession<GateSession>(sessionConfig());
  if (!session.data.unlocked) throw new Error("Locked");
}

export async function isUnlocked(): Promise<boolean> {
  const session = await useSession<GateSession>(sessionConfig());
  return session.data.unlocked === true;
}

export async function setUnlocked(): Promise<void> {
  const session = await useSession<GateSession>(sessionConfig());
  await session.update({ unlocked: true });
}
