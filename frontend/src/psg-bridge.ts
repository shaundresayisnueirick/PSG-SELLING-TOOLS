// PSG Selling Tools — Android WebView bridge.
//
// This is plain ES5 JavaScript injected into the WebView. It adapts the
// browser-only parts of the existing PWA to native Android WITHOUT changing any
// business logic, formulas or data:
//   - window.print() / window.Android.cetak(title)  -> native PDF (expo-print)
//   - <a download> blob saves (backup/export)        -> native save/share
//   - navigator.clipboard.writeText                  -> native clipboard
//   - quickchart.io QR images                        -> generated locally, offline
//   - anti "white flash" when dark theme is active
//   - window.__psgBack() helper for the hardware Back button
//
// Nothing here rewrites the app's engines; it only wires I/O to Android.

// Runs BEFORE the page paints, on every navigation. Only job: kill the white
// flash when the saved theme is dark (the app's own stylesheet loads a moment
// later, so we paint the dark background instantly).
export const INJECTED_BEFORE = `(function(){
  try{
    var t=null;
    try{ t=localStorage.getItem('insuranceHub.theme.v3'); }catch(e){}
    if(t==='dark'){
      var apply=function(){
        try{
          document.documentElement.style.background='#080B0F';
          if(document.body) document.body.style.background='#080B0F';
        }catch(e){}
      };
      apply();
      var s=document.createElement('style');
      /* Scope the anti-flash background to the SCREEN only. Without this media
         guard the rule is picked up by the print-HTML serialiser (collectCss),
         darkening the PDF paper to near-black while the text keeps its original
         dark colour — the reported "blank / unreadable dark-mode PDF". */
      s.textContent='@media screen{html,body{background:#080B0F !important}}';
      (document.head||document.documentElement).appendChild(s);
      document.addEventListener('DOMContentLoaded',apply);
    }
    if(window.ReactNativeWebView){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'theme',theme:(t==='dark'?'dark':'light')}));
    }
  }catch(e){}
})();
true;`;

