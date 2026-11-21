import * as THREE from 'three';

export const CITY_LOOKS = [
  { id: 'natural', mode: -1, name: 'Natural + Cyan', desc: 'True PBR masonry, wet sodium reflections, and live cyan network.' },
  { id: 'jerikan', mode: 13, name: 'Cyan Jerikan', desc: 'Silver-gelatin stone with selective electric-cyan water, relays, and conduits.' },
  { id: 'silver', mode: 5, name: 'Silver Gelatin', desc: 'Z-V selenium-toned 8x10 silver print.' },
  { id: 'cyanotype', mode: 9, name: 'Cyanotype', desc: 'Z-IX brushed Prussian blue blueprint on archival paper.' },
  { id: 'woodblock', mode: 4, name: 'Woodblock', desc: 'Z-IV carved indigo, slate, cream, and rust woodcut with grain.' },
  { id: 'inkwash', mode: 12, name: 'Ink Wash', desc: 'Sumi-e ink dilutions on fibrous paper with red stone seal.' },
  { id: 'watercolour', mode: 8, name: 'Watercolour', desc: 'Z-VIII pencil underdrawing washed with translucent pigment.' },
  { id: 'risograph', mode: 11, name: 'Risograph', desc: 'Misregistered pink, yellow, and cobalt halftone drums on cream.' },
  { id: 'card', mode: 6, name: 'The Card', desc: 'Z-VI cream archival stock cross-hatched and engraved by light.' },
  { id: 'silhouette', mode: 3, name: 'Silhouette', desc: 'Z-III warm tissue paper, crisp ink shadows, and vermilion highlights.' },
  { id: 'glass', mode: 10, name: 'Glass X-Ray', desc: 'Z-X contour refraction with glowing depth rings.' },
  { id: 'cave', mode: 2, name: 'Warm Cave', desc: 'Z-II thermal heat vision blended with crisp stone relief.' },
  { id: 'set', mode: 1, name: 'The Set', desc: 'Z-I 320-line phosphor monitor with slow sync sweep.' },
  { id: 'embers', mode: 0, name: 'Light Alone', desc: 'Z-0 darkness pierced by drifting embers.' },
  { id: 'spray', mode: 7, name: 'Spray Wall', desc: 'Z-VII celluloid mural wall with white edge halo and drips.' },
];

export const DISTRICT_PALETTE_LOOKS = [
  { id: 'dist_nightlife', mode: 14, name: 'District: Nightlife', colors: ['#1f1f25', '#75333e', '#29566e', '#6184ab', '#cf6a83', '#b1cbd8'], desc: 'wygwyl language/palettes.json — Nightlife rose-cobalt nocturnal tone.' },
  { id: 'dist_industrial', mode: 14, name: 'District: Industrial', colors: ['#231d1b', '#43403c', '#696765', '#ac8e82', '#a7b5b6', '#dbe1dc'], desc: 'wygwyl language/palettes.json — Industrial iron, rust, and limestone haze.' },
  { id: 'dist_waterfront', mode: 14, name: 'District: Waterfront', colors: ['#221f1f', '#474344', '#6c6a6b', '#959495', '#bcbfbe', '#dbdbdd'], desc: 'wygwyl language/palettes.json — Waterfront silver-fog harbor tones.' },
  { id: 'dist_downtown', mode: 14, name: 'District: Downtown', colors: ['#1c1d21', '#3b3f4a', '#636c7a', '#8f98a6', '#c2b9a7', '#e6dfd3'], desc: 'wygwyl language/palettes.json — Downtown slate canyon and warm stone.' },
  { id: 'dist_ruin', mode: 14, name: 'District: Ruin Field', colors: ['#211e1a', '#4a4136', '#756856', '#a3967f', '#c7bea9', '#e8e2d5'], desc: 'wygwyl language/palettes.json — Ruin Field weathered ceramic and salt ochre.' },
  { id: 'dist_oldtown', mode: 14, name: 'District: Old Town', colors: ['#241b17', '#543b2e', '#82614b', '#b08b6d', '#d1b79b', '#ede1cf'], desc: 'wygwyl language/palettes.json — Old Town warm brick and sodium timber.' },
  { id: 'dist_rowhouses', mode: 14, name: 'District: Rowhouses', colors: ['#211c1c', '#573634', '#855851', '#ad8378', '#cfb3a7', '#ece0d8'], desc: 'wygwyl language/palettes.json — Rowhouses Baltimere terracotta and stoop brick.' },
];

