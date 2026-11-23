// Attach the one game surface to any world: load this after the world defines window.AhiyaBridge.
// <script src="../night-post/rain/attach.js" data-hide=".exp-header,.dock-bar"></script>
// The world's own HUD (data-hide) is hidden while the surface runs; add ?legacy to the URL to keep the old HUD instead.
(() => {
  const me = document.currentScript, base = new URL('./', me.src).href;
  if (!window.DW) { const c = document.createElement('script'); c.src = base + 'carry.js?v=1'; document.head.append(c); }
  if (new URLSearchParams(location.search).has('legacy')) return;
  const hide = (me.dataset.hide || '').split(',').map(s => s.trim()).filter(Boolean);
  if (hide.length) { const st = document.createElement('style'); st.textContent = hide.join(',') + '{display:none!important}'; document.head.append(st); }
  const lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.href = base + 'rain.css?v=1'; document.head.append(lk);
  const go = () => { const en = document.createElement('script'); en.src = base + 'engine.js?v=2'; en.onload = () => { const su = document.createElement('script'); su.src = base + 'surface.js?v=ow2'; document.head.append(su); }; document.head.append(en); };
  (function wait() { if (window.AhiyaBridge && window.AhiyaBridge.canvas) go(); else setTimeout(wait, 200); })();
})();