// Runs AFTER each page load. Sets up every bridge feature. Guarded so it is safe
// even if it runs more than once on the same document.
export const INJECTED_MAIN = `(function(){
  if(window.__psgBridge) return; window.__psgBridge=true;

  function post(o){ try{ window.ReactNativeWebView.postMessage(JSON.stringify(o)); }catch(e){} }
  window.__psgPost=post;

  /* ---------- report theme so native can match the background ---------- */
  try{
    var th=null; try{ th=localStorage.getItem('insuranceHub.theme.v3'); }catch(e){}
    post({type:'theme',theme:(th==='dark'?'dark':'light')});
  }catch(e){}

  /* ---------- signal that content is painted (hide splash overlay) ---------- */
  function ready(){ post({type:'ready'}); }
  if(document.readyState==='complete'||document.readyState==='interactive'){ setTimeout(ready,0); }
  else { document.addEventListener('DOMContentLoaded',function(){ setTimeout(ready,0); }); }
  window.addEventListener('load',ready);

  /* ---------- helpers ---------- */
  function imgToDataURL(img){
    try{
      var src=img.getAttribute('src')||'';
      if(!src) return src;
      if(src.indexOf('data:')===0) return src;
      var w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
      if(!w||!h) return src;
      var c=document.createElement('canvas'); c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0);
      return c.toDataURL('image/png');
    }catch(e){ return img.getAttribute('src')||''; }
  }
  function collectCss(){
    var css='';
    try{
      for(var i=0;i<document.styleSheets.length;i++){
        try{
          var rules=document.styleSheets[i].cssRules;
          if(!rules) continue;
          for(var j=0;j<rules.length;j++){ css+=rules[j].cssText+'\\n'; }
        }catch(e){}
      }
    }catch(e){}
    return css;
  }
  function serializeForPrint(){
    var live=document.querySelectorAll('img'); var map=[];
    for(var i=0;i<live.length;i++){ live[i].setAttribute('data-psg-i',String(i)); map[i]=imgToDataURL(live[i]); }
    var clone=document.documentElement.cloneNode(true);
    var s=clone.querySelectorAll('script'); for(var k=0;k<s.length;k++){ s[k].parentNode&&s[k].parentNode.removeChild(s[k]); }
    var links=clone.querySelectorAll('link[rel="stylesheet"]'); for(var l=0;l<links.length;l++){ links[l].parentNode&&links[l].parentNode.removeChild(links[l]); }
    var ci=clone.querySelectorAll('img[data-psg-i]');
    for(var m=0;m<ci.length;m++){ var idx=+ci[m].getAttribute('data-psg-i'); if(map[idx]) ci[m].setAttribute('src',map[idx]); ci[m].removeAttribute('data-psg-i'); }
    for(var n=0;n<live.length;n++){ live[n].removeAttribute('data-psg-i'); }
    var head=clone.querySelector('head')||clone;
    var st=document.createElement('style'); st.textContent=collectCss(); head.appendChild(st);
    /* Force a neutral LIGHT appearance for the PDF regardless of the on-screen
       theme. The dark skin is scoped to @media screen, but the anti-flash inline
       backgrounds (and some print engines that render using screen media) can
       still darken the page — which made dark-mode PDFs come out black/blank.
       We strip the dark theme marker + inline dark backgrounds from the clone and
       append a last-wins normaliser so the paper is always white with readable
       text. Business content, formulas and layout are untouched. */
    try{
      clone.setAttribute('data-theme','original');
      if(clone.style){ clone.style.background=''; clone.style.backgroundColor=''; }
      var cbody=clone.querySelector('body');
      if(cbody){ cbody.setAttribute('data-theme','original'); if(cbody.style){ cbody.style.background=''; cbody.style.backgroundColor=''; } }
    }catch(e){}
    var norm=document.createElement('style');
    norm.textContent='html,body{background:#fff !important;background-image:none !important;color-scheme:light !important;-webkit-text-fill-color:initial}';
    head.appendChild(norm);
    var dt='original';
    return '<!DOCTYPE html><html data-theme="'+dt+'" lang="id">'+clone.innerHTML+'</html>';
  }

  /* ---------- PRINT -> native PDF ---------- */
  function doPrint(title){
    try{
      var html=serializeForPrint();
      post({type:'print', title:String(title||document.title||'Dokumen'), html:html});
    }catch(e){ post({type:'error', message:'print: '+e}); }
  }
  try{ window.print=function(){ doPrint(document.title); }; }catch(e){}
  window.Android=window.Android||{};
  window.Android.cetak=function(judul){ doPrint(judul); };

  /* ---------- DOWNLOAD (blob / data url) -> native save ---------- */
  try{
    var _create=URL.createObjectURL ? URL.createObjectURL.bind(URL) : null;
    if(_create){
      window.__psgBlobs={};
      URL.createObjectURL=function(blob){ var u=_create(blob); try{ window.__psgBlobs[u]=blob; }catch(e){} return u; };
    }
  }catch(e){}
  function sendDownload(name, dataUrl){ post({type:'download', filename:String(name||'berkas'), dataUrl:dataUrl}); }
  document.addEventListener('click', function(e){
    try{
      var a=e.target && e.target.closest ? e.target.closest('a[download]') : null;
      if(!a) return;
      var href=a.getAttribute('href')||'';
      var name=a.getAttribute('download')||'berkas';
      e.preventDefault(); e.stopPropagation();
      if(href.indexOf('data:')===0){ sendDownload(name, href); return; }
      var blob=window.__psgBlobs && window.__psgBlobs[href];
      if(blob){
        var fr=new FileReader();
        fr.onload=function(){ sendDownload(name, String(fr.result)); };
        fr.onerror=function(){ post({type:'error',message:'read blob failed'}); };
        fr.readAsDataURL(blob);
      } else if(href.indexOf('blob:')===0){
        fetch(href).then(function(r){return r.blob();}).then(function(b){
          var fr2=new FileReader(); fr2.onload=function(){ sendDownload(name,String(fr2.result)); }; fr2.readAsDataURL(b);
        }).catch(function(){ post({type:'error',message:'blob fetch failed'}); });
      }
    }catch(err){ post({type:'error', message:'download: '+err}); }
  }, true);

  /* ---------- CLIPBOARD -> native ---------- */
  try{
    var writeBridge=function(text){ post({type:'clipboard', text:String(text==null?'':text)}); return Promise.resolve(); };
    if(navigator.clipboard){ try{ navigator.clipboard.writeText=writeBridge; }catch(e){ try{ Object.defineProperty(navigator,'clipboard',{value:{writeText:writeBridge},configurable:true}); }catch(_){}} }
    else { try{ Object.defineProperty(navigator,'clipboard',{value:{writeText:writeBridge},configurable:true}); }catch(_){}}
  }catch(e){}

  /* ---------- QR codes generated locally (offline) ---------- */
  function replaceQR(img){
    try{
      var src=img.getAttribute('src')||'';
      if(src.indexOf('quickchart.io/qr')<0) return;
      if(img.getAttribute('data-psg-qr')) return;
      if(!window.qrcode) return;
      var u; try{ u=new URL(src, location.href); }catch(_){ return; }
      var text=u.searchParams.get('text')||'';
      if(!text) return;
      var qr=window.qrcode(0,'M'); qr.addData(text); qr.make();
      img.setAttribute('data-psg-qr','1');
      img.src=qr.createDataURL(5,4);
    }catch(e){}
  }
  function scanQR(){ try{ var im=document.querySelectorAll('img'); for(var i=0;i<im.length;i++) replaceQR(im[i]); }catch(e){} }
  function ensureQRLib(cb){
    if(window.qrcode){ cb(); return; }
    try{
      var sc=document.createElement('script'); sc.src='vendor/qrcode.js';
      sc.onload=function(){ cb(); }; sc.onerror=function(){ post({type:'error',message:'qr lib load failed'}); };
      (document.head||document.documentElement).appendChild(sc);
    }catch(e){}
  }
  ensureQRLib(scanQR);
  try{
    var mo=new MutationObserver(function(muts){
      var need=false;
      for(var i=0;i<muts.length;i++){
        var mm=muts[i];
        if(mm.type==='attributes' && mm.target && mm.target.tagName==='IMG'){ need=true; }
        if(mm.addedNodes){ for(var j=0;j<mm.addedNodes.length;j++){ var nd=mm.addedNodes[j]; if(nd.nodeType===1 && (nd.tagName==='IMG' || (nd.querySelector && nd.querySelector('img')))){ need=true; } } }
      }
      if(need) ensureQRLib(scanQR);
    });
    mo.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
  }catch(e){}

  /* ---------- open external http(s) links in the system browser ---------- */
  document.addEventListener('click', function(e){
    try{
      var a=e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if(!a) return;
      var href=a.getAttribute('href')||'';
      if(/^https?:\\/\\//i.test(href)){ e.preventDefault(); post({type:'openurl', url:href}); }
    }catch(err){}
  }, true);

  /* ---------- hardware Back button helper ---------- */
  window.__psgBack=function(){
    try{
      var handled=false;
      if(typeof window.tekanKembali==='function'){ handled=!!window.tekanKembali(); }
      post({type:'back', handled:handled});
    }catch(e){ post({type:'back', handled:false}); }
  };
})();
true;`;