export const ALL_CITY_LOOKS = [...CITY_LOOKS, ...DISTRICT_PALETTE_LOOKS];

const VS = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FS = `
  uniform sampler2D tScene;
  uniform sampler2D tDepth;
  uniform vec2 uRes;
  uniform float uT;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocusDist;
  uniform float uDofAmount;
  uniform float uEv;
  uniform int uMode;
  uniform vec3 uPal[6];
  varying vec2 vUv;

  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lum(vec3 c) { return clamp(dot(c, vec3(0.30, 0.59, 0.11)), 0.0, 1.0); }
  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(h(i), h(i + vec2(1.0, 0.0)), f.x),
      mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float readDist(vec2 uv) {
    float zb = texture2D(tDepth, uv).x;
    return (uNear * uFar) / max(0.0001, uFar - zb * (uFar - uNear));
  }
  float drip(vec2 uv) {
    float cx = floor(uv.x * uRes.x / 6.0);
    if (h(vec2(cx, 7.0)) < 0.80) return 0.0;
    float len = 0.04 + 0.16 * h(vec2(cx, 3.0)), m = 0.0;
    for (int k = 1; k <= 5; k++) {
      float lk = lum(texture2D(tScene, vec2(uv.x, min(1.0, uv.y + len * float(k) / 5.0))).rgb);
      m = max(m, step(0.58, lk));
    }
    return m;
  }

  vec3 sampleWithDof(vec2 uv, float blurPx) {
    if (blurPx < 0.35) return texture2D(tScene, uv).rgb;
    vec2 e = blurPx / uRes;
    vec3 acc = texture2D(tScene, uv).rgb * 0.28;
    acc += texture2D(tScene, uv + vec2(e.x, 0.0)).rgb * 0.12;
    acc += texture2D(tScene, uv - vec2(e.x, 0.0)).rgb * 0.12;
    acc += texture2D(tScene, uv + vec2(0.0, e.y)).rgb * 0.12;
    acc += texture2D(tScene, uv - vec2(0.0, e.y)).rgb * 0.12;
    acc += texture2D(tScene, uv + vec2(e.x, e.y) * 0.7).rgb * 0.06;
    acc += texture2D(tScene, uv + vec2(-e.x, e.y) * 0.7).rgb * 0.06;
    acc += texture2D(tScene, uv + vec2(e.x, -e.y) * 0.7).rgb * 0.06;
    acc += texture2D(tScene, uv + vec2(-e.x, -e.y) * 0.7).rgb * 0.06;
    return acc;
  }

  vec3 evalLook(int mode, vec2 uv, vec3 raw, vec3 silverBase, float l, float ed, float vg) {
    vec2 px = uv * uRes;
    vec3 col;
    if (mode == 0) {
      float spk = smoothstep(0.996, 1.0, h(floor(px / 2.6))) * (0.45 + 0.35 * sin(uT * 0.9 + px.x * 0.1));
      vec3 em = raw * smoothstep(0.14, 0.85, l);
      col = mix(silverBase * 0.44, em * vec3(1.18, 0.70, 0.34) + spk * vec3(1.0, 0.75, 0.4), 0.74);
    } else if (mode == 1) {
      float rows = 320.0;
      vec2 g = vec2(uv.x, (floor(uv.y * rows) + 0.5) / rows);
      float ls = lum(texture2D(tScene, clamp(g, 0.0, 1.0)).rgb * exp2(uEv));
      float line = 0.86 + 0.14 * sin(uv.y * rows * 6.2832);
      float sweep = smoothstep(0.05, 0.0, abs(fract(uv.y - uT * 0.04) - 0.5) - 0.45) * 0.06;
      col = mix(silverBase * 0.42, vec3(0.76, 0.92, 1.0) * (pow(ls * 1.25 + 0.04, 0.85) * line + sweep) * vg, 0.76);
    } else if (mode == 2) {
      float th = pow(clamp(l * 1.15, 0.0, 1.0), 0.82);
      vec3 hm = th < 0.28 ? mix(vec3(0.08, 0.02, 0.14), vec3(0.45, 0.05, 0.48), th / 0.28)
              : th < 0.58 ? mix(vec3(0.45, 0.05, 0.48), vec3(0.92, 0.22, 0.08), (th - 0.28) / 0.30)
              : mix(vec3(0.92, 0.22, 0.08), vec3(1.0, 0.84, 0.30), (th - 0.58) / 0.42);
      col = mix(hm, silverBase * 0.95, 0.30);
    } else if (mode == 3) {
      vec3 tissue = vec3(0.95, 0.84, 0.64) * (0.78 + 0.22 * vg);
      float cut = 1.0 - smoothstep(0.16, 0.38, l);
      vec3 sil = mix(tissue, vec3(0.11, 0.09, 0.10), cut);
      sil = mix(sil, vec3(0.78, 0.14, 0.09), smoothstep(0.72, 0.90, l) * 0.68);
      col = mix(sil, silverBase, 0.30);
    } else if (mode == 4) {
      float grain = n2(vec2(px.x / 120.0, px.y / 2.4)) * 0.6 + n2(vec2(px.x / 26.0, px.y / 1.4)) * 0.4;
      vec3 indigo = vec3(0.14, 0.21, 0.32), slate = vec3(0.38, 0.48, 0.54), cream = vec3(0.90, 0.86, 0.75), rust = vec3(0.68, 0.35, 0.18);
      float lq = l + (grain - 0.5) * 0.06;
      vec3 wb = lq < 0.18 ? indigo : lq < 0.42 ? slate : lq < 0.74 ? cream : rust;
      if (lq >= 0.18 && lq < 0.42) wb = mix(wb, indigo, step(0.62, fract((px.x + px.y) / 7.0)) * 0.36);
      wb = mix(wb, indigo * 0.65, smoothstep(0.05, 0.15, ed));
      col = mix(wb * (0.92 + 0.10 * grain), silverBase, 0.28) * (0.90 + 0.10 * vg);
    } else if (mode == 5) {
      col = silverBase * (0.94 + 0.06 * vg);
    } else if (mode == 6) {
      vec2 gp = px / 5.2;
      float a = fract(gp.x + gp.y), b = fract(gp.x - gp.y);
      float ink = step(a, smoothstep(0.12, 0.80, 1.0 - l) * 0.82);
      ink = max(ink, step(b, smoothstep(0.45, 0.96, 1.0 - l) * 0.72));
      ink = max(ink, smoothstep(0.06, 0.18, ed));
      vec3 crd = mix(vec3(0.93, 0.90, 0.82) * (0.86 + 0.14 * vg), vec3(0.12, 0.11, 0.13), ink * 0.84);
      col = mix(crd, silverBase, 0.32);
    } else if (mode == 7) {
      float wn = n2(px / 95.0) * 0.6 + n2(px / 22.0) * 0.3 + h(floor(px / 2.0)) * 0.1;
      vec3 wall = vec3(0.54, 0.51, 0.47) * (0.68 + 0.42 * wn);
      float dr = drip(uv);
      float edgeHalo = smoothstep(0.04, 0.14, ed);
      vec3 paste = mix(silverBase.rgb, vec3(0.96, 0.94, 0.89), edgeHalo);
      col = mix(mix(wall, paste, smoothstep(0.22, 0.62, l + edgeHalo * 0.45)), vec3(0.14, 0.12, 0.11), dr * 0.28);
      col = mix(col, silverBase, 0.28);
    } else if (mode == 8) {
      float tooth = n2(px / 2.4) * 0.6 + n2(px / 6.5) * 0.4;
      vec3 paper = vec3(0.96, 0.94, 0.89) * (0.94 + 0.08 * tooth);
      vec3 wash = mix(vec3(0.42, 0.58, 0.74), vec3(0.86, 0.70, 0.52), l);
      vec3 wc = mix(paper, paper * wash, (0.35 + 0.55 * (1.0 - l)) * (0.65 + 0.4 * tooth));
      wc = mix(wc, vec3(0.26, 0.28, 0.32), smoothstep(0.04, 0.10, ed) * 0.55);
      col = mix(wc, silverBase, 0.30);
    } else if (mode == 9) {
      float brush = n2(vec2(px.x / 3.0, px.y / 140.0)) * 0.5 + n2(px / 55.0) * 0.5;
      vec2 q = abs(uv - 0.5) * 2.0;
      float coat = smoothstep(0.99, 0.92, max(q.x, q.y) + (n2(px / 24.0) - 0.5) * 0.06);
      float d = smoothstep(0.06, 0.92, silverBase.r + 0.06 * n2(px / 40.0));
      vec3 cyano = mix(vec3(0.06, 0.24, 0.58) * (0.85 + 0.25 * brush), vec3(0.94, 0.97, 1.0), d);
      col = mix(vec3(0.95, 0.94, 0.90), cyano, coat);
    } else if (mode == 10) {
      float distContour = smoothstep(0.88, 0.98, sin(readDist(uv) * 0.65));
      vec3 xcol = vec3(0.82, 0.93, 1.0) * (smoothstep(0.02, 0.12, ed) * 1.35 + distContour * 0.28);
      col = mix(silverBase * 0.48, xcol + raw * 0.38, 0.68);
    } else if (mode == 11) {
      vec3 rs = vec3(0.96, 0.93, 0.85);
      float g1 = length(fract(px / 5.5) - 0.5) * 1.5;
      float g2 = length(fract((mat2(0.966, 0.259, -0.259, 0.966) * px) / 5.5) - 0.5) * 1.5;
      float g3 = length(fract((mat2(0.707, 0.707, -0.707, 0.707) * px) / 5.5) - 0.5) * 1.5;
      rs *= mix(vec3(1.0), vec3(1.0, 0.34, 0.60), step(g1, smoothstep(0.15, 0.75, 1.0 - l) * 0.82));
      rs *= mix(vec3(1.0), vec3(1.0, 0.86, 0.12), step(g2, smoothstep(0.25, 0.85, l) * 0.72));
      rs *= mix(vec3(1.0), vec3(0.14, 0.34, 0.78), step(g3, smoothstep(0.1, 0.55, 1.0 - l) * 0.78));
      rs *= mix(vec3(1.0), vec3(0.10, 0.09, 0.12), smoothstep(0.04, 0.15, ed) * 0.82);
      col = mix(rs, silverBase, 0.30);
    } else if (mode == 12) {
      float fib = n2(vec2(px.x / 85.0, px.y / 2.2)) * 0.5 + n2(vec2(px.x / 3.0, px.y / 68.0)) * 0.5;
      vec3 paper = vec3(0.95, 0.93, 0.87) * (0.94 + 0.08 * fib);
      float dark = 1.0 - l;
      float ink = smoothstep(0.22, 0.44, dark) * 0.25 + smoothstep(0.48, 0.72, dark) * 0.30 + smoothstep(0.76, 0.95, dark) * 0.32;
      vec3 iw = paper * (1.0 - ink * (0.9 + 0.1 * fib));
      vec2 sq = (uv - vec2(0.90, 0.14)) * vec2(uRes.x / uRes.y, 1.0);
      float seal = step(max(abs(sq.x), abs(sq.y)), 0.032) * step(0.28, n2(px / 3.0));
      col = mix(mix(iw, vec3(0.72, 0.10, 0.08), seal), silverBase, 0.30);
    } else if (mode == 14) {
      // Mode 14: wygwyl language/palettes.json 6-color District Tone LUT + selective cyan
      float t = clamp(l, 0.0, 1.0) * 5.0;
      vec3 palCol = t < 1.0 ? mix(uPal[0], uPal[1], t)
                  : t < 2.0 ? mix(uPal[1], uPal[2], t - 1.0)
                  : t < 3.0 ? mix(uPal[2], uPal[3], t - 2.0)
                  : t < 4.0 ? mix(uPal[3], uPal[4], t - 3.0)
                  : mix(uPal[4], uPal[5], t - 4.0);
      // Architectural edge definition & subtle paper grain
      float grain = (h(floor(px) + fract(uT) * 50.0) - 0.5) * 0.04;
      palCol = mix(palCol + grain, uPal[0] * 0.72, smoothstep(0.05, 0.16, ed) * 0.45);
      // Preserve live semantic cyan water/signal network
      float cyanMask = smoothstep(0.09, 0.28, (raw.b + raw.g * 0.55) * 0.65 - raw.r) * smoothstep(0.15, 0.55, raw.b);
      vec3 electricCyan = mix(raw, vec3(0.14, 0.80, 1.0) * (0.78 + 0.45 * l), 0.50);
      col = mix(palCol * (0.92 + 0.08 * vg), electricCyan, clamp(cyanMask * 1.15, 0.0, 1.0));
    } else {
      // Mode 13: CYAN JERIKAN (Silver-gelatin stone + selective electric-cyan water/signal preservation)
      float cyanMask = smoothstep(0.09, 0.28, (raw.b + raw.g * 0.55) * 0.65 - raw.r) * smoothstep(0.15, 0.55, raw.b);
      vec3 electricCyan = mix(raw, vec3(0.12, 0.76, 1.0) * (0.75 + 0.55 * l), 0.52);
      col = mix(silverBase * (0.94 + 0.06 * vg), electricCyan, clamp(cyanMask * 1.25, 0.0, 1.0));
    }
    return col;
  }

  void main() {
    vec2 uv = vUv;
    vec2 e = 1.0 / uRes;
    float dist = readDist(uv);
    float coc = abs(log2(clamp(dist, uNear, uFar)) - log2(max(uFocusDist, 0.5)));
    float blurPx = clamp(coc * uDofAmount * 3.2, 0.0, 4.5);

    vec3 rawLin = sampleWithDof(uv, blurPx) * exp2(uEv);
    // Convert linear render-target RGB to perceptual sRGB for Zone shaders & display
    vec3 raw = pow(clamp(rawLin * 1.15, 0.0, 1.0), vec3(1.0 / 2.2));
    if (uMode < 0) {
      gl_FragColor = vec4(raw, 1.0);
      return;
    }

    float l = lum(raw);
    // Sobel-like luminance edge detection for Woodblock / Watercolour / Card / Glass / Risograph
    float lL = lum(pow(clamp(texture2D(tScene, uv - vec2(e.x, 0.0)).rgb * exp2(uEv) * 1.15, 0.0, 1.0), vec3(1.0 / 2.2)));
    float lR = lum(pow(clamp(texture2D(tScene, uv + vec2(e.x, 0.0)).rgb * exp2(uEv) * 1.15, 0.0, 1.0), vec3(1.0 / 2.2)));
    float lU = lum(pow(clamp(texture2D(tScene, uv + vec2(0.0, e.y)).rgb * exp2(uEv) * 1.15, 0.0, 1.0), vec3(1.0 / 2.2)));
    float lD = lum(pow(clamp(texture2D(tScene, uv - vec2(0.0, e.y)).rgb * exp2(uEv) * 1.15, 0.0, 1.0), vec3(1.0 / 2.2)));
    float ed = length(vec2(lR - lL, lU - lD));

    // Selenium-toned Silver Gelatin base + fine film grain
    float grain = (h(floor(uv * uRes) + fract(uT) * 100.0) - 0.5) * 0.032;
    float z = smoothstep(0.02, 0.96, pow(clamp(l + grain, 0.0, 1.0), 0.92));
    vec3 silverBase = mix(vec3(0.07, 0.065, 0.06), vec3(0.95, 0.935, 0.90), z);

    vec2 centered = uv - 0.5;
    float vg = clamp(1.0 - dot(centered, centered) * 0.72, 0.45, 1.0);

    vec3 outCol = evalLook(uMode, uv, raw, silverBase, l, ed, vg);
    gl_FragColor = vec4(clamp(outCol, 0.0, 1.0), 1.0);
  }
`;

