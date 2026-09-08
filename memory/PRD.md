# PRD — PSG Selling Tools (Konversi PWA → Android)

## Problem Statement (asli)
Ubah PWA offline "PSG Selling Tools" (alat bantu penjualan agen asuransi PSG
Agency) menjadi aplikasi Android yang bisa di-install (APK), TANPA membuat ulang,
tanpa mengubah logic/rumus/data/fitur, tetap 100% offline/local-first, tanpa
backend. Pertahankan seluruh tools, kalkulasi, backup/restore, print/PDF,
clipboard/share, tema, dan tambahkan penamaan file context-aware yang bisa
di-rename sebelum save.

## Keputusan Arsitektur
PWA existing (HTML/CSS/JS) dibungkus di dalam **native WebView** (Expo SDK 57 +
`react-native-webview`), dimuat dari `file://` (aset di-extract dari bundle zip
base64 ke document directory saat pertama dijalankan). **Thin native bridge**
(`src/psg-bridge.ts`) menyambungkan fungsi browser ke Android:
- `window.print()` / `window.Android.cetak()` → `expo-print` (HTML→PDF).
- Blob `<a download>` → simpan/berbagi (`expo-file-system` SAF + `expo-sharing`).
- `navigator.clipboard` → `expo-clipboard`.
- QR `quickchart.io` → generator lokal (`qrcode-generator`), offline.
- Tombol Back → `window.tekanKembali()` + history WebView.
- Anti white-flash (inject dark bg sebelum paint) + splash merah PSG.

Karena JS yang berjalan identik dengan PWA, **hasil kalkulasi dijamin sama**.

## Persona
- Agen/Tenaga Pemasar PSG (FC/BM/BD) yang membuat ilustrasi & proposal untuk calon nasabah, sering offline di lapangan, memakai HP/tablet Android.

## Core Requirements (statis)
1. Semua tools & halaman existing tersedia. 2. Logic/rumus/precision identik.
3. Offline penuh, tanpa backend. 4. Backup/Restore, Print/PDF (tidak terpotong).
5. Filename otomatis context-aware + bisa di-rename + ekstensi benar + dedup aman.
6. Light default, Dark persistent, tanpa white-flash. 7. Responsive phone & tablet.
8. Back button natural. 9. Clipboard/Share/Export berfungsi. 10. QR offline.
11. Access gate dipertahankan. 12. APK + source code + backup GitHub.

## Sudah Diimplementasikan (2026-06-08)
- WebView wrapper offline (`app/index.tsx`, `src/psg-webview*.tsx`, `src/webapp-loader*.ts`).
- Bundle PWA byte-identical (`src/webapp/webapp-bundle.json`) + loader unzip (diverifikasi 59 file, index.html/app.js identik).
- Native bridge lengkap (`src/psg-bridge.ts`) + save manager (`src/save-manager.native.ts`): print→PDF, save/share, SAF, clipboard, QR offline, back button, filename context-aware + rename + ensureExt + sanitize.
- Anti white-flash + splash + adaptive icon (aset `android-apk-icon/`), `app.json` dikonfigurasi (nama "PSG Selling Tools", ikon, splash merah #A60101, orientasi default).
- Preview web via iframe agar bisa dilihat/diuji (react-native-webview tidak jalan di web).
- Testing agent: 6/6 kriteria load/render/offline/responsive PASS.
- Dokumen `FEATURE-AUDIT.md` (peta fitur PWA↔Android).

## Backlog / Belum Selesai
- P0: Uji di build APK nyata — Print/PDF (1/2/banyak halaman, tabel & teks panjang), Backup/Restore file picker, SAF save + dedup, Clipboard/Share, Back button, persistensi tema (butuh perangkat Android).
- P0: Kode akses login dari pemilik untuk pengujian alur pasca-login end-to-end.
- P1: GitHub sync (via tombol "Save to GitHub") — setup oleh user.
- P2: (opsional) kunci orientasi portrait khusus HP jika diinginkan.

## Next Tasks
1. User klik Publish → generate APK → install → uji sesuai FEATURE-AUDIT bagian "VERIFIKASI DI APK".
2. User beri 1 kode akses valid agar alur pasca-login bisa diuji lebih dalam bila perlu.
3. Setup GitHub backup.
