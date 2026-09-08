/* ============================================================
   BeSMART Lite 3/5-100 — mesin versi lengkap
   ------------------------------------------------------------
   Mesin lama (BSL) hanya punya masa bayar 3 dan 5 tahun, dan
   memperlakukan uang pertanggungan sebagai satu angka gabungan.

   Mesin ini memakai tabel lengkap (masa bayar 3, 5, 10, 15, 20)
   dan memisahkan dua komponen yang selama ini menyatu:

     UP dasar        : uang pertanggungan produk dasarnya
     Rider Lite UP   : tambahan 400% dari UP dasar, bisa dimatikan

   Total uang pertanggungan = UP dasar x 5 bila Lite UP menyala,
   atau UP dasar saja bila dimatikan. Contoh UP dasar 200 juta
   dengan Lite UP menyala menghasilkan total 1 miliar.

   Preminya juga dipisah, karena tabelnya memang memuat keduanya
   secara terpisah per Rp100 juta UP dasar. Diperiksa: premi UP
   dasar 100 juta ditambah premi Lite UP 400% selalu sama persis
   dengan kolom "UP 500 JT" pada tabel aslinya.

   Mesin lama sengaja tidak diubah supaya tes regresi lawan tools
   Excel asli tetap berlaku.
   ============================================================ */

const BSL2_ACUAN = 100000000;      // tabel disusun per Rp100 juta UP dasar
const BSL2_UP_MIN = 50000000;      // minimum UP dasar produk
const BSL2_USIA_AKHIR = 100;
const BSL2_KELIPATAN_LITE_UP = 4;  // rider Lite UP = 400% dari UP dasar

function bsl2Tabel(rates, mpp, jk) {
  const d = rates || (typeof TARIF_BSL_LENGKAP !== 'undefined' ? TARIF_BSL_LENGKAP : null);
  if (!d || !d.mpp) return null;
  const perMpp = d.mpp[String(mpp)];
  if (!perMpp) return null;
  return perMpp[String(jk).toUpperCase() === 'WANITA' ? 'WANITA' : 'PRIA'] || null;
}

function bsl2MasaTersedia(rates) {
  const d = rates || (typeof TARIF_BSL_LENGKAP !== 'undefined' ? TARIF_BSL_LENGKAP : null);
  return (d && d.mpp) ? Object.keys(d.mpp).map(Number).sort(function (a, b) { return a - b; }) : [];
}

/* Batas usia berbeda menurut masa bayar dan jenis kelamin, mengikuti isi
   tabel apa adanya. Kombinasi yang tidak ada tarifnya memang tidak dijual. */
function bsl2BatasUsia(rates, mpp, jk) {
  const t = bsl2Tabel(rates, mpp, jk);
  if (!t) return null;
  const usia = Object.keys(t).map(Number).sort(function (a, b) { return a - b; });
  return usia.length ? { min: usia[0], maks: usia[usia.length - 1] } : null;
}

