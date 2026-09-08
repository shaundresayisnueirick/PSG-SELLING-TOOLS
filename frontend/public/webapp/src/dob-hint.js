/* PSG Selling Tools — Petunjuk format tanggal lahir (DD/MM/YYYY)
 * Menandai setiap input[type=date] yang masih KOSONG dengan kelas `is-empty`
 * supaya CSS bisa menampilkan placeholder abu-abu, lalu menghapusnya begitu
 * tanggal diisi (dan mengembalikannya bila tanggal dihapus). Murni UI:
 * tidak menyentuh nilai, parsing, rumus usia, penyimpanan, atau backend.
 */
(function () {
  'use strict';
  function mark(inp) {
    if (!inp || inp.tagName !== 'INPUT' || inp.type !== 'date') return;
    if (inp.value) inp.classList.remove('is-empty');
    else inp.classList.add('is-empty');
  }
  function sweep(root) {
    try {
      (root || document).querySelectorAll('input[type="date"]').forEach(mark);
    } catch (e) {}
  }
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('input[type="date"]')) mark(t);
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.matches && t.matches('input[type="date"]')) mark(t);
  }, true);
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (!m.addedNodes) continue;
      for (var j = 0; j < m.addedNodes.length; j++) {
        var n = m.addedNodes[j];
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches('input[type="date"]')) mark(n);
        if (n.querySelectorAll) sweep(n);
      }
    }
  });
  function init() {
    sweep(document);
    try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
