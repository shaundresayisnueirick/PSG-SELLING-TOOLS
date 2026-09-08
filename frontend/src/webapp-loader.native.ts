// Native loader: unpacks the bundled PWA (an in-JS base64 zip of the ORIGINAL
// PSG Selling Tools web app) into the app's document directory on first launch,
// then serves it over file:// — fully offline, byte-for-byte identical to the
// PWA. No server, no network.
import { Directory, File, Paths } from "expo-file-system";
import { unzipSync } from "fflate";

import { storage } from "@/src/utils/storage";
// The whole web app, zipped and base64-encoded. See scripts that built it.
import bundle from "@/src/webapp/webapp-bundle.json";

// Bump this whenever the bundled web assets change so devices re-extract.
const VERSION = "37.5-apk-1";
const VKEY = "psg.webapp.version.v1";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const lookup = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) lookup[B64.charCodeAt(i)] = i;
  const len = clean.length;
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const outLen = Math.floor((len * 3) / 4) - pad;
  const out = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = lookup[clean.charCodeAt(i)];
    const c1 = lookup[clean.charCodeAt(i + 1)];
    const c2 = lookup[clean.charCodeAt(i + 2)];
    const c3 = lookup[clean.charCodeAt(i + 3)];
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (p < outLen) out[p++] = (n >> 16) & 0xff;
    if (p < outLen) out[p++] = (n >> 8) & 0xff;
    if (p < outLen) out[p++] = n & 0xff;
  }
  return out;
}

let cachedIndex: string | null = null;

export async function getWebAppSource(): Promise<string> {
  const root = new Directory(Paths.document, "webapp");
  const index = new File(root, "index.html");

  const current = await storage.getItem(VKEY, "");
  if (cachedIndex && current === VERSION && index.exists) return cachedIndex;
  if (current === VERSION && index.exists) {
    cachedIndex = index.uri;
    return cachedIndex;
  }

  // Fresh extract.
  if (root.exists) {
    try {
      root.delete();
    } catch {}
  }
  root.create({ intermediates: true });

  const zipBytes = base64ToUint8Array((bundle as { zip: string }).zip);
  const files = unzipSync(zipBytes);
  const paths = Object.keys(files);
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (!p || p.endsWith("/")) continue;
    const data = files[p];
    const f = new File(root, p);
    try {
      f.create({ intermediates: true, overwrite: true });
    } catch {}
    f.write(data);
  }

  await storage.setItem(VKEY, VERSION);
  cachedIndex = new File(root, "index.html").uri;
  return cachedIndex;
}
