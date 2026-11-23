// One journey across every world. DW.go(url) carries the can, Mistletoe's thirst and how you travel into the next place,
// through the same rain wipe in and out, so moving between levels reads as one game. DW.carry is what arrived here.
(() => {
  if (window.DW) return;
  let carry = null; try { carry = JSON.parse(sessionStorage.getItem('dw.carry') || 'null'); } catch { }
  if (carry && Date.now() - carry.at > 10 * 60 * 1000) carry = null;                      // a stale journey is not carried
  const css = document.createElement('style'); css.textContent = `#dw-wipe{position:fixed;inset:0;z-index:2147483000;pointer-events:none;background:radial-gradient(circle at 50% 60%,rgba(120,200,215,.0) 0,rgba(14,36,48,.92) 55%,#0a151d 80%);opacity:0;transition:opacity .6s ease}
  #dw-wipe.on{opacity:1}#dw-wipe i{position:absolute;top:-10%;width:2px;height:22%;background:linear-gradient(transparent,rgba(190,240,246,.75));animation:dwfall .7s linear infinite}@keyframes dwfall{to{transform:translateY(560%)}}`;
  document.head.append(css);
  const wipe = document.createElement('div'); wipe.id = 'dw-wipe'; for (let k = 0; k < 26; k++) { const i = document.createElement('i'); i.style.left = (k * 3.9 + Math.random() * 3) + '%'; i.style.animationDelay = (-Math.random() * .7) + 's'; wipe.append(i); }
  const mount = () => document.body ? document.body.append(wipe) : setTimeout(mount, 30); mount();
  if (carry && Date.now() - carry.at < 15000) { wipe.classList.add('on'); setTimeout(() => wipe.classList.remove('on'), 900); }  // arrive out of the same rain you left in
  // arriving through a door, you land in the world, not on its title card: the level's own Begin is pressed for you
  if (carry && carry.door && Date.now() - carry.at < 60000) { const BEGIN = ['#demo-brief-ok', '#field-enter', '#begin', '#start'], done = new Set(), t0 = Date.now();
    const seen = el => el && !el.disabled && !el.hidden && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    const tick = () => { for (const q of BEGIN) { if (done.has(q)) continue; const el = document.querySelector(q); if (seen(el)) { done.add(q); try { el.click(); } catch { } } } if (Date.now() - t0 < 45000) setTimeout(tick, 350); else try { const c = JSON.parse(sessionStorage.getItem('dw.carry') || 'null'); if (c) { delete c.door; sessionStorage.setItem('dw.carry', JSON.stringify(c)); } } catch { } };
    addEventListener('DOMContentLoaded', tick); if (document.readyState !== 'loading') tick(); }
  window.DW = { carry,
    go(url, extra = {}) { let st = null; try { st = window.AhiyaBridge && window.AhiyaBridge.state(); } catch { }
      const c = { at: Date.now(), from: location.pathname, liters: st ? st.water.liters : (carry && carry.liters), donkey: st ? st.water.donkey : (carry && carry.donkey), mode: st ? st.mode : 'walk', ...extra };
      try { sessionStorage.setItem('dw.carry', JSON.stringify(c)); } catch { }
      wipe.classList.add('on'); setTimeout(() => { location.href = url; }, 620); },
    prefetch(urls) { for (const u of urls) { if (document.querySelector(`link[data-dw="${u}"]`)) continue; const l = document.createElement('link'); l.rel = 'prefetch'; l.href = u; l.dataset.dw = u; document.head.append(l); } } };
})();
