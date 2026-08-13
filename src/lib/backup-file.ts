import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { exportData } from "./persistence";

export const backupFileName = () => `donely-${new Date().toISOString().slice(0, 10)}.json`;

/**
 * Saves the backup to disk and (on iOS) opens the native share sheet so the
 * user can store it in Files/iCloud. In the browser it falls back to a normal
 * download, since WKWebView ignores <a download>.
 */
export async function saveBackupFile(): Promise<"shared" | "downloaded"> {
  const json = exportData();
  const fileName = backupFileName();

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: fileName,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const { uri } = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });
    await Share.share({
      title: "Donely backup",
      files: [uri],
    });
    return "shared";
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}

/** Reads a picked file as text, tolerating iOS files without a json mime type. */
export async function readBackupFile(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
