// Native save/export bridge. Turns the PWA's browser I/O (window.print, blob
// downloads) into real Android files, with context-aware, user-editable names.
// Offline only — no network, no server.
import * as FS from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { storage } from "@/src/utils/storage";

const DIR_KEY = "psg.saf.dir.v1";

// Strip filesystem-illegal characters while keeping the name meaningful.
export function sanitizeFilename(name: string): string {
  const cleaned = String(name || "")
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || "Dokumen";
}

// Add an extension without ever doubling it (Proposal.pdf -> Proposal.pdf).
export function ensureExt(name: string, ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase();
  const low = name.toLowerCase();
  if (low.endsWith("." + e)) return name;
  return name.replace(/\.+$/, "") + "." + e;
}

export function mimeToExt(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("json")) return "json";
  if (m.includes("csv")) return "csv";
  if (m.includes("plain")) return "txt";
  if (m.includes("html")) return "html";
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  return "";
}

export function dataUrlToParts(dataUrl: string): { base64: string; mime: string } {
  const m = /^data:([^;,]*)?(;base64)?,(.*)$/s.exec(dataUrl || "");
  if (!m) return { base64: "", mime: "application/octet-stream" };
  const mime = m[1] || "text/plain";
  const isB64 = !!m[2];
  const raw = m[3] || "";
  if (isB64) return { base64: raw, mime };
  // Percent-encoded / plain text data URL -> convert to base64.
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {}
  let b64 = "";
  try {
    // btoa may be missing on some engines; fall back to manual.
    b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(text))) : manualB64(text);
  } catch {
    b64 = manualB64(text);
  }
  return { base64: b64, mime };
}

function manualB64(str: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const utf8 = unescape(encodeURIComponent(str));
  let out = "";
  for (let i = 0; i < utf8.length; i += 3) {
    const c0 = utf8.charCodeAt(i);
    const c1 = utf8.charCodeAt(i + 1);
    const c2 = utf8.charCodeAt(i + 2);
    const e0 = c0 >> 2;
    const e1 = ((c0 & 3) << 4) | (c1 >> 4);
    const e2 = ((c1 & 15) << 2) | (c2 >> 6);
    const e3 = c2 & 63;
    out += chars[e0] + chars[e1] + (i + 1 < utf8.length ? chars[e2] : "=") + (i + 2 < utf8.length ? chars[e3] : "=");
  }
  return out;
}

// Render serialized HTML to a PDF (Android's native HTML print engine honours
// @media print + page-break CSS, so multi-page output is not cut off).
export async function htmlToPdfBase64(html: string): Promise<string> {
  // Anti-blank guard #1: pastikan ada konten yang akan dicetak (bukan HTML kosong).
  const textOnly = String(html || "").replace(/<[^>]*>/g, "").replace(/\s+/g, "");
  if (!html || textOnly.length < 1) {
    throw new Error("Tidak ada konten untuk dicetak");
  }
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  // Anti-blank guard #2: file harus benar-benar dibuat dan > 0 byte.
  const info = await FS.getInfoAsync(uri, { size: true } as any);
  if (!info.exists || !(typeof info.size === "number" && info.size > 0)) {
    throw new Error("PDF kosong (0 byte)");
  }
  const b64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
  // Anti-blank guard #3: base64 tidak kosong / tidak terlalu kecil untuk PDF valid.
  if (!b64 || b64.length < 100) {
    throw new Error("PDF kosong");
  }
  return b64;
}

async function writeTempFile(base64: string, filename: string): Promise<string> {
  const dir = FS.cacheDirectory + "psg-share/";
  try {
    await FS.deleteAsync(dir, { idempotent: true });
  } catch {}
  await FS.makeDirectoryAsync(dir, { intermediates: true });
  const uri = dir + filename;
  await FS.writeAsStringAsync(uri, base64, { encoding: FS.EncodingType.Base64 });
  return uri;
}

// Share sheet (also offers "Save to Files", Drive, WhatsApp, Gmail…). The file
// keeps the exact name the user chose.
export async function shareBase64(base64: string, filename: string, mime: string): Promise<void> {
  const uri = await writeTempFile(base64, filename);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error("Sharing tidak tersedia di perangkat ini.");
  await Sharing.shareAsync(uri, {
    mimeType: mime,
    dialogTitle: filename,
    UTI: mime === "application/pdf" ? "com.adobe.pdf" : undefined,
  });
}

type SaveResult = { ok: boolean; canceled?: boolean; name?: string; error?: string };

async function requestFolder(): Promise<string> {
  const perm = await FS.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return "";
  await storage.setItem(DIR_KEY, perm.directoryUri);
  return perm.directoryUri;
}

// Save into a user-chosen folder via the Android file picker (Storage Access
// Framework). The folder choice is remembered for next time. Android auto-adds
// " (1)" if a same-named file already exists.
export async function saveBase64ToFolder(
  base64: string,
  filename: string,
  mime: string,
): Promise<SaveResult> {
  let dirUri = await storage.getItem(DIR_KEY, "");
  if (!dirUri) {
    dirUri = await requestFolder();
    if (!dirUri) return { ok: false, canceled: true };
  }

  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;

  const writeInto = async (dir: string): Promise<string> => {
    const created = await FS.StorageAccessFramework.createFileAsync(dir, stem, mime);
    await FS.writeAsStringAsync(created, base64, { encoding: FS.EncodingType.Base64 });
    return created;
  };

  try {
    await writeInto(dirUri);
    return { ok: true, name: filename };
  } catch {
    // Permission may have been revoked — ask once more.
    dirUri = await requestFolder();
    if (!dirUri) return { ok: false, canceled: true };
    try {
      await writeInto(dirUri);
      return { ok: true, name: filename };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
}
