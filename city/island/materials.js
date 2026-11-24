// WYGWYL's own liquids (material@1): the city's procedural textures, its harbour water shader and its building, road and ground
// materials, shared by the level page (island.js) and the jerry can (wygwyl-can.js) so both draw the same city.
(() => {
  function make(THREE, host = {}) {   // host.maxAnisotropy: the host renderer's, since a can owns no renderer
    const MAXANISO = host.maxAnisotropy || 8;
// ---------------------------------------------------------------------------
function createWetIslandGroundTextures() {
  const size = 1024;
  const diffC = document.createElement('canvas');
  diffC.width = diffC.height = size;
  const ctx = diffC.getContext('2d');

  ctx.fillStyle = '#3b424c';
  ctx.fillRect(0, 0, size, size);

  // Granite & basalt block courses
  const step = 32;
  for (let y = 0; y < size; y += step) {
    const rowOff = ((y / step) % 2) * (step * 0.5);
    for (let x = -step; x < size + step; x += step) {
      const v = 50 + Math.floor(Math.random() * 24);
      const warm = Math.random() < 0.25 ? 6 : 0;
      ctx.fillStyle = `rgb(${v + warm},${v + 2},${v + 7})`;
      ctx.fillRect(x + rowOff + 1, y + 1, step - 2, step - 2);
    }
  }
  // Fine mineral grain
  for (let i = 0; i < 14000; i++) {
    const gx = Math.random() * size;
    const gy = Math.random() * size;
    const gv = 36 + Math.floor(Math.random() * 38);
    ctx.fillStyle = `rgba(${gv},${gv + 3},${gv + 8},0.35)`;
    ctx.fillRect(gx, gy, 2, 2);
  }
  // Wet sheen streaks
  const gradOverlay = ctx.createLinearGradient(0, 0, size, size);
  gradOverlay.addColorStop(0, 'rgba(18, 36, 58, 0.16)');
  gradOverlay.addColorStop(0.5, 'rgba(203, 177, 130, 0.08)');
  gradOverlay.addColorStop(1, 'rgba(24, 180, 255, 0.10)');
  ctx.fillStyle = gradOverlay;
  ctx.fillRect(0, 0, size, size);

  // Wet puddle roughness map (dark = mirror puddle 0.06, light = damp stone 0.78)
  const roughC = document.createElement('canvas');
  roughC.width = roughC.height = size;
  const rctx = roughC.getContext('2d');
  rctx.fillStyle = '#bcbcbc';
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 42; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    const rad = 36 + Math.random() * 96;
    const rg = rctx.createRadialGradient(px, py, 4, px, py, rad);
    rg.addColorStop(0, 'rgba(14, 14, 16, 0.96)');
    rg.addColorStop(0.62, 'rgba(42, 42, 46, 0.68)');
    rg.addColorStop(1, 'rgba(188, 188, 188, 0)');
    rctx.fillStyle = rg;
    rctx.beginPath();
    rctx.arc(px, py, rad, 0, Math.PI * 2);
    rctx.fill();
  }

  const map = new THREE.CanvasTexture(diffC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(320, 220);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, MAXANISO);

  const roughnessMap = new THREE.CanvasTexture(roughC);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(320, 220);

  return { map, roughnessMap };
}

function createMasonryFacadeTextures() {
  const w = 512;
  const h = 512;
  const colC = document.createElement('canvas');
  colC.width = w;
  colC.height = h;
  const ctx = colC.getContext('2d');

  const emisC = document.createElement('canvas');
  emisC.width = w;
  emisC.height = h;
  const ectx = emisC.getContext('2d');
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);

  // Warm terracotta/limestone brick courses
  ctx.fillStyle = '#9c8876';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) {
    const off = ((y / 8) % 2) * 12;
    for (let x = -12; x < w + 12; x += 24) {
      const shade = 132 + Math.floor(Math.random() * 34);
      ctx.fillStyle = `rgb(${shade + 10},${shade - 2},${shade - 12})`;
      ctx.fillRect(x + off + 1, y + 1, 22, 6);
    }
  }

  // Cornice bands & recessed architectural windows (8 cols x 8 floors)
  const cols = 8;
  const rows = 8;
  const cw = w / cols;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = r * rh;
    // Stone belt course
    ctx.fillStyle = 'rgba(226, 216, 198, 0.55)';
    ctx.fillRect(0, y0, w, 4);
    ctx.fillStyle = 'rgba(24, 28, 36, 0.35)';
    ctx.fillRect(0, y0 + 4, w, 2);

    for (let c = 0; c < cols; c++) {
      const x0 = c * cw;
      const wx = x0 + 13;
      const wy = y0 + 12;
      const ww = cw - 26;
      const wh = rh - 20;

      // Stone lintel & sill
      ctx.fillStyle = '#dfd5c5';
      ctx.fillRect(wx - 3, wy - 4, ww + 6, 4);
      ctx.fillRect(wx - 2, wy + wh, ww + 4, 3);

      // Dark cobalt window pane
      const isLit = ((r * 13 + c * 7) % 11) < 4;
      const isCyan = ((r * 17 + c * 5) % 29) === 0;
      ctx.fillStyle = isLit ? (isCyan ? '#38b8e8' : '#f4b976') : '#152233';
      ctx.fillRect(wx, wy, ww, wh);

      // Mullions
      ctx.fillStyle = '#2d3540';
      ctx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
      ctx.fillRect(wx, wy + wh * 0.48, ww, 2);

      if (isLit) {
        ectx.fillStyle = isCyan ? '#18b4ff' : (r % 2 === 0 ? '#ffad5c' : '#ffd89c');
        ectx.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
      }
    }
  }

  const map = new THREE.CanvasTexture(colC);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, MAXANISO);

  const emissiveMap = new THREE.CanvasTexture(emisC);
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.colorSpace = THREE.SRGBColorSpace;

  return { map, emissiveMap };
}

function createRoadAsphaltTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  // Raised granite curb edges on left & right (0..18 and 238..256)
  ctx.fillStyle = '#212730';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = 20 + Math.random() * 216;
    const y = Math.random() * 256;
    const v = 26 + Math.floor(Math.random() * 22);
    ctx.fillStyle = `rgb(${v},${v + 3},${v + 8})`;
    ctx.fillRect(x, y, 2, 3);
  }
  // Granite stone curbs + drainage gutter
  ctx.fillStyle = '#b4aca0';
  ctx.fillRect(0, 0, 18, 256);
  ctx.fillRect(238, 0, 18, 256);
  ctx.fillStyle = '#12171e';
  ctx.fillRect(18, 0, 5, 256);
  ctx.fillRect(233, 0, 5, 256);
  for (let y = 0; y < 256; y += 32) {
    ctx.fillStyle = 'rgba(30,28,26,0.45)';
    ctx.fillRect(0, y, 18, 2);
    ctx.fillRect(238, y, 18, 2);
  }
  // Dashed brass/ochre centerline
  ctx.fillStyle = 'rgba(232, 182, 96, 0.72)';
  for (let y = 12; y < 256; y += 64) {
    ctx.fillRect(125, y, 6, 34);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, MAXANISO);
  return tex;
}




    const groundTex = createWetIslandGroundTextures(), masonryTex = createMasonryFacadeTextures(), roadTex = createRoadAsphaltTexture();
    const harborWaterMaterial = (waterUniforms) => new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        wp.y += sin(wp.x * 0.045 + uTime * 1.4) * 0.08 + cos(wp.z * 0.052 - uTime * 1.1) * 0.08;
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uCyan;
      uniform vec3 uSunCol;
      varying vec3 vWorldPos;
      void main() {
        vec2 p = vWorldPos.xz;
        float w1 = sin(p.x * 0.18 + uTime * 1.9 + sin(p.y * 0.09)) * 0.5 + 0.5;
        float w2 = cos(p.y * 0.22 - uTime * 1.5 + cos(p.x * 0.11)) * 0.5 + 0.5;
        vec3 n = normalize(vec3((w1 - 0.5) * 0.26, 1.0, (w2 - 0.5) * 0.26));
        vec3 v = normalize(cameraPosition - vWorldPos);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.2);
        vec3 base = mix(uDeep, uShallow, clamp(w1 * 0.55 + fres * 0.45, 0.0, 1.0));
        vec3 refl = reflect(-normalize(uSunDir), n);
        float spec = pow(max(dot(v, refl), 0.0), 64.0);
        float cyanGlint = smoothstep(0.84, 0.99, w1 * w2);
        vec3 col = base + uSunCol * spec * 0.85 + uCyan * cyanGlint * 0.38 + vec3(0.14, 0.30, 0.52) * fres * 0.55;
        gl_FragColor = vec4(col, 0.93);
      }
    `,
  });
    const wallMaterial = () => new THREE.MeshStandardMaterial({ map: masonryTex.map, emissiveMap: masonryTex.emissiveMap, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.72, vertexColors: true, roughness: 0.76, metalness: 0.08 });
    const roofMaterial = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.1 });
    const roadMaterial = () => new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.22, metalness: 0.18, polygonOffset: true, polygonOffsetFactor: -2 });
    const groundMaterial = () => new THREE.MeshStandardMaterial({ map: groundTex.map, roughnessMap: groundTex.roughnessMap, vertexColors: true, roughness: 0.72, metalness: 0.16 });
    return { groundTex, masonryTex, roadTex, harborWaterMaterial, wallMaterial, roofMaterial, roadMaterial, groundMaterial };
  }
  window.WygwylMaterials = { make };
})();