export class CityShaderPipeline {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.UnsignedByteType,
    });
    this.rt.depthTexture = new THREE.DepthTexture(width, height);
    this.rt.depthTexture.type = THREE.UnsignedShortType;

    this.postScene = new THREE.Scene();
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: this.rt.texture },
        tDepth: { value: this.rt.depthTexture },
        uRes: { value: new THREE.Vector2(width, height) },
        uT: { value: 0 },
        uNear: { value: 0.12 },
        uFar: { value: 260 },
        uFocusDist: { value: 12.0 },
        uDofAmount: { value: 0.0 },
        uEv: { value: 0.0 },
        uMode: { value: -1 },
        uPal: {
          value: [
            new THREE.Color('#1f1f25'),
            new THREE.Color('#75333e'),
            new THREE.Color('#29566e'),
            new THREE.Color('#6184ab'),
            new THREE.Color('#cf6a83'),
            new THREE.Color('#b1cbd8'),
          ],
        },
      },
      vertexShader: VS,
      fragmentShader: FS,
      depthWrite: false,
      depthTest: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.postScene.add(quad);
  }

  setSize(width, height) {
    const pr = this.renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));
    this.rt.setSize(w, h);
    this.material.uniforms.uRes.value.set(w, h);
  }

  render(scene, camera, opts) {
    const u = this.material.uniforms;
    u.uT.value = opts.time;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocusDist.value = opts.focusM;
    u.uDofAmount.value = opts.dofAmount;
    u.uEv.value = opts.ev;
    u.uMode.value = opts.mode;
    if (opts.paletteColors && opts.paletteColors.length >= 6) {
      for (let i = 0; i < 6; i++) {
        u.uPal.value[i].set(opts.paletteColors[i]);
      }
    }

    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCam);
  }
}
