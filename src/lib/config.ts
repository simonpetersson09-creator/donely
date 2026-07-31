/** Public legal page (Privacy Policy & Terms of Use) used across the app. */
export const LEGAL_URL = "https://donely-legal.lovable.app";

/** Open a URL in the system browser. Returns true when a window reference was obtained. */
export function openExternalUrl(url: string): boolean {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  return !!(win && !win.closed && typeof win.closed !== "undefined");
}
