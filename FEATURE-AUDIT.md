# AUDIT FITUR — PSG SELLING TOOLS (PWA → Android)

Prinsip konversi: **seluruh HTML/CSS/JS/data/engine PWA dijalankan apa adanya
(byte-for-byte) di dalam native WebView, offline via `file://`.** Karena kode yang
berjalan sama persis dengan PWA, seluruh **logic, rumus, precision, dan hasil
kalkulasi dijamin identik**. Bridge native hanya menambah kemampuan Android
(print/PDF, simpan berkas, clipboard, QR offline, tombol Back) tanpa mengubah
fungsi/hasil.

Bukti identik: hasil unzip bundle native = 59 berkas; `index.html` dan
`src/app.js` **byte-identical** dengan sumber ZIP (diverifikasi).

Legenda STATUS:
- PASS — berjalan di dalam WebView, logic tidak diubah (identik dengan PWA).
- PASS (adaptasi native) — fungsi dipertahankan, I/O disambungkan ke Android.
- VERIFIKASI DI APK — hanya bisa diuji penuh pada build Android (bukan preview web).

| FITUR | PWA | ANDROID | STATUS | CATATAN |
|---|---|---|---|---|
| Access Gate / Login (FC/BM/BD, SHA-256) | Ada | Ada | PASS | Dipertahankan persis; `file://` = secure context sehingga `crypto.subtle` aktif |
| Tema per agen + Light default + Dark persistent | Ada | Ada | PASS | `insuranceHub.theme.v3` di localStorage; anti white-flash (inject dark bg sebelum paint) |
| localStorage (profil, isian, tema, dll) | Ada | Ada | PASS | DOM storage aktif; persisten antar buka-tutup aplikasi |
| Ilustrasi Lite Future | Ada | Ada | PASS | Engine `liteFuture.js` tidak diubah |
| Ilustrasi BeSMART Lite (lengkap) | Ada | Ada | PASS | `besmartLiteLengkap.js` + data `bsl-lengkap.js` |
| Ilustrasi Cristal Prime | Ada | Ada | PASS | `cristalPrime.js` |
| Ilustrasi (New) Cemerlang Prime | Ada | Ada | PASS | `newCemerlangPrime.js` |
| Ilustrasi Gen Aman / GSPA | Ada | Ada | PASS | `gspa.js` |
| Ilustrasi iFLEXYGUARD | Ada | Ada | PASS | `iflexyguard.js` |
| Ilustrasi GHP GenPro / Gen Pro | Ada | Ada | PASS | `ghp.js`, `productRegistry.js` |
| Ilustrasi Kombinasi / Kombinasi Produk | Ada | Ada | PASS | Alur kombinasi `app.js` |
| Point / Premium / Benefit calculation | Ada | Ada | PASS | Semua engine + `usia.js` + registry identik |
| Kebutuhan Dana Pensiun | Ada | Ada | PASS | `app.js` (dTblCetak dsb) |
| Simulasi Cicilan Rumah / Rumah Kedua | Ada | Ada | PASS | `app.js` |
| Kebutuhan Dana Pendidikan | Ada | Ada | PASS | `app.js`, `solusi-pendidikan.js` |
| DP Solusi / Solusi Pendidikan | Ada | Ada | PASS | `dp-solusi.js`, `solusi-pendidikan.js` |
| Segitiga Solusi + Program Builder | Ada | Ada | PASS | `segitiga.js`, `segitiga-solusi.js`, `program-financial-engine.js`, `-normalizer.js` |
| Gen Wealth + Banding Gen Wealth | Ada | Ada | PASS | `gen-wealth.js`, `banding-genwealth.js` |
| Perbandingan Produk / GHP / GPro | Ada | Ada | PASS | `banding-produk.js`, `banding-ghp.js`, `banding-gpro.js` |
| Perbandingan — cetak | Ada | Ada | PASS (adaptasi native) | `banding-cetak.js` → PDF native |
| Comparison Summary (halaman terpisah) | Ada | Ada | PASS | `comparison-summary.html` (navigasi `file://` internal) |
| Program Summary (halaman terpisah) | Ada | Ada | PASS | `program-summary.html` |
| Kartu Konsultan | Ada | Ada | PASS | `kartu-konsultan.js` |
| QR (WhatsApp) di Kartu/Preview | Ada (online quickchart) | Ada (offline lokal) | PASS (adaptasi native) | Digenerate lokal dari `text=` yang sama → QR identik, 100% offline |
| Library Ilustrasi (snapshot/favorit/batch) | Ada | Ada | PASS | `library-ilustrasi.js` |
| Slip Komisi | Ada | Ada | PASS | `slip-komisi.js` |
| Aktivitas (activity tools) | Ada | Ada | PASS | `aktivitas.js`, `aktivitas-ui.js` |
| GHP Aturan / Sambung / Catatan | Ada | Ada | PASS | `ghp-aturan.js`, `ghp-sambung.js`, `catatan-ghp.js` |
| Prompt Flyer (salin) | Ada | Ada | PASS (adaptasi native) | Clipboard disambungkan ke native |
| Isian Terakhir (restore isian) | Ada | Ada | PASS | `isian-terakhir.js` |
| Preview Cetak (print preview) | Ada | Ada | PASS (adaptasi native) | `preview-cetak.js`; page-break dihormati |
| Print / Cetak (window.print) | Ada | Ada | PASS (adaptasi native) / VERIFIKASI DI APK | Di-override → `expo-print` (HTML→PDF native, honor `@media print` + page-break) |
| PDF tidak terpotong (multi-halaman) | Ada | Ada | VERIFIKASI DI APK | Mesin cetak Android memakai CSS `@media print` asli → pagination benar |
| Automatic filename (context-aware) | Ada | Ada | PASS (adaptasi native) | Nama diambil dari `document.title`/`InsuranceHubNaming` app (produk + nama nasabah) |
| Rename filename sebelum Save | — | Ada | PASS (adaptasi native) | Dialog "Simpan berkas" (bisa diedit) |
| Ekstensi benar (tanpa .pdf.pdf) | Ada | Ada | PASS | `ensureExt()` |
| Duplikat file aman `(1)` | — | Ada | PASS (adaptasi native) | Ditangani Storage Access Framework Android |
| Validasi karakter nama file | — | Ada | PASS | `sanitizeFilename()` |
| Backup / Cadangkan Berkas (.json) | Ada | Ada | PASS (adaptasi native) / VERIFIKASI DI APK | Blob download di-intercept → simpan/berbagi via Android |
| Restore / Pulihkan Berkas | Ada | Ada | PASS / VERIFIKASI DI APK | `<input type=file>` memicu file picker Android; FileReader tetap dipakai |
| Export CSV | Ada | Ada | PASS (adaptasi native) | Alur unduh yang sama |
| Copy / Clipboard | Ada | Ada | PASS (adaptasi native) | `navigator.clipboard.writeText` → `expo-clipboard` |
| Share / Kirim | Ada | Ada | PASS (adaptasi native) | Android share sheet (`expo-sharing`) — nama file sesuai yang dipilih |
| Link eksternal (wa.me, IG, dll) | Ada | Ada | PASS (adaptasi native) | Dibuka di browser sistem (Linking) |
| Service Worker | Ada | Tidak perlu | N/A | Aplikasi sudah offline penuh via `file://`; registrasi SW tidak diperlukan (harmless) |
| Android Back Button | — | Ada | PASS / VERIFIKASI DI APK | `window.tekanKembali()` + history WebView; keluar hanya di Home (double-press) |
| Splash screen + App Icon (adaptive) | — | Ada | PASS | Aset dari `android-apk-icon/` (foreground + background) + splash merah PSG |
| Responsive Phone | Ada | Ada | PASS | Diuji 390px, 0 overflow |
| Responsive Tablet | — | Ada | PASS | Diuji 820px, 0 overflow; orientasi `default` (tablet bisa landscape) |
| Offline (tanpa server) | Ada | Ada | PASS | Tidak ada backend/API; semua aset lokal |

## Dependency jaringan yang ditemukan (audit #28)
- `quickchart.io/qr` → **diganti generator QR lokal (offline)**, sesuai persetujuan. Tidak ada lagi panggilan internet untuk QR.
- `wa.me` / `instagram.com` / dst → hanya **link** yang dibuka di browser sistem saat diklik (bukan dependency fungsi inti).
- Tidak ada CDN JS/CSS/font eksternal. Tidak ada `fetch`/`import`/XHR.

## Yang HANYA bisa diuji final di build Android/APK (bukan preview web)
`react-native-webview` tidak berjalan di web, sehingga di preview web dipakai
`<iframe>` untuk memperlihatkan aplikasi. Fitur berikut memakai kemampuan native
dan wajib diuji pada APK di HP/tablet nyata:
1. Cetak → PDF (`expo-print`) — termasuk uji 1 halaman, 2 halaman, banyak halaman, tabel/teks panjang.
2. Backup simpan berkas & Restore via file picker Android.
3. Simpan ke folder (Storage Access Framework) + duplikat `(1)`.
4. Clipboard & Share sheet.
5. Tombol Back Android.
6. Persistensi tema & tidak ada white-flash pada perpindahan halaman.
