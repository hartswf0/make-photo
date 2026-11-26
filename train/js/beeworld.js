// What it is to be a bee here. Three things the traveler never has:
// an eye made of facets that cannot see red and can see ultraviolet; a layer of the world drawn only in that ultraviolet
// (nectar guides on the flowers, where the sweet tins are hidden, the place on a neck, the trail home, and what the bees wrote on the walls);
// and a body that is a swarm.
import * as THREE from 'three';
import { DIM } from './kit.js';

export const UV = 1;   // the layer only the bee's camera draws
const { L, HW } = DIM;

export function createBeeWorld({ scene, renderer, cars, props, people, hero }) {
  // ---- the eye: the frame is drawn small, then seen through hexagonal facets with a bee's colours
  const rt = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true }), fxScene = new THREE.Scene(), fxCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: rt.texture }, aspect: { value: 1 }, cells: { value: 70 }, time: { value: 0 }, pulse: { value: 0 } }, depthTest: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `uniform sampler2D map; uniform float aspect, cells, time, pulse; varying vec2 vUv;
vec4 hexCell(vec2 p){ vec2 r=vec2(1.,1.7320508), h=r*.5; vec2 a=mod(p,r)-h, b=mod(p-h,r)-h; vec2 g=dot(a,a)<dot(b,b)?a:b; return vec4(g, p-g); }
void main(){
  vec2 c=vUv-.5; float r2=dot(c,c); c*=1.+r2*.55;                                   // the wide eye bends the edges
  vec2 p=vec2(c.x*aspect,c.y)*cells; vec4 hc=hexCell(p); vec2 uv=vec2(hc.z/aspect,hc.w)/cells+.5;
  vec3 s=texture2D(map,clamp(uv,0.,1.)).rgb;
  float uvl=max(0.,min(s.r,s.b)-s.g*1.15);                                          // what was drawn in ultraviolet arrives as pure magenta
  float lum=dot(s,vec3(.12,.5,.38)); vec3 bee=vec3(s.b*.55+s.g*.2+lum*.25, s.g*.8+s.b*.1+lum*.25, s.b*1.2+s.g*.1+lum*.3);                 // no red receptor: red things go dark, blue and green carry everything
  bee=mix(bee, vec3(.92,.5,1.)*(1.2+.5*sin(time*5.)), clamp(uvl*2.4,0.,1.));        // and ultraviolet shows as the colour only bees have
  float edge=length(hc.xy); bee*=mix(1.,.62,smoothstep(.36,.5,edge));               // each facet has a rim
  bee*=1.-r2*1.1; bee+=vec3(.9,.6,1.)*pulse*.35;
  gl_FragColor=vec4(bee*1.7,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}` });
  fxScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  function render(draw, camera, t, pulse) { const w = Math.max(2, Math.floor(innerWidth * .6)), h = Math.max(2, Math.floor(innerHeight * .6)); if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    mat.uniforms.aspect.value = w / h; mat.uniforms.cells.value = innerHeight > innerWidth ? 46 : 64; mat.uniforms.time.value = t; mat.uniforms.pulse.value = pulse;
    renderer.setRenderTarget(rt); draw(); renderer.setRenderTarget(null); renderer.render(fxScene, fxCam); }

  // ---- the ultraviolet layer
  const mag = 0xff33ff, uvMat = (o = {}) => new THREE.MeshBasicMaterial({ color: mag, transparent: true, depthWrite: false, fog: false, ...o });
  const put = o => { o.layers.set(UV); o.traverse(c => c.layers.set(UV)); return o; };
  const ringTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const q = c.getContext('2d'); q.strokeStyle = '#fff'; for (const [r, w] of [[54, 8], [34, 6], [14, 10]]) { q.lineWidth = w; q.beginPath(); q.arc(64, 64, r, 0, 7); q.stroke(); } return new THREE.CanvasTexture(c); })();
  const rings = [];   // a bullseye wherever there is something sweet: every prop that still hides tins
  for (const pr of props) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: mag, transparent: true, depthWrite: false, depthTest: false, fog: false })); s.position.set(cars[pr.car].x + pr.at[0], DIM.FLOOR + pr.at[1] + .25, pr.at[2]); s.scale.setScalar(.9); scene.add(put(s)); rings.push({ s, pr }); }
  const marks = [];   // on every person, the place
  const addMark = p => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: mag, transparent: true, depthWrite: false, depthTest: false, fog: false })); s.scale.setScalar(.34); s.position.y = 1.5; p.root.add(put(s)); marks.push({ s, p }); };
  // nectar guides: the greenhouse's flowers have been signalling all along
  { const c = cars[3]; for (let k = 0; k < 26; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: mag, transparent: true, depthWrite: false, fog: false })); s.scale.setScalar(.22 + (k % 3) * .08); s.position.set(c.x - L / 2 + 1.4 + (k * 37 % 100) / 100 * (L - 2.8), DIM.FLOOR + .7 + (k * 13 % 10) * .08, (k % 2 ? 1 : -1) * (.75 + (k * 7 % 10) * .05)); scene.add(put(s)); } }
  // the trail home: scent laid along the aisle to the queen
  { const pts = []; for (let x = cars[1].x + L / 2; x > cars[8].x - L / 2 + 2; x -= .8) pts.push(new THREE.Vector3(x, DIM.FLOOR + .45 + Math.sin(x * .7) * .12, Math.sin(x * .31) * .22)); const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: mag, fog: false })); scene.add(put(line));
    for (let k = 0; k < pts.length; k += 5) { const a = new THREE.Mesh(new THREE.ConeGeometry(.07, .22, 3), uvMat()); a.position.copy(pts[k]); a.rotation.z = Math.PI / 2; scene.add(put(a)); } }
  // what the bees wrote, one line to a carriage
  const LINES = [null, 'nobody here has looked up yet', 'sugar on table four', 'the flowers are open. they were always open', 'these were our houses', 'the glass remembers a field', 'they watch as we do, with many small eyes', 'the light is a flower that never lands', 'home. half for them'];
  LINES.forEach((text, i) => { if (!text) return; const c = document.createElement('canvas'); c.width = 1024; c.height = 96; const q = c.getContext('2d'); q.fillStyle = '#fff'; q.font = 'italic 54px Georgia, serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(text, 512, 50, 1000);
    for (const sd of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(7.5, .7), uvMat({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide })); m.position.set(cars[i].x, DIM.FLOOR + 2.28, sd * (HW - .14)); m.rotation.y = sd > 0 ? Math.PI : 0; scene.add(put(m)); } });
  function update(t) { for (const r of rings) { r.s.visible = r.pr.loot === undefined || r.pr.loot > 0; r.s.scale.setScalar(.8 + Math.sin(t * 3 + r.pr.at[0]) * .12); } for (const m of marks) m.s.material.opacity = .6 + Math.sin(t * 6) * .4; }
  return { render, update, addMark, rt };
}
