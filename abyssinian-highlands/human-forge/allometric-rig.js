/* allometric-rig.js — ABYSSINIAN HIGHLANDS human-forge runtime (zero dependencies, WebGL2 / node).
 * Meshes: naver/anny (Apache-2.0) + MPFB2/MakeHuman CC0 data, baked offline by forge.py.
 * Skinning: unit dual-quaternion blending (Kavan 2007) in the vertex shader, hemisphere sign alignment.
 * Pose: constant-curvature C1-C7 neck, forearm pronation chain, Eskista scapular glide, analytic 2-bone IK.
 * UMD: browser global `AllometricRig`; node `require('./allometric-rig.js')` (CPU skinning for verify.mjs).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.AllometricRig = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const D2R = Math.PI / 180, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // ---------------------------------------------------------------- quaternion [x,y,z,w]
  const qmul = (a, b) => [a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1], a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
    a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3], a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
  const qaxis = (ax, ang) => { const l = Math.hypot(ax[0], ax[1], ax[2]) || 1, s = Math.sin(ang / 2) / l; return [ax[0]*s, ax[1]*s, ax[2]*s, Math.cos(ang / 2)]; };
  const qrot = (q, v) => { const [x, y, z, w] = q, tx = 2*(y*v[2] - z*v[1]), ty = 2*(z*v[0] - x*v[2]), tz = 2*(x*v[1] - y*v[0]);
    return [v[0] + w*tx + y*tz - z*ty, v[1] + w*ty + z*tx - x*tz, v[2] + w*tz + x*ty - y*tx]; };
  const qconj = q => [-q[0], -q[1], -q[2], q[3]];
  const dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
  const sub = (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]], add = (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
  const scl = (a, s) => [a[0]*s, a[1]*s, a[2]*s], len = a => Math.hypot(a[0], a[1], a[2]);
  const nrm3 = a => { const l = len(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
  const IDQ = [0, 0, 0, 1];
  function qfromTo(a, b) { // shortest-arc rotation a->b (unit vectors)
    const d = dot3(a, b);
    if (d < -0.999999) { let ax = cross([1, 0, 0], a); if (len(ax) < 1e-6) ax = cross([0, 1, 0], a); return qaxis(ax, Math.PI); }
    const c = cross(a, b), q = [c[0], c[1], c[2], 1 + d], l = Math.hypot(q[0], q[1], q[2], q[3]); return q.map(x => x / l);
  }
  // ---------------------------------------------------------------- blob decode
  function b64(s) { if (typeof atob === 'function') { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; } return new Uint8Array(Buffer.from(s, 'base64')); }
  const CT = { float32: Float32Array, int16: Int16Array, uint8: Uint8Array, uint16: Uint16Array };
  function decode(asset) {
    const u8 = b64(asset.blob), buf = u8.buffer, L = asset.meta.layout, out = {};
    for (const k in L) out[k] = new CT[L[k].dtype](buf, L[k].offset, L[k].count);
    return out;
  }
  // ---------------------------------------------------------------- Figure: skeleton + pose (CPU, node-safe)
  const HEIGHT_S = { child7: 0.0443, adult_f: 0.038, adult_m: 0.038, elder: 0.038 };
  class Figure {
    constructor(key, asset) {
      this.key = key; this.meta = asset.meta; this.data = decode(asset);
      const B = this.meta.bones; this.names = B.names; this.par = B.parents; this.heads = B.heads; this.dirs = B.dirs;
      this.nb = this.names.length; this.idx = {}; this.names.forEach((n, i) => this.idx[n] = i);
      this.nv = this.meta.nverts; this.baseHeight = this.meta.info.stature; this.headsTall = this.meta.info.heads_tall;
      this.pivot = this.meta.info.pivot; this.centile = 0; this.scale = 1; this.headK = 1;
      this.kids = this.names.map(() => []); this.par.forEach((p, i) => { if (p >= 0) this.kids[p].push(i); });
      this.rot = this.names.map(() => IDQ.slice());
      this.G = this.names.map(() => ({ q: IDQ.slice(), t: [0, 0, 0] }));
      this.dq = new Float32Array(this.nb * 8);
      this.pose = { neckLeanDeg: 0, neckFlexDeg: 0, armDownDeg: 0, elbowFlexDeg: 0, pronationDeg: 0, eskista: 0, eskistaAmp: 0, spineTwistDeg: 0 };
      this.ik = { L: null, R: null }; this.twist1 = { L: IDQ, R: IDQ };
      this._chain();
      this.updateDQ();
    }
    get height() { return this.baseHeight * this.scale; }
    _chain() { // bone chains
      const g = (s) => { const i = this.idx[s]; if (i === undefined) throw new Error('bone ' + s); return i; };
      this.neck = ['neck01', 'neck02', 'neck03'].map(g);
      this.arm = {}; for (const s of ['L', 'R']) this.arm[s] = { clav: g('clavicle.' + s), sh: g('shoulder01.' + s), el: g('lowerarm01.' + s),
        f1: g('lowerarm01.' + s), f2: g('lowerarm02.' + s), wr: g('wrist.' + s), up1: g('upperarm01.' + s) };
      this.spine = ['spine05', 'spine04', 'spine03', 'spine02', 'spine01'].map(g);
    }
    // centile dial: Cole-Green LMS (L=1) stature factor + Huxley negative allometry of the head (alpha=-0.35 relative)
    setCentile(z) { const S = HEIGHT_S[this.key] || 0.04; this.centile = z; this.scale = 1 + S * z; this.headK = Math.pow(this.scale, -0.35); return this; }
    setPose(p) { Object.assign(this.pose, p); this.updatePose(); return this; }
    ik2(side, target) { this.ik[side] = target ? target.slice() : null; this.updatePose(); return this; }
    updatePose() {
      const P = this.pose, R = this.rot; for (let i = 0; i < this.nb; i++) R[i] = IDQ.slice();
      // constant-curvature neck: total lean (roll about +Z) and flexion (about +X) shared equally over C1-C7 segments
      const lean = clamp(P.neckLeanDeg, -24, 24) * D2R, flex = clamp(P.neckFlexDeg, -22, 40) * D2R;
      for (const b of this.neck) R[b] = qmul(qaxis([0, 0, 1], -lean / 3), qaxis([1, 0, 0], flex / 3)); // +lean = head to subject-left (+X)
      // spine twist + Eskista (scapular glide: alternating clavicle protraction/elevation, thoracic shimmy)
      const ph = P.eskista * 2 * Math.PI, A = P.eskistaAmp || 0;
      for (const b of this.spine) R[b] = qaxis([0, 1, 0], (P.spineTwistDeg * D2R + A * 0.10 * Math.sin(ph)) / this.spine.length);
      for (const s of ['L', 'R']) {
        const a = this.arm[s], sg = s === 'L' ? 1 : -1, glide = sg * Math.sin(ph + (s === 'L' ? 0 : 0));
        R[a.clav] = qmul(qaxis([0, 0, 1], sg * A * 0.14 * Math.cos(ph) * sg), qaxis([0, 1, 0], sg * -A * 0.20 * glide));
        // arm lowering (about Z), elbow flex (about Y), pronation distributed over forearm chain
        R[a.sh] = qaxis([0, 0, 1], -sg * clamp(P.armDownDeg, -30, 100) * D2R);
        R[a.el] = qaxis([0, 1, 0], -sg * clamp(P.elbowFlexDeg, 0, 150) * D2R);
        const pr = (typeof P.pronationDeg === 'object' ? P.pronationDeg[s] : P.pronationDeg) * D2R * sg;
        const ax = this.dirs[a.f1];
        this.twist1[s] = IDQ.slice(); // elbow segment untwisted (keeps the crease clean) R[a.f2] = qaxis(this.dirs[a.f2], pr / 2); R[a.wr] = qaxis(this.dirs[a.wr], pr / 2);
        if (this.ik[s]) this._solveIK(s, this.ik[s]);
      }
      this.updateDQ();
    }
    // analytic 2-bone IK: shoulder01 -> lowerarm01 (elbow) -> wrist. Target in figure-local metres (rest frame, unscaled).
    _solveIK(s, T) {
      const a = this.arm[s], Sp = this.heads[a.sh], E = this.heads[a.el], W = this.heads[a.wr], sg = s === 'L' ? 1 : -1;
      // account for shoulder-chain (clavicle) transform: IK from the posed shoulder joint
      const Gs = this._fk(a.clav); const Sw = this._apply(Gs, Sp);
      const l1 = len(sub(E, Sp)), l2 = len(sub(W, E));
      let tv = sub(T, Sw), d = clamp(len(tv), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
      const tdir = nrm3(tv), alpha = Math.acos(clamp((l1*l1 + l2*l2 - d*d) / (2*l1*l2), -1, 1)); // interior elbow angle
      const aD = nrm3(sub(E, Sp)), bD = nrm3(sub(W, E)); const alpha0 = Math.acos(clamp(-dot3(aD, bD), -1, 1));
      // pole: elbow points back/down
      const pole = [0, -0.6, -1];
      let n0 = cross(aD, pole); if (len(n0) < 1e-6) n0 = [0, 1, 0]; n0 = nrm3(n0);
      let beta = alpha0 - alpha; // bend (reduces interior angle); sign chosen below by test
      const tryB = (bt) => { const qe = qaxis(n0, bt), w1 = add(sub(E, Sp), qrot(qe, sub(W, E))); return { qe, w1 }; };
      // refine bend magnitude so |wrist-shoulder| == d exactly even when the rest arm is not planar
      const refine = (sign) => { let lo = 0, hi = Math.PI * 0.98; for (let it = 0; it < 40; it++) { const mid = .5 * (lo + hi); (len(tryB(sign * mid).w1) > d) ? lo = mid : hi = mid; } return sign * .5 * (lo + hi); };
      const b1 = refine(1), b2 = refine(-1);
      let r = tryB(b1); const r2 = tryB(b2); // pick the sign that puts the elbow nearer the pole after swing
      const solve = (rr) => { const sw = qfromTo(nrm3(rr.w1), tdir); const eo = qrot(sw, sub(E, Sp));
        // twist around tdir to push elbow toward pole
        const pp = sub(pole, scl(tdir, dot3(pole, tdir))), ee = sub(eo, scl(tdir, dot3(eo, tdir)));
        let tw = IDQ; if (len(pp) > 1e-6 && len(ee) > 1e-6) { const ang = Math.atan2(dot3(cross(nrm3(ee), nrm3(pp)), tdir), dot3(nrm3(ee), nrm3(pp))); tw = qaxis(tdir, ang); }
        const qs = qmul(tw, sw); const elbow = qrot(qs, sub(E, Sp)); return { qs, score: dot3(nrm3(elbow), nrm3(pole)) }; };
      const A1 = solve(r), A2 = solve(r2); const pick = A1.score >= A2.score ? [A1, r] : [A2, r2];
      // shoulder rotation is given in clavicle-parent frame: undo clavicle rotation so world swing is achieved
      const qc = Gs.q; this.rot[a.sh] = qmul(qconj(qc), qmul(pick[0].qs, qc));
      this.rot[a.el] = qmul(pick[1].qe, this.twist1[s]);
    }
    _apply(G, p) { const r = qrot(G.q, p); return [r[0] + G.t[0], r[1] + G.t[1], r[2] + G.t[2]]; }
    _fk(b) { // global transform of bone b under current this.rot (reuses cached G if fresh)
      const chain = []; for (let i = b; i >= 0; i = this.par[i]) chain.push(i);
      let q = IDQ.slice(), t = [0, 0, 0];
      for (let k = chain.length - 1; k >= 0; k--) { const i = chain[k], Rq = this.rot[i], h = this.heads[i], rh = qrot(Rq, h), tl = [h[0]-rh[0], h[1]-rh[1], h[2]-rh[2]];
        const tt = qrot(q, tl); t = [tt[0] + t[0], tt[1] + t[1], tt[2] + t[2]]; q = qmul(q, Rq); }
      return { q, t };
    }
    updateDQ() {
      const G = this.G, dq = this.dq;
      for (let i = 0; i < this.nb; i++) {
        const Rq = this.rot[i], h = this.heads[i], rh = qrot(Rq, h), tl = [h[0]-rh[0], h[1]-rh[1], h[2]-rh[2]], p = this.par[i];
        let q, t;
        if (p < 0) { q = Rq; t = tl; } else { const Gp = G[p], tt = qrot(Gp.q, tl); q = qmul(Gp.q, Rq); t = [tt[0] + Gp.t[0], tt[1] + Gp.t[1], tt[2] + Gp.t[2]]; }
        G[i].q = q; G[i].t = t;
        const d = qmul([t[0], t[1], t[2], 0], q); // dual = 0.5 * t * q
        dq[i*8] = q[0]; dq[i*8+1] = q[1]; dq[i*8+2] = q[2]; dq[i*8+3] = q[3];
        dq[i*8+4] = .5*d[0]; dq[i*8+5] = .5*d[1]; dq[i*8+6] = .5*d[2]; dq[i*8+7] = .5*d[3];
      }
      this.version = (this.version || 0) + 1;
    }
    boneWorld(name, local) { const b = this.idx[name]; return this._apply(this.G[b], local || this.heads[b]); }
    posedHeads() { return this.names.map((n, i) => this.par[i] < 0 ? this.heads[i].slice() : this._apply(this.G[this.par[i]], this.heads[i])); }
    // CPU dual-quaternion skinning (same maths as the GLSL). Returns Float32Array(nv*3) in figure space (incl. head allometry, not model scale).
    skinCPU(out) {
      const d = this.data, nv = this.nv, dq = this.dq; out = out || new Float32Array(nv * 3); const hk = this.headK, pv = this.pivot;
      for (let v = 0; v < nv; v++) {
        const hw = d.headw[v] / 255, s = 1 + (hk - 1) * hw;
        const px = pv[0] + (d.pos[v*3] - pv[0]) * s, py = pv[1] + (d.pos[v*3+1] - pv[1]) * s, pz = pv[2] + (d.pos[v*3+2] - pv[2]) * s;
        let r0 = 0, r1 = 0, r2 = 0, r3 = 0, e0 = 0, e1 = 0, e2 = 0, e3 = 0, ref = -1;
        for (let k = 0; k < 4; k++) {
          let w = d.weights[v*4+k] / 255; if (!w) continue; const j = d.joints[v*4+k] * 8;
          if (ref < 0) ref = j; else if (dq[j]*dq[ref] + dq[j+1]*dq[ref+1] + dq[j+2]*dq[ref+2] + dq[j+3]*dq[ref+3] < 0) w = -w; // hemisphere alignment
          r0 += w*dq[j]; r1 += w*dq[j+1]; r2 += w*dq[j+2]; r3 += w*dq[j+3]; e0 += w*dq[j+4]; e1 += w*dq[j+5]; e2 += w*dq[j+6]; e3 += w*dq[j+7];
        }
        const n = Math.hypot(r0, r1, r2, r3) || 1; r0 /= n; r1 /= n; r2 /= n; r3 /= n; e0 /= n; e1 /= n; e2 /= n; e3 /= n;
        const rp = qrot([r0, r1, r2, r3], [px, py, pz]);
        out[v*3] = rp[0] + 2*(r3*e0 - e3*r0 + r1*e2 - r2*e1); out[v*3+1] = rp[1] + 2*(r3*e1 - e3*r1 + r2*e0 - r0*e2); out[v*3+2] = rp[2] + 2*(r3*e2 - e3*r2 + r0*e1 - r1*e0);
      }
      return out;
    }
  }
  // ---------------------------------------------------------------- WebGL2 renderer
  const VS = `#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in uvec4 aJ; layout(location=3) in vec4 aW; layout(location=4) in float aHW;
uniform mat4 uVP, uModel; uniform sampler2D uBones; uniform float uHeadK; uniform vec3 uPivot;
out vec3 vN; out vec3 vW; out float vY; out float vHW; out vec3 vP;
vec4 R(uint j){ return texelFetch(uBones, ivec2(int(j)*2,0), 0); }
vec4 Dd(uint j){ return texelFetch(uBones, ivec2(int(j)*2+1,0), 0); }
vec4 qm(vec4 a, vec4 b){ return vec4(a.w*b.xyz + b.w*a.xyz + cross(a.xyz,b.xyz), a.w*b.w - dot(a.xyz,b.xyz)); }
vec3 qr(vec4 q, vec3 v){ vec3 t = 2.0*cross(q.xyz, v); return v + q.w*t + cross(q.xyz, t); }
void main(){
  float s = 1.0 + (uHeadK-1.0)*aHW; vec3 p = uPivot + (aPos-uPivot)*s;
  vec4 r0 = R(aJ.x); vec4 acc = vec4(0), dacc = vec4(0); 
  for(int k=0;k<4;k++){ uint j = aJ[k]; float w = aW[k]; if(w<=0.0) continue; vec4 r = R(j); vec4 d = Dd(j);
    if(dot(r,r0)<0.0) w=-w; acc += w*r; dacc += w*d; }
  float n = length(acc); acc/=n; dacc/=n;
  vec3 t = 2.0*(acc.w*dacc.xyz - dacc.w*acc.xyz + cross(acc.xyz, dacc.xyz));
  vec3 pw = qr(acc,p)+t; vec3 nw = qr(acc,aNrm);
  vec4 wp = uModel*vec4(pw,1.0); vW = wp.xyz; vN = mat3(uModel)*nw; vY = pw.y; vHW=aHW; vP = aPos;
  gl_Position = uVP*wp; }`;
  const FS = `#version 300 es
precision highp float; in vec3 vN; in vec3 vW; in float vY; in float vHW; in vec3 vP; out vec4 o;
uniform vec3 uLight, uAlbedo, uEye; uniform float uClipY, uAlpha; uniform int uMode;
void main(){
  if(uClipY>0.0 && vY<uClipY) discard;
  vec3 n = normalize(vN); if(!gl_FrontFacing) n=-n; if(uMode==2){ o=vec4(uAlbedo,1.0); return; }
  if(uMode==1){ // 4C coil hair: procedural curl normal + dark brown-black fibre colour
    vec3 q = vP*130.0; vec3 g = vec3(sin(q.x*1.7+sin(q.y*2.3)+cos(q.z*1.9)), sin(q.y*1.9+sin(q.z*2.1)+cos(q.x*2.7)), sin(q.z*1.5+sin(q.x*2.9)+cos(q.y*2.2)));
    n = normalize(n + 0.38*g); vec3 L=normalize(uLight); float d=clamp(dot(n,L)*0.5+0.5,0.0,1.0);
    vec3 hv=normalize(L+normalize(uEye-vW)); float sp=pow(clamp(dot(n,hv),0.0,1.0),18.0)*0.10;
    vec3 hc=uAlbedo*(0.35+0.9*d*d)+vec3(sp); o=vec4(pow(hc,vec3(1.0/2.2)),1.0); return; }
  vec3 v = normalize(uEye - vW); float nl = dot(n, normalize(uLight));
  float wrap = clamp((nl+0.45)/1.45, 0.0, 1.0);
  vec3 sss = vec3(0.34,0.11,0.07)*pow(1.0-clamp(nl,0.0,1.0),2.0)*0.5;
  float rim = pow(1.0-clamp(dot(n,v),0.0,1.0), 3.0);
  vec3 h = normalize(normalize(uLight)+v); float sp = pow(clamp(dot(n,h),0.0,1.0), 38.0)*0.22;
  vec3 c = uAlbedo*(0.22 + 0.95*wrap) + sss*uAlbedo*3.0 + vec3(0.9,0.85,0.8)*sp + rim*vec3(0.10,0.09,0.09);
  o = vec4(pow(c, vec3(1.0/2.2)), uAlpha); }`;
  const LVS = `#version 300 es
layout(location=0) in vec3 aP; uniform mat4 uVP; uniform float uPt; void main(){ gl_Position=uVP*vec4(aP,1.0); gl_PointSize=uPt; }`;
  const LFS = `#version 300 es
precision mediump float; uniform vec4 uC; out vec4 o; void main(){ o=uC; }`;
  function prog(gl, vs, fs) {
    const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); return sh; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p;
  }
  const SKIN = { child7: [.135, .098, .082], adult_f: [.115, .085, .074], adult_m: [.105, .08, .07], elder: [.125, .095, .082] };
  class GLFigure extends Figure {
    constructor(gl, shared, key, asset) {
      super(key, asset); this.gl = gl; this.sh = shared; const d = this.data;
      this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
      const buf = (arr, loc, size, type, norm, integer) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc);
        if (integer) gl.vertexAttribIPointer(loc, size, type, 0, 0); else gl.vertexAttribPointer(loc, size, type, norm, 0, 0); };
      buf(d.pos, 0, 3, gl.FLOAT, false); buf(d.nrm, 1, 3, gl.SHORT, true); buf(d.joints, 2, 4, gl.UNSIGNED_BYTE, false, true);
      buf(d.weights, 3, 4, gl.UNSIGNED_BYTE, true); buf(d.headw, 4, 1, gl.UNSIGNED_BYTE, true);
      this.ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.idx, gl.STATIC_DRAW);
      // unique edge list for wireframe
      const seen = new Set(), e = []; for (let t = 0; t < d.idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = d.idx[t+k], b = d.idx[t+(k+1)%3], lo = Math.min(a, b), hi = Math.max(a, b), key2 = lo * 65536 + hi; if (!seen.has(key2)) { seen.add(key2); e.push(lo, hi); } }
      this.edges = new Uint16Array(e); this.eb = gl.createBuffer(); this.nTris = d.idx.length; this.nEdges = e.length;
      gl.bindVertexArray(null);
      this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.nb * 2, 1, 0, gl.RGBA, gl.FLOAT, this.dq);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (d.h_pos) { this.hvao = gl.createVertexArray(); gl.bindVertexArray(this.hvao);
        buf(d.h_pos, 0, 3, gl.FLOAT, false); buf(d.h_nrm, 1, 3, gl.SHORT, true); buf(d.h_joints, 2, 4, gl.UNSIGNED_BYTE, false, true); buf(d.h_weights, 3, 4, gl.UNSIGNED_BYTE, true); buf(d.h_headw, 4, 1, gl.UNSIGNED_BYTE, true);
        this.hib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.hib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.h_idx, gl.STATIC_DRAW); this.hN = d.h_idx.length; gl.bindVertexArray(null); }
      this.lbuf = gl.createBuffer(); this.albedo = SKIN[key] || SKIN.adult_m; this._v = -1;
    }
    /** opts: viewProj, model (Float32Array 16), light, eye, mode 'solid'|'wire'|'xray', clipY (bust cut, metres in figure space, 0=off), alpha */
    draw(o) {
      const gl = this.gl, S = this.sh, mode = o.mode || 'solid';
      if (this._v !== this.version) { gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.nb * 2, 1, gl.RGBA, gl.FLOAT, this.dq); this._v = this.version; }
      const mm = o.model, sc = this.scale, M = new Float32Array(mm); for (let i = 0; i < 12; i++) if (i % 4 !== 3) M[i] = mm[i] * sc; // uniform allometric scale
      gl.useProgram(S.p); gl.uniformMatrix4fv(S.u.uVP, false, o.viewProj); gl.uniformMatrix4fv(S.u.uModel, false, M);
      gl.uniform1f(S.u.uHeadK, this.headK); gl.uniform3fv(S.u.uPivot, this.pivot); gl.uniform3fv(S.u.uLight, o.light || [.4, .8, .6]);
      gl.uniform3fv(S.u.uEye, o.eye || [0, 1, 4]); gl.uniform1f(S.u.uClipY, o.clipY || 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(S.u.uBones, 0);
      gl.bindVertexArray(this.vao);
      if (mode === 'wire') { gl.uniform3fv(S.u.uAlbedo, [.78, .86, .9]); gl.uniform1i(S.u.uMode, 2); gl.uniform1f(S.u.uAlpha, 1);
        if (!this._eboUp) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.edges, gl.STATIC_DRAW); this._eboUp = 1; }
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eb); gl.drawElements(gl.LINES, this.nEdges, gl.UNSIGNED_SHORT, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib);
      } else {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ib); gl.uniform3fv(S.u.uAlbedo, this.albedo); gl.uniform1i(S.u.uMode, 0);
        if (mode === 'xray') { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.uniform1f(S.u.uAlpha, .22); } else gl.uniform1f(S.u.uAlpha, 1);
        gl.drawElements(gl.TRIANGLES, this.nTris, gl.UNSIGNED_SHORT, 0);
        if (this.hvao && o.hair !== false && mode !== 'xray') { gl.bindVertexArray(this.hvao); gl.uniform3fv(S.u.uAlbedo, [.075, .06, .052]); gl.uniform1i(S.u.uMode, 1); gl.drawElements(gl.TRIANGLES, this.hN, gl.UNSIGNED_SHORT, 0); }
        if (mode === 'xray') { gl.depthMask(true); gl.disable(gl.BLEND); this._drawBones(o.viewProj, M); }
      }
      gl.bindVertexArray(null);
    }
    _drawBones(VP, M) {
      const gl = this.gl, S = this.sh, ph = this.posedHeads(), pts = [], segs = [];
      const tr = p => { const x = p[0], y = p[1], z = p[2]; return [M[0]*x + M[4]*y + M[8]*z + M[12], M[1]*x + M[5]*y + M[9]*z + M[13], M[2]*x + M[6]*y + M[10]*z + M[14]]; };
      for (let i = 0; i < this.nb; i++) { const a = tr(ph[i]); pts.push(...a); if (this.par[i] >= 0) segs.push(...tr(ph[this.par[i]]), ...a); }
      gl.bindVertexArray(null); gl.disable(gl.DEPTH_TEST); gl.useProgram(S.lp); gl.uniformMatrix4fv(S.lu.uVP, false, VP);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lbuf); gl.enableVertexAttribArray(0);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(segs), gl.DYNAMIC_DRAW); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.uniform4f(S.lu.uC, 1, .72, .2, 1); gl.uniform1f(S.lu.uPt, 1); gl.drawArrays(gl.LINES, 0, segs.length / 3);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.DYNAMIC_DRAW); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.uniform4f(S.lu.uC, .3, .95, 1, 1); gl.uniform1f(S.lu.uPt, 4); gl.drawArrays(gl.POINTS, 0, pts.length / 3);
      gl.disableVertexAttribArray(0); gl.enable(gl.DEPTH_TEST);
    }
  }
  function create(gl, assets) {
    assets = assets || (typeof window !== 'undefined' ? window.HUMAN_FORGE_ASSETS : null);
    if (!assets) throw new Error('HUMAN_FORGE_ASSETS missing: load human-forge/assets/human-assets.js first');
    const sh = { p: prog(gl, VS, FS), lp: prog(gl, LVS, LFS), u: {}, lu: {} };
    for (const n of ['uVP', 'uModel', 'uBones', 'uHeadK', 'uPivot', 'uLight', 'uAlbedo', 'uEye', 'uClipY', 'uAlpha', 'uMode']) sh.u[n] = gl.getUniformLocation(sh.p, n);
    for (const n of ['uVP', 'uC', 'uPt']) sh.lu[n] = gl.getUniformLocation(sh.lp, n);
    return { gl, assets, figures: {}, addFigure(key) { if (!assets[key]) throw new Error('no asset ' + key); return this.figures[key] = new GLFigure(gl, sh, key, assets[key]); } };
  }
  function createCPU(key, assets) { return new Figure(key, assets[key]); }
  return { create, createCPU, Figure, math: { qmul, qaxis, qrot, qconj, qfromTo, cross, sub, add, len } };
});
