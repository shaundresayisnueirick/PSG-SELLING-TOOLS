/* PSG Selling Tools — Universal Print Preview
 * Preview mengikuti tema layar aktif. Cetak/PDF tetap netral melalui CSS print.
 * v28.1: identitas konsultan otomatis ditempel pada dokumen client-facing.
 */
(function(){
  'use strict';
  const SELECTOR='button.aksi,button.sakelar,button.secondary,button.sekunder';
  const isPrintButton=b=>{const t=(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();return /(cetak|print|simpan\s+(sebagai|ke)\s+pdf|pdf)/i.test(t)};
  const getActive=()=>document.querySelector('[data-psg-preview-source].aktif')||document.querySelector('.layar.aktif')||document.querySelector('main');
  const excluded=id=>['layarLibraryIlustrasi','layarKartuKonsultan','layarProduk','layarProfile','layarAktivitas','layarSlipKomisi'].includes(id);
  /* Bila sebuah ilustrasi lama sedang dibuka dari Library, identitasnya
     diambil dari potret yang tersimpan bersama ilustrasi itu. */
  const consultant=()=>{try{
    if(window.__psgKonsultanCetak) return window.__psgKonsultanCetak;
    return window.InsuranceHubConsultantCard?.read?.()||JSON.parse(localStorage.getItem('insuranceHub.konsultan.v1')||'{}')}catch(_){return {}}};
  const photo=()=>{try{ const c=consultant();
    if(c&&typeof c.foto==='string') return c.foto;
    if(c&&c.atasNama) return c.fotoAgen||'';
    return localStorage.getItem('insuranceHub.agen.foto.v1')||''}catch(_){return ''}};
  const waDigits=v=>String(v||'').replace(/\D/g,'').replace(/^0/,'62');
  const waLink=v=>{const d=waDigits(v);return d?'https://wa.me/'+d:''};
  const qrSrc=v=>{const u=waLink(v);return u?'https://quickchart.io/qr?size=180&margin=2&text='+encodeURIComponent(u):''};
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  /* Yang tercetak adalah nama akunnya, bukan URL panjang: dokumen nasabah
     lebih enak dibaca dengan "@wulan" daripada "https://instagram.com/wulan". */
  function rapihkanTautan(v){
    let t=String(v==null?'':v).trim();
    t=t.replace(/^https?:\/\//i,'').replace(/^www\./i,'');
    t=t.replace(/^(instagram|tiktok|facebook|linkedin|youtube)\.com\//i,'');
    t=t.replace(/\/+$/,'');
    return t||String(v||'');
  }
  function consultantNode(){
    const c=consultant();
    if(!c.nama&&!c.whatsapp&&!c.email)return null;
    const wrap=document.createElement('div'); wrap.className='psg-consultant-print';
    const f=photo(); if(f){const img=document.createElement('img');img.className='psg-consultant-photo';img.src=f;img.alt='Foto konsultan';wrap.appendChild(img)}
    const meta=document.createElement('div');meta.className='psg-consultant-meta';
    const n=document.createElement('div');n.className='psg-consultant-name';n.textContent=c.nama||'Konsultan';meta.appendChild(n);
    const r=document.createElement('div');r.className='psg-consultant-role';r.textContent=c.jabatan||'Financial Consultant';meta.appendChild(r);
    const contact=[c.whatsapp&&('WhatsApp: '+c.whatsapp),c.email&&('Email: '+c.email)].filter(Boolean).join('  ·  ');
    if(contact){const ct=document.createElement('div');ct.className='psg-consultant-contact';ct.textContent=contact;meta.appendChild(ct)}
    /* Media sosial ikut tercetak. Sebelumnya blok ini hanya memuat nama,
       jabatan, WhatsApp, email, dan QR — kolom Instagram sampai YouTube
       tersimpan tetapi tidak pernah muncul di dokumen mana pun. */
    const sosial=[['Instagram','instagram'],['TikTok','tiktok'],['Facebook','facebook'],
      ['LinkedIn','linkedin'],['YouTube','youtube']]
      .filter(function(x){return c[x[1]]})
      .map(function(x){return x[0]+': '+rapihkanTautan(c[x[1]])});
    if(sosial.length){
      const so=document.createElement('div');
      so.className='psg-consultant-social';
      so.textContent=sosial.join('  ·  ');
      meta.appendChild(so);
    }
    wrap.appendChild(meta);
    if(c.qr==='YA'&&c.whatsapp){const src=qrSrc(c.whatsapp);if(src){const q=document.createElement('img');q.className='psg-consultant-qr';q.src=src;q.alt='QR WhatsApp';wrap.appendChild(q)}}
    return wrap;
  }
  /* ---------- Rapat halaman saat mencetak ----------
     Blok yang lebih tinggi dari ambang di bawah diizinkan terbelah antarhalaman,
     supaya tidak melompat utuh ke halaman berikutnya dan meninggalkan ruang
     kosong besar sesudah header. Blok pendek tidak disentuh, jadi kartu-kartu
     kecil tetap utuh persis seperti sekarang.

     Ambangnya sengaja tinggi: hanya blok yang memang tidak muat pada sisa
     halaman yang terpengaruh. Kelasnya dilepas lagi begitu pencetakan selesai,
     jadi tampilan layar tidak pernah berubah. */
  var AMBANG_BLOK_PANJANG = 620;   // piksel CSS

  function tandaiBlokPanjang(){
    try{
      var simpul=document.querySelectorAll('.blok');
      for(var i=0;i<simpul.length;i++){
        var n=simpul[i];
        if(n.offsetParent===null) continue;                 // tidak terlihat
        if(n.getBoundingClientRect().height>AMBANG_BLOK_PANJANG)
          n.classList.add('psg-blok-panjang');
      }
    }catch(_){}
  }

  function lepasBlokPanjang(){
    try{
      var simpul=document.querySelectorAll('.psg-blok-panjang');
      for(var i=0;i<simpul.length;i++) simpul[i].classList.remove('psg-blok-panjang');
    }catch(_){}
  }

  if(typeof window.addEventListener==='function'){
    window.addEventListener('beforeprint',tandaiBlokPanjang);
    window.addEventListener('afterprint',lepasBlokPanjang);
    /* Safari iOS tidak selalu mengirim beforeprint, jadi matchMedia dipakai
       sebagai jalur kedua. */
    try{
      if(typeof window.matchMedia==='function'){
        var mq=window.matchMedia('print');
        var pantau=function(e){ if(e.matches) tandaiBlokPanjang(); else lepasBlokPanjang(); };
        if(typeof mq.addEventListener==='function') mq.addEventListener('change',pantau);
        else if(typeof mq.addListener==='function') mq.addListener(pantau);
      }
    }catch(_){}
  }

  function attachIdentity(root,mode){
    if(!root||excluded(root.id)||root.querySelector('.psg-consultant-print'))return null;
    const node=consultantNode(); if(!node)return null;
    if(mode==='preview') node.classList.add('psg-consultant-preview');
    root.appendChild(node); return node;
  }
  function cleanClone(clone){
    clone.querySelectorAll('.tanpa-cetak,[data-preview-hide],button').forEach(n=>n.remove());
    clone.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
    clone.querySelectorAll('[name]').forEach(n=>n.removeAttribute('name'));
    return clone;
  }
  function close(modal){if(modal)modal.remove();document.documentElement.classList.remove('psg-preview-open');document.body.classList.remove('psg-preview-open')}
  function showPreview(){
    const active=getActive(); if(!active){alert('Tidak ada hasil yang bisa dipreview.');return}
    let modal=document.getElementById('psgPrintPreviewModal'); if(modal)modal.remove();
    modal=document.createElement('div');modal.id='psgPrintPreviewModal';modal.className='psg-print-preview-modal';
    const card=document.createElement('div');card.className='psg-print-preview-card';
    const head=document.createElement('div');head.className='psg-print-preview-head';
    const title=document.createElement('strong');title.textContent='Preview Ilustrasi / Ringkasan';
    const actions=document.createElement('div');actions.className='psg-print-preview-actions';
    const print=document.createElement('button');print.type='button';print.className='aksi';print.textContent='🖨 Cetak / PDF';
    const x=document.createElement('button');x.type='button';x.className='sakelar';x.textContent='✕ Tutup';actions.append(print,x);head.append(title,actions);
    const body=document.createElement('div');body.className='psg-print-preview-body';
    const clone=active.cloneNode(true); attachIdentity(clone,'preview'); body.appendChild(cleanClone(clone));
    card.append(head,body);modal.appendChild(card);document.body.appendChild(modal);
    x.onclick=()=>close(modal);modal.addEventListener('click',e=>{if(e.target===modal)close(modal)});
    print.onclick=()=>{const oldTitle=document.title;const heading=body.querySelector('h1,h2,h3,.judul,.title');if(heading?.textContent?.trim())document.title=heading.textContent.trim();document.body.classList.add('psg-universal-preview-print');window.print();setTimeout(()=>{document.body.classList.remove('psg-universal-preview-print');document.title=oldTitle},1200)};
    document.documentElement.classList.add('psg-preview-open');document.body.classList.add('psg-preview-open');
  }
  function directPrint(button){
    const active=button.closest('.layar.aktif')||getActive();
    const node=attachIdentity(active);
    const oldTitle=document.title;const heading=active?.querySelector('h1,h2,h3,.judul,.title');if(heading?.textContent?.trim())document.title=heading.textContent.trim();
    window.print();setTimeout(()=>{if(node)node.remove();document.title=oldTitle},1200);
  }
  function attach(){
    document.querySelectorAll(SELECTOR).forEach(b=>{
      if(b.dataset.previewAttached==='1'||b.closest('#psgPrintPreviewModal'))return;if(!isPrintButton(b))return;
      b.dataset.previewAttached='1';
      const p=document.createElement('button');p.type='button';p.className='sakelar psg-preview-btn tanpa-cetak';p.dataset.previewHide='1';p.textContent='👁 Preview';p.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();showPreview()});b.insertAdjacentElement('afterend',p);
    });
  }
  let beforePrintNode=null;
  function ensurePrintIdentity(){
    if(beforePrintNode) return;
    const active=getActive();
    if(!active || excluded(active.id)) return;
    beforePrintNode=attachIdentity(active,'print');
  }
  function removePrintIdentity(){
    if(beforePrintNode){beforePrintNode.remove();beforePrintNode=null;}
  }
  function init(){
    attach();
    const mo=new MutationObserver(()=>attach());mo.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('beforeprint',ensurePrintIdentity);
    window.addEventListener('afterprint',removePrintIdentity);
    window.PSGPrintPreview={open:showPreview,attach,printWithConsultant:directPrint};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
