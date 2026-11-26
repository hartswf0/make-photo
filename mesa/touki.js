/* The horned motorcycle, after Touki Bouki (Djibril Diop Mambéty, 1973): a 1970s road bike with high chrome bars, round mirrors
   on tall stalks, a round headlight over the plate "10", and a zebu skull lashed over the bars with its long horns sweeping out
   and up, the way Mory rides it out of Dakar.
   MesaTouki.build(T) -> { group, wheels: [front, rear], fork, seat: Vector3 (rider), pillion: Vector3, exhaust: Vector3 }.
   The bike faces +z; its origin is on the ground between the wheels. */
(() => {
  "use strict";
  function build(T) {
    const g = new T.Group();
    const chrome = new T.MeshStandardMaterial({ color: 0xd8dce0, metalness: 1, roughness: .18 }), black = new T.MeshStandardMaterial({ color: 0x141416, roughness: .45, metalness: .3 });
    const rubber = new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .9 }), leather = new T.MeshStandardMaterial({ color: 0x1e1612, roughness: .55 }), paint = new T.MeshStandardMaterial({ color: 0x1a1618, roughness: .25, metalness: .4 });
    const bone = new T.MeshStandardMaterial({ color: 0xeee6d4, roughness: .7 }), hide = new T.MeshStandardMaterial({ color: 0x8a5a32, roughness: .9 }), strap = new T.MeshStandardMaterial({ color: 0x6a4428, roughness: .8 });
    const tube = (a, b, r, m) => { const A = new T.Vector3(...a), B = new T.Vector3(...b), mesh = new T.Mesh(new T.CylinderGeometry(r, r, A.distanceTo(B), 8), m); mesh.position.copy(A).add(B).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()); g.add(mesh); return mesh; };
    /* wheels: tyre, rim, twelve spokes, hub */
    function wheel(z) { const w = new T.Group(), tyre = new T.Mesh(new T.TorusGeometry(.29, .06, 10, 28), rubber), rim = new T.Mesh(new T.TorusGeometry(.25, .012, 6, 28), chrome); tyre.rotation.y = rim.rotation.y = Math.PI / 2; w.add(tyre, rim);
      for (let k = 0; k < 12; k++) { const s = new T.Mesh(new T.CylinderGeometry(.004, .004, .5, 4), chrome); s.rotation.x = k / 12 * Math.PI; w.add(s); } const hub = new T.Mesh(new T.CylinderGeometry(.05, .05, .12, 12), chrome); hub.rotation.z = Math.PI / 2; w.add(hub);
      w.position.set(0, .35, z); g.add(w); return w; }
    const front = wheel(.74), rear = wheel(-.72);
    /* frame, engine, exhaust */
    tube([0, 1.0, .5], [0, .62, -.62], .04, black); tube([0, .98, .5], [0, .42, .12], .042, black); tube([0, .42, .12], [0, .42, -.4], .028, black); tube([0, .42, -.4], [0, .35, -.72], .022, black);
    for (const s of [-1, 1]) { tube([s * .1, .62, -.5], [s * .08, .35, -.72], .018, chrome); }
    const engine = new T.Mesh(new T.BoxGeometry(.32, .3, .42), new T.MeshStandardMaterial({ color: 0x9a9a96, metalness: .7, roughness: .4 })); engine.position.set(0, .46, -.04); g.add(engine);
    for (const s of [-1, 1]) { const cyl = new T.Mesh(new T.CylinderGeometry(.075, .085, .26, 12), engine.material); cyl.position.set(s * .07, .66, .1); cyl.rotation.x = .35; g.add(cyl); }
    for (let k = 0; k < 6; k++) { const fin = new T.Mesh(new T.BoxGeometry(.34, .012, .34), chrome); fin.position.set(0, .58 + k * .028, .08); g.add(fin); }
    tube([.13, .4, .08], [.16, .32, -.3], .03, chrome); tube([.16, .32, -.3], [.18, .38, -.95], .035, chrome);
    /* tank, seat, sissy bar, rear light */
    const tank = new T.Mesh(new T.SphereGeometry(.21, 18, 12), paint); tank.scale.set(1.05, .8, 1.75); tank.position.set(0, 1.0, .2); g.add(tank);
    for (const s of [-1, 1]) { const cover = new T.Mesh(new T.BoxGeometry(.04, .2, .3), paint); cover.position.set(s * .13, .68, -.33); g.add(cover); }
    for (const [z, r] of [[.74, .33], [-.72, .34]]) { const fen = new T.Mesh(new T.CylinderGeometry(r + .05, r + .05, .16, 20, 1, true, z > 0 ? -.4 : .9, 1.9), chrome); fen.rotation.z = Math.PI / 2; fen.position.set(0, .35, z); g.add(fen); }
    const stripe = new T.Mesh(new T.SphereGeometry(.172, 16, 10, 0, Math.PI * 2, 1.2, .25), chrome); stripe.scale.copy(tank.scale); stripe.position.copy(tank.position); g.add(stripe);
    const seat = new T.Mesh(new T.BoxGeometry(.28, .09, .78), leather); seat.position.set(0, .86, -.33); g.add(seat);
    tube([-.12, .86, -.7], [-.12, 1.35, -.78], .012, chrome); tube([.12, .86, -.7], [.12, 1.35, -.78], .012, chrome); tube([-.12, 1.35, -.78], [.12, 1.35, -.78], .012, chrome);
    /* the Dogon kanaga on the rear, as on Mory's bike: an upright, an upper bar whose ends rise, a lower bar whose ends fall */
    { const wood = new T.MeshStandardMaterial({ color: 0x5a3a22, roughness: .85 }), k = (a, b, r = .018) => tube(a, b, r, wood);
      k([0, 1.35, -.78], [0, 2.05, -.8], .022); k([-.3, 1.88, -.79], [.3, 1.88, -.79]); k([-.3, 1.88, -.79], [-.32, 2.06, -.79]); k([.3, 1.88, -.79], [.32, 2.06, -.79]);
      k([-.26, 1.58, -.79], [.26, 1.58, -.79]); k([-.26, 1.58, -.79], [-.28, 1.4, -.79]); k([.26, 1.58, -.79], [.28, 1.4, -.79]);
      const head = new T.Mesh(new T.BoxGeometry(.08, .1, .05), wood); head.position.set(0, 2.08, -.8); g.add(head); }
    const tail = new T.Mesh(new T.BoxGeometry(.1, .05, .04), new T.MeshStandardMaterial({ color: 0xd02020, emissive: 0x801010, emissiveIntensity: .6 })); tail.position.set(0, .78, -.82); g.add(tail);
    /* fork, high bars, grips, round mirrors on tall stalks */
    const fork = new T.Group(); g.add(fork); fork.position.set(0, 1.02, .52);
    const ftube = (a, b, r, m) => { const A = new T.Vector3(...a), B = new T.Vector3(...b), mesh = new T.Mesh(new T.CylinderGeometry(r, r, A.distanceTo(B), 8), m); mesh.position.copy(A).add(B).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()); fork.add(mesh); return mesh; };
    for (const s of [-1, 1]) { ftube([s * .09, 0, 0], [s * .09, -.67, .22], .02, chrome); ftube([s * .09, .02, 0], [s * .18, .34, -.08], .013, chrome); ftube([s * .18, .34, -.08], [s * .38, .36, -.2], .013, chrome);
      const grip = ftube([s * .38, .36, -.2], [s * .48, .36, -.22], .02, rubber);
      ftube([s * .3, .35, -.16], [s * .36, .78, -.12], .006, chrome); const mir = new T.Mesh(new T.CylinderGeometry(.065, .065, .02, 20), chrome); mir.rotation.x = Math.PI / 2; mir.position.set(s * .36, .82, -.12); fork.add(mir); }
    const lamp = new T.Mesh(new T.SphereGeometry(.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), chrome); lamp.rotation.x = Math.PI / 2; lamp.position.set(0, -.08, .14); fork.add(lamp);
    const lens = new T.Mesh(new T.CircleGeometry(.1, 20), new T.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xfff0c0, emissiveIntensity: .9 })); lens.position.set(0, -.08, .15); fork.add(lens);
    const plate = (() => { const c = document.createElement("canvas"); c.width = 128; c.height = 64; const q = c.getContext("2d"); q.fillStyle = "#f2efe6"; q.fillRect(0, 0, 128, 64); q.strokeStyle = "#1a1a1a"; q.lineWidth = 5; q.strokeRect(3, 3, 122, 58); q.fillStyle = "#111"; q.font = "700 46px Georgia"; q.textAlign = "center"; q.fillText("10", 64, 48); const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; return new T.Mesh(new T.PlaneGeometry(.2, .1), new T.MeshStandardMaterial({ map: tx })); })();
    plate.position.set(0, -.27, .14); fork.add(plate);
    /* the zebu skull, strapped over the bars, and its horns: tapered, sweeping out and up */
    const skull = new T.Group(); fork.add(skull); skull.position.set(0, .3, .1);
    const face = new T.Mesh(new T.CylinderGeometry(.06, .13, .42, 10), bone); face.rotation.x = Math.PI / 2 - .25; face.scale.set(1, 1, .55); face.position.set(0, -.08, .06); skull.add(face);
    const brow = new T.Mesh(new T.SphereGeometry(.14, 14, 10), bone); brow.scale.set(1.25, .75, .7); brow.position.set(0, .06, -.02); skull.add(brow);
    for (const s of [-1, 1]) { const eye = new T.Mesh(new T.SphereGeometry(.035, 10, 8), new T.MeshStandardMaterial({ color: 0x2a1e14, roughness: 1 })); eye.position.set(s * .07, -.02, .07); skull.add(eye); }
    const patch = new T.Mesh(new T.SphereGeometry(.1, 10, 8), hide); patch.scale.set(1.2, .5, .5); patch.position.set(0, .03, .05); skull.add(patch);
    const band = new T.Mesh(new T.TorusGeometry(.13, .012, 6, 20), strap); band.rotation.x = Math.PI / 2; band.position.set(0, -.12, .03); skull.add(band);
    for (const s of [-1, 1]) { const curve = new T.CatmullRomCurve3([new T.Vector3(s * .1, .07, -.02), new T.Vector3(s * .5, .06, -.06), new T.Vector3(s * .95, .1, -.05), new T.Vector3(s * 1.3, .2, .02), new T.Vector3(s * 1.48, .36, .12)]);   /* wide and nearly flat, curling up only at the tips, as on the poster */
      const N = 16; for (let k = 0; k < N; k++) { const a = curve.getPoint(k / N), b = curve.getPoint((k + 1) / N), r0 = .085 * (1 - k / N) + .008, r1 = .085 * (1 - (k + 1) / N) + .006;
        const seg = new T.Mesh(new T.CylinderGeometry(r1, r0, a.distanceTo(b) * 1.04, 10), k > N * .75 ? new T.MeshStandardMaterial({ color: 0xd8ccb0, roughness: .6 }) : bone); seg.position.copy(a).add(b).multiplyScalar(.5); seg.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); skull.add(seg); } }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return { group: g, wheels: [front, rear], fork, seat: new T.Vector3(0, .86, -.18), pillion: new T.Vector3(0, .9, -.55), exhaust: new T.Vector3(.18, .38, -.98) };
  }
  window.MesaTouki = { build };
})();
