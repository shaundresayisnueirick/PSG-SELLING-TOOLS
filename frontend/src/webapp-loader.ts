// Web loader (used by the Expo web preview and by TypeScript). The PWA lives in
// /public/webapp and is served at /webapp by the Metro dev server. Native builds
// use webapp-loader.native.ts instead (Metro resolves the .native.ts variant).
export async function getWebAppSource(): Promise<string> {
  const origin =
    typeof window !== "undefined" && window.location
      ? window.location.origin
      : "";
  return `${origin}/webapp/index.html`;
}
