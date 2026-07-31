/** Public legal page (Privacy Policy & Terms of Use) used across the app. */
export const LEGAL_URL = "https://lovable.dev/projects/4b08587e-6fa2-4045-9c42-5d8a03aed2bf";

/** Open a URL in the system browser. Returns true when a window reference was obtained. */
export function openExternalUrl(url: string): boolean {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  return !!(win && !win.closed && typeof win.closed !== "undefined");
}
