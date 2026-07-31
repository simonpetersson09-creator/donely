/** Public legal page (Privacy Policy & Terms of Use) used across the app. */
export const LEGAL_URL = "https://donely-legal.lovable.app";

/** Open a URL in the system browser. Returns true when a window reference was obtained. */
export function openExternalUrl(url: string): boolean {
  const win = window.open(url, "_blank", "noopener,noreferrer");
  // Some browsers / in-app previews return null from window.open even when the
  // tab actually opened, so fall back to a programmatic anchor click.
  if (win && !win.closed && typeof win.closed !== "undefined") {
    return true;
  }
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.position = "fixed";
  a.style.opacity = "0";
  a.style.pointerEvents = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return true;
}