function bsl2Hitung(inp, rates, hariIni) {
  const usia = inp.usia != null ? inp.usia : usiaDari(inp.tglLahir, hariIni);
  const out = {
    usia: usia, tersedia: false, alasan: null,
    upDasar: null, upLiteUp: null, upTotal: null,
    premiDasarBulanan: null, premiLiteUpBulanan: null, premiBulanan: null,
    premiDasarTahunan: null, premiLiteUpTahunan: null, premiTahunan: null,
    totalBulanan: null, totalTahunan: null,
    manfaatMeninggal: null, manfaatHidup: null,
    pakaiLiteUp: !!inp.pakaiLiteUp, timeline: [], catatanUP: null
  };

  const upDasar = Number(inp.upDasar) || 0;
  if (upDasar < BSL2_UP_MIN) {
    out.alasan = 'Uang pertanggungan dasar paling kecil Rp' +
      BSL2_UP_MIN.toLocaleString('id-ID') + '.';
    return out;
  }

  const tabel = bsl2Tabel(rates, inp.mpp, inp.jk);
  if (!tabel) {
    out.alasan = 'Masa bayar ' + inp.mpp + ' tahun tidak tersedia di tabel tarif.';
    return out;
  }
  const baris = tabel[String(usia)];
  if (!baris) {
    const b = bsl2BatasUsia(rates, inp.mpp, inp.jk);
    out.alasan = 'Usia ' + usia + ' tahun tidak tersedia untuk masa bayar ' + inp.mpp +
      ' tahun' + (b ? ' (tersedia usia ' + b.min + ' sampai ' + b.maks + ')' : '') + '.';
    return out;
  }

  const skala = upDasar / BSL2_ACUAN;
  const premiDasar = baris[0] * skala;
  const premiLiteUp = out.pakaiLiteUp ? baris[1] * skala : 0;

  out.tersedia = true;
  out.upDasar = upDasar;
  out.upLiteUp = out.pakaiLiteUp ? upDasar * BSL2_KELIPATAN_LITE_UP : 0;
  out.upTotal = out.upDasar + out.upLiteUp;

  out.premiDasarBulanan = premiDasar;
  out.premiLiteUpBulanan = premiLiteUp;
  out.premiBulanan = premiDasar + premiLiteUp;

  // Premi tahunan pada BeSMART Lite adalah 11 kali premi bulanan.
  out.premiDasarTahunan = premiDasar * 11;
  out.premiLiteUpTahunan = premiLiteUp * 11;
  out.premiTahunan = out.premiBulanan * 11;

  out.totalBulanan = out.premiBulanan * 12 * inp.mpp;
  out.totalTahunan = out.premiTahunan * inp.mpp;

  out.manfaatMeninggal = out.upTotal;
  out.manfaatHidup = out.upTotal;
  out.kodePlan = 'BSL ' + inp.mpp + '-100 ' + String(inp.jk).toUpperCase() +
    (out.pakaiLiteUp ? ' + Lite UP' : '');
  out.tarif = baris[0];          // tarif UP dasar per Rp100 juta
  out.tarifLiteUp = baris[1];    // tarif rider Lite UP per Rp100 juta UP dasar

  const bulanan = inp.metode !== 'Tahunan';
  out.premiSesuaiMetode = bulanan ? out.premiBulanan : out.premiTahunan;
  out.premiPerTahun = bulanan ? out.premiBulanan * 12 : out.premiTahunan;
  out.totalSesuaiMetode = bulanan ? out.totalBulanan : out.totalTahunan;

  if (out.upTotal > 2000000000) {
    out.catatanUP = 'Total uang pertanggungan di atas Rp2 miliar: cek ilustrasi resmi ' +
      'atau iPropose untuk premi final.';
  }

  let akumulasi = 0;
  for (let th = 1; th <= BSL2_USIA_AKHIR - usia + 1; th++) {
    const usiaTh = usia + th - 1;
    const bayar = th <= inp.mpp;
    const kontribusi = bayar ? out.premiPerTahun : 0;
    akumulasi += kontribusi;
    out.timeline.push({
      tahun: th, usia: usiaTh,
      status: bayar ? 'Bayar' : 'Lunas',
      kontribusi: kontribusi, akumulasi: akumulasi,
      manfaatMeninggal: usiaTh <= BSL2_USIA_AKHIR ? out.upTotal : null,
      manfaatHidup: usiaTh === BSL2_USIA_AKHIR ? out.upTotal : null,
      keterangan: th === inp.mpp + 1 ? 'Masa bayar selesai \u2014 proteksi tetap berjalan'
        : (usiaTh === BSL2_USIA_AKHIR ? 'Manfaat hidup 100% UP dibayarkan' : '')
    });
  }
  return out;
}

if (typeof InsuranceHubEngines !== 'undefined') {
  InsuranceHubEngines.BSL2 = {
    id: 'BSL2',
    version: '1.0.0',
    calculate: bsl2Hitung,
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.InsuranceHubBSL2 = {
    hitung: bsl2Hitung, tabel: bsl2Tabel,
    masaTersedia: bsl2MasaTersedia, batasUsia: bsl2BatasUsia,
    UP_MIN: BSL2_UP_MIN, ACUAN: BSL2_ACUAN, KELIPATAN: BSL2_KELIPATAN_LITE_UP
  };
}
