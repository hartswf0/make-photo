# human-forge — license audit & honest scope

Run `python3 forge.py` (bake) · `python3 verify.py` (all gates, writes `verify-report.json`) · `node tools/shot.js <prefix>` (headless Metal screenshots + FPS) · open `demo.html` over http.

## Provenance (all permissive; zero SMPL / SMPL-X / non-commercial)
| Component | Source | License |
|---|---|---|
| Base mesh, rig, skin weights (13,718 v / 27,420 tris, 104 bones) | `naver/anny` 0.6.2 (`pip install anny`), `Anny(phenotypes='all', topology='anny')` | code Apache-2.0 |
| Topology/targets/weights data | MPFB2 / MakeHuman (bundled in anny `data/mpfb2`, `faceunits01`) | CC0-1.0 |
| Python deps used offline | numpy, scipy, torch, trimesh, roma, warp-lang, pillow, PyYAML, safetensors | BSD / MIT / Apache-2.0 / HPND (see `verify-report.json → license_lint.dependency_licenses`) |
| Runtime | `allometric-rig.js`, `demo.html`, `assets/human-assets.js` — own code, no external libraries (zero-dependency WebGL2) | project code |
| Anny `smplx` topology (non-commercial, separate download) | **not installed, not used**; lint fails if `smplx`/`chumpy` is installed or SMPL-named data is present | — |
| Allometry math | Huxley power law, Cole-Green LMS (formulas) | public |
| Height-for-age LMS values | **hand-approximated** around WHO 2007 medians (not copied tables) — stature only; do not cite as WHO data | — |

## What is real (measured by `verify.py`, see `verify-report.json`)
* Head-height ratios (child 6.05 ±0.15 of 6.0; adults 7.50/7.53/7.51 of 7.5 ±0.2) — Anny base + Huxley head scaling about the chin, recomputed independently from the shipped blob.
* Skinned `.glb` for 4 figures (`assets/*.glb`, with JOINTS_0/WEIGHTS_0 top-4 Anny weights) + compact runtime pack.
* Unit dual-quaternion skinning in GLSL (hemisphere sign alignment), pose chain with constant-curvature C1-C7 neck (±24° lean, −22° ext, 3 equal segments), forearm pronation to 160° (twist 0 at elbow, ½ + ½ over forearm/wrist), Eskista scapular glide + thoracic shimmy, analytic 2-bone IK (error < 1e-4 mm on 160 FK-generated reachable targets).
* Regularized 3D Bookstein TPS craniofacial warp (zygion, gonion, nasion/pronasale/pogonion, suprasternal notch, neck sides; anchors pin vault/torso) — strength per figure (adult_m 1.0, adult_f 0.7, child 0.4).
* Baked 4C-style hair: scalp shell (curl-displaced, crown/side thickness profile, boundary taper) skinned with scalp weights + procedural coil shading. NOT lifted-curl geometry / strands.
* Jacobian gate: no new inverted triangles vs. rest across 25 neck (±24° lean × −22..40° flex) and 32 pronation (0-160°, elbow 20°/90°) samples × 4 figures. Metric = sign of (face normal · mean vertex normal) per triangle, plus min area ratio (reported). Rest mesh itself has 2–20 such triangles (eye/mouth cavities) — baseline-subtracted.
* 120 fps headless Metal (M3 Max) bust and full views, `gl.getError()==0`, 0 console errors.

## What is NOT done / not faked
* **Silhouette IoU vs reference bust: 0.83 (adult_m, 0.78 cut), 0.81 adult_f, 0.79 elder, 0.83 child (mean of 0°/35°/90°).** Aspiration 0.94 **not met.** Method: uniform scale to the reference bbox height, bbox-centre alignment, bust cut height picked by search (0.70–0.84 H); it is a style target, not a fitted model (no per-image optimisation, deliberately).
* **Elbow flexion fold:** at 90° elbow flexion 4–8 triangles invert at the inner crease (independent of pronation; reported as `elbow_flex_fold_neg`). Needs the corrective-morph step below.
* **Pose-indexed corrective morphs (ARAP/HRBF, RGBA16F gl_VertexID texture): not built.** Bones go through a plain DQS; no texture-based deltas shipped.
* **Bounded Biharmonic Weights: not built** (libigl not installed/attempted; Anny's own CC0 weights are used, top-4 renormalized).
* **Pack burro:** no license-clean quadruped mesh exists in Anny; the existing `donkey/*` burro is to be used by the world page. Not part of this pack.
* **XPBD shawl/ponytail, cloth: not built.** Hair has no secondary motion.
* The child is a *scaled adolescent-phenotype Anny* (age param 0.215) with Huxley head enlargement to reach 6.0 heads, not a growth-curve-fitted 7-yr mesh; the centile dial only scales stature (+ Huxley α=−0.35 head) around the baked figure.
* Anny rest pose is a T-pose; the demo lowers the arms through the same DQS rig (default 62°).
* Faces are generic Anny faces with TPS plane sharpening: no per-character identity sculpting.
