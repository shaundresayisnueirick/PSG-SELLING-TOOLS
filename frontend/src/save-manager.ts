// Web stub for the save bridge (Expo web preview only; the native file is
// save-manager.native.ts). Web falls back to the browser's own download, so
// these are mostly no-ops kept signature-compatible with the native module.
type SaveResult = { ok: boolean; canceled?: boolean; name?: string; error?: string };

export function sanitizeFilename(name: string): string {
  return String(name || "").replace(/[\\/:*?"<>|]/g, "_").trim() || "Dokumen";
}
export function ensureExt(name: string, ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase();
  return name.toLowerCase().endsWith("." + e) ? name : name + "." + e;
}
export function mimeToExt(_mime: string): string {
  return "";
}
export function dataUrlToParts(dataUrl: string): { base64: string; mime: string } {
  return { base64: dataUrl, mime: "application/octet-stream" };
}
export async function htmlToPdfBase64(_html: string): Promise<string> {
  return "";
}
export async function shareBase64(_base64: string, _filename: string, _mime: string): Promise<void> {}
export async function saveBase64ToFolder(
  _base64: string,
  _filename: string,
  _mime: string,
): Promise<SaveResult> {
  return { ok: false };
}
