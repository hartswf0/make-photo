/* The trough gate: the one way every edition leads into the trough (atlas/overworld.html). An edition begins in its own world and
   stands this somewhere a player will reach: a long stone trough of cyan water, a blue jerry can on its rim, and a beam you can see
   from far off. See atlas/JERRYCAN.md, "Beginning in your own world".
     TroughGate.build(T) -> Group (origin on the ground, about 5 m long)
     TroughGate.go(from, island)  leaves for the trough, arriving at that island, and notes in dw.carry where you came from */
(() => {
  "use strict";
  const HERE = document.currentScript ? new URL("./", document.currentScript.src).href : new URL("../atlas/", location.href).href;
  function build(T) { const g = new T.Group(), stone = new T.MeshStandardMaterial({ color: 0x9a948a, roughness: .95 }), water = new T.MeshStandardMaterial({ color: 0x2fd0d8, emissive: 0x1a9aa8, emissiveIntensity: .9, roughness: .1 }), blue = new T.MeshStandardMaterial({ color: 0x1f5fd0, roughness: .4 });
    const box = (w, h, d, m, x, y, z) => { const b = new T.Mesh(new T.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; g.add(b); return b; };
    box(5, .7, 1.5, stone, 0, .35, 0); box(4.6, .06, 1.1, water, 0, .68, 0); for (const s of [-1, 1]) box(.5, .5, 1.7, stone, s * 2.1, .25, 0);
    box(.5, .7, .3, blue, 1.6, 1.07, .45); box(.3, .1, .1, blue, 1.6, 1.47, .45); box(.1, .12, .1, new T.MeshStandardMaterial({ color: 0x111111 }), 1.42, 1.48, .45);   /* the jerry can */
    const beam = new T.Mesh(new T.CylinderGeometry(.5, .5, 160, 12, 1, true), new T.MeshBasicMaterial({ color: 0x2fd0d8, transparent: true, opacity: .22, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false })); beam.position.y = 80; g.add(beam); g.userData.beam = beam;
    return g; }
  function go(from, island) { try { const c = JSON.parse(sessionStorage.getItem("dw.carry") || "{}") || {}; c.from = from; sessionStorage.setItem("dw.carry", JSON.stringify(c)); } catch (e) { }
    location.href = HERE + "overworld.html?island=" + encodeURIComponent(island || "") + "&from=" + encodeURIComponent(from || ""); }
  window.TroughGate = { build, go };
})();
