import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PsgWebView } from "@/src/psg-webview";
import type { PsgWebViewHandle } from "@/src/psg-webview-types";
import { INJECTED_BEFORE, INJECTED_MAIN } from "@/src/psg-bridge";
import {
  dataUrlToParts,
  ensureExt,
  htmlToPdfBase64,
  mimeToExt,
  sanitizeFilename,
  saveBase64ToFolder,
  shareBase64,
} from "@/src/save-manager";
import { getWebAppSource } from "@/src/webapp-loader";

// Brand palette. These follow the WEB APP's own theme (light/dark), which lives
// inside the WebView and is not the device colour scheme, so they are literals
// on purpose (they must match the PSG identity regardless of the OS setting).
const PSG = {
  red: "#A60101",
  navy: "#0E2036",
  paper: "#F2EFE9",
  darkBg: "#080B0F",
  darkPanel: "#151A22",
  gold: "#C8A24A",
  white: "#FFFFFF",
};

type WebTheme = "light" | "dark";

type SaveSheet = {
  base64: string;
  mime: string;
  ext: string;
  name: string;
};

export default function Index() {
  const insets = useSafeAreaInsets();
  const webRef = useRef<PsgWebViewHandle>(null);
  const canGoBackRef = useRef(false);
  const lastBackRef = useRef(0);
  const sheetRef = useRef<SaveSheet | null>(null);

  const [source, setSource] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [webTheme, setWebTheme] = useState<WebTheme>("light");
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SaveSheet | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const overlay = useRef(new Animated.Value(1)).current;
  const [overlayGone, setOverlayGone] = useState(false);

  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  // Resolve the offline web app source (file:// on device, /webapp on web).
  useEffect(() => {
    let alive = true;
    getWebAppSource()
      .then((uri) => alive && setSource(uri))
      .catch((e) => alive && setLoadError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const hideOverlay = useCallback(() => {
    Animated.timing(overlay, {
      toValue: 0,
      duration: 320,
      useNativeDriver: true,
    }).start(() => setOverlayGone(true));
  }, [overlay]);

  // Safety net: always reveal the app even if the WebView "ready" ping or
  // onLoadEnd never fires (e.g. the web preview iframe).
  useEffect(() => {
    if (!source) return;
    const t = setTimeout(() => hideOverlay(), 3500);
    return () => clearTimeout(t);
  }, [source, hideOverlay]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const openSaveSheet = useCallback((s: SaveSheet) => {
    setSheet(s);
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  const onMessage = useCallback(
    (data: string) => {
      let msg: any;
      try {
        msg = JSON.parse(data);
      } catch {
        return;
      }
      switch (msg?.type) {
        case "ready":
          hideOverlay();
          break;
        case "theme":
          setWebTheme(msg.theme === "dark" ? "dark" : "light");
          break;
        case "clipboard":
          Clipboard.setStringAsync(String(msg.text ?? "")).then(
            () => showToast("Disalin ke clipboard"),
            () => showToast("Gagal menyalin"),
          );
          break;
        case "openurl":
          if (msg.url) Linking.openURL(String(msg.url)).catch(() => {});
          break;
        case "print":
          setBusy("Membuat PDF…");
          (async () => {
            try {
              const base64 = await htmlToPdfBase64(String(msg.html || ""));
              setBusy(null);
              const name = ensureExt(sanitizeFilename(msg.title || "Dokumen"), "pdf");
              openSaveSheet({ base64, mime: "application/pdf", ext: "pdf", name });
            } catch {
              setBusy(null);
              showToast("Gagal membuat PDF");
            }
          })();
          break;
        case "download": {
          const { base64, mime } = dataUrlToParts(String(msg.dataUrl || ""));
          if (!base64) {
            showToast("Berkas kosong");
            break;
          }
          const raw = sanitizeFilename(msg.filename || "berkas");
          const dot = raw.lastIndexOf(".");
          const ext = dot > 0 ? raw.slice(dot + 1).toLowerCase() : mimeToExt(mime) || "txt";
          openSaveSheet({ base64, mime: mime || "application/octet-stream", ext, name: ensureExt(raw, ext) });
          break;
        }
        case "back": {
          const handled = !!msg.handled;
          if (handled) break;
          if (canGoBackRef.current) {
            webRef.current?.goBack();
          } else {
            const now = Date.now();
            if (now - lastBackRef.current < 2000) {
              BackHandler.exitApp();
            } else {
              lastBackRef.current = now;
              showToast("Tekan sekali lagi untuk keluar");
            }
          }
          break;
        }
        case "error":
          if (__DEV__) console.log("[PSG bridge]", msg.message);
          break;
      }
    },
    [hideOverlay, openSaveSheet, showToast],
  );

  // Hardware Back button (Android).
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBack = () => {
      if (sheetRef.current) {
        closeSheet();
        return true;
      }
      webRef.current?.injectJavaScript("window.__psgBack&&window.__psgBack();true;");
      return true;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [closeSheet]);

  const headerColor = webTheme === "dark" ? PSG.darkBg : PSG.navy;
  const pageColor = webTheme === "dark" ? PSG.darkBg : PSG.paper;

  return (
    <View style={[styles.root, { backgroundColor: pageColor }]} testID="psg-root">
      <StatusBar style="light" backgroundColor={headerColor} />

      {/* Safe-area strip that matches the sticky in-app header. */}
      <View style={{ height: insets.top, backgroundColor: headerColor }} />

      {source && !loadError ? (
        <PsgWebView
          ref={webRef}
          uri={source}
          backgroundColor={pageColor}
          injectedBefore={INJECTED_BEFORE}
          injectedMain={INJECTED_MAIN}
          onMessage={onMessage}
          onNavStateChange={(canGoBack) => {
            canGoBackRef.current = canGoBack;
          }}
          onLoadEnd={() => {
            // Safety net in case the "ready" message is missed.
            setTimeout(hideOverlay, 800);
          }}
          onExternalUrl={(url) => {
            Linking.openURL(url).catch(() => {});
          }}
        />
      ) : null}

      {/* Bottom safe-area strip. */}
      <View style={{ height: insets.bottom, backgroundColor: pageColor }} />

      {loadError ? (
        <View style={styles.center} testID="psg-load-error">
          <Text style={styles.errTitle}>Gagal memuat aplikasi</Text>
          <Text style={styles.errBody}>{loadError}</Text>
        </View>
      ) : null}

      {/* Branded splash overlay — prevents any white flash on startup. */}
      {!overlayGone ? (
        <Animated.View
          style={[styles.overlay, { opacity: overlay, pointerEvents: busy ? "auto" : "none" }]}
          testID="psg-splash"
        >
          <Image
            source={require("../assets/images/psg-splash.png")}
            style={styles.splashLogo}
            contentFit="contain"
          />
          <ActivityIndicator color={PSG.white} style={{ marginTop: 20 }} />
        </Animated.View>
      ) : null}

      {/* Busy indicator while generating a PDF. */}
      {busy ? (
        <View style={styles.busyWrap} testID="psg-busy">
          <View style={styles.busyCard}>
            <ActivityIndicator color={PSG.red} />
            <Text style={styles.busyText}>{busy}</Text>
          </View>
        </View>
      ) : null}

      {/* Save / rename sheet. */}
      <SaveModal
        sheet={sheet}
        webTheme={webTheme}
        insetsBottom={insets.bottom}
        onClose={closeSheet}
        onShare={async (finalName) => {
          if (!sheet) return;
          closeSheet();
          try {
            await shareBase64(sheet.base64, finalName, sheet.mime);
          } catch {
            showToast("Gagal membagikan berkas");
          }
        }}
        onSaveFolder={async (finalName) => {
          if (!sheet) return;
          closeSheet();
          try {
            const res = await saveBase64ToFolder(sheet.base64, finalName, sheet.mime);
            if (res.ok) showToast("Tersimpan: " + (res.name || finalName));
            else if (!res.canceled) showToast("Gagal menyimpan berkas");
          } catch {
            showToast("Gagal menyimpan berkas");
          }
        }}
      />

      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none" testID="psg-toast">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SaveModal({
  sheet,
  webTheme,
  insetsBottom,
  onClose,
  onShare,
  onSaveFolder,
}: {
  sheet: SaveSheet | null;
  webTheme: WebTheme;
  insetsBottom: number;
  onClose: () => void;
  onShare: (name: string) => void;
  onSaveFolder: (name: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (sheet) setName(sheet.name);
  }, [sheet]);

  const dark = webTheme === "dark";
  const cardBg = dark ? PSG.darkPanel : PSG.white;
  const textColor = dark ? PSG.paper : PSG.navy;
  const inputBg = dark ? "#0E1319" : "#FBFAF7";
  const inputBorder = dark ? "#2A2F3A" : "#DDD6CC";
  const muted = dark ? "#9AA3B2" : "#6E6A64";

  const finalName = sheet ? ensureExt(sanitizeFilename(name), sheet.ext) : "";

  return (
    <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} testID="save-backdrop">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalKav}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: cardBg, paddingBottom: 16 + insetsBottom }]}
            onPress={() => {}}
          >
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textColor }]}>Simpan berkas</Text>
            <Text style={[styles.modalSub, { color: muted }]}>
              Ubah nama bila perlu, lalu pilih cara menyimpan.
            </Text>

            <TextInput
              testID="save-filename-input"
              value={name}
              onChangeText={setName}
              placeholder="Nama berkas"
              placeholderTextColor={muted}
              autoCapitalize="none"
              autoCorrect={false}
              selectTextOnFocus
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
            />
            <Text style={[styles.finalName, { color: muted }]} testID="save-final-name">
              Akan disimpan sebagai: {finalName}
            </Text>

            <Pressable
              testID="save-share-button"
              style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}
              onPress={() => onShare(finalName)}
            >
              <Text style={styles.btnPrimaryText}>Bagikan / Kirim</Text>
            </Pressable>
            <Pressable
              testID="save-folder-button"
              style={({ pressed }) => [
                styles.btnSecondary,
                { borderColor: dark ? PSG.gold : PSG.navy },
                pressed && styles.pressed,
              ]}
              onPress={() => onSaveFolder(finalName)}
            >
              <Text style={[styles.btnSecondaryText, { color: dark ? PSG.gold : PSG.navy }]}>
                Simpan ke Folder (pilih lokasi)
              </Text>
            </Pressable>
            <Pressable testID="save-cancel-button" style={styles.btnGhost} onPress={onClose}>
              <Text style={[styles.btnGhostText, { color: muted }]}>Batal</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errTitle: { color: PSG.red, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  errBody: { color: "#555", fontSize: 13, textAlign: "center" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: PSG.red,
    alignItems: "center",
    justifyContent: "center",
  },
  splashLogo: { width: 200, height: 200 },
  busyWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  busyCard: {
    backgroundColor: PSG.white,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  busyText: { marginTop: 12, color: PSG.navy, fontWeight: "600" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalKav: { width: "100%" },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  modalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#9993",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalSub: { fontSize: 13, marginTop: 4, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  finalName: { fontSize: 12, marginTop: 8, marginBottom: 18 },
  btnPrimary: {
    backgroundColor: PSG.red,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  btnPrimaryText: { color: PSG.white, fontWeight: "800", fontSize: 15 },
  btnSecondary: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  btnSecondaryText: { fontWeight: "700", fontSize: 15 },
  btnGhost: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  btnGhostText: { fontWeight: "600", fontSize: 14 },
  pressed: { opacity: 0.85 },
  toastWrap: { position: "absolute", left: 0, right: 0, bottom: 60, alignItems: "center" },
  toast: {
    backgroundColor: "rgba(20,20,20,0.92)",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 22,
    maxWidth: "86%",
  },
  toastText: { color: "#fff", fontSize: 13.5, textAlign: "center" },
});
