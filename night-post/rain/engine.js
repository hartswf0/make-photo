// Rain engine: fluid-glass, rain-field, weather-memory, trace-ink.
// Vendored unchanged from the Donkey Water rain-system tutorial. These modules own no game state;
// night-post/rain/surface.js feeds them from window.AhiyaBridge.
(() => {
'use strict';
const RainModules = window.RainModules = Object.create(null);
RainModules["./fluid-glass.js"] = (() => {
/**
 * Optical wet glass: compact, smoothly merged fields, not skinned DOM buttons.
 * All bodies, trails and pointer geometry use CSS PIXELS relative to the canvas.
 * Bodies: {id,x,y,rx,ry,viscosity,kind,opacity|alpha}.
 * Trails: flat {x,y,r,age?,kind?,frame?,opacity|alpha} nodes OR grouped
 *         {id,kind?,alpha?,nodes:[{x,y,r,alpha?,time?,frame?}]} paths.
 * Pointer: {x,y,dx,dy,active}; dx/dy are pixel displacement from the anchor.
 * image/video/position may be values or functions. position = {x:.57,y:.54}.
 * captureFrame() returns a stable numeric ID; expired history fades away.
 * setTimeOffset(seconds) freezes the atlas and reads its retained past. Explicit
 * body/trail frame IDs take precedence, so a semantic rewind is never applied
 * twice. setErosion(0..1) controls spatial thinning and breakup, not the clock.
 */
function createFluidGlass(canvas, options = {}) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const resolve = value => typeof value === 'function' ? value() : value;
  const warmKind = kind => /amber|honey|menu|gold|memory|voice|dialogue/.test(String(kind || '')) ? 1 : 0;
  const waterKind = kind => /water|resource|source|pour/.test(String(kind || '')) ? 1 : 0;
  const vaporKind = kind => /vapor|vapour|smoke|breath/.test(String(kind || ''));
  const now = () => performance.now();
  const frameCount = options.historyFrames === 48 ? 48 : 32;
  const atlasCols = 8, atlasRows = frameCount / atlasCols, cell = 96;
  const atlas = document.createElement('canvas');
  atlas.width = atlasCols * cell; atlas.height = atlasRows * cell;
  const atlasCtx = atlas.getContext('2d', { alpha: false });
  const history = new Array(frameCount).fill(-1);
  const historyVideo = new Array(frameCount).fill(false);
  const historyTime = new Array(frameCount).fill(-1);
  const frameOrigins = new Map(), historyPlayheads = new Map();
  let sequence = -1, lastCapture = -Infinity, atlasDirty = false;
  let captureOrigin = null, allowVideoFrames = false;
  let width = 1, height = 1, renderScale = 1, dead = false, raf = 0, lastTick = 0, lastPaint = 0, clock = 0;
  let reduced = options.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode = 'pane', intensity = .65, erosion = clamp(finite(options.erosion,.32),0,1), working = false;
  let timeOffset=0, scrubFrame=-1, scrubTime=0;
  let bodies = [], trails = [], emitted = [], pointer = { x: 0, y: 0, dx: 0, dy: 0, active: false };
  let pointerAlpha = 0, sourceKey = '', sourceReady = false, sourceWidth = 1, sourceHeight = 1;
  let primitives = [], retiredFrames = 0;
  let advancingTrailSamples = 0;
  let gl = null, ctx = null, fallbackCanvas = null, program = null, worldTexture = null, historyTexture = null, buffer = null;
  let maxFields = 80, locations = {}, packedA = null, packedB = null;
  let cpu = null;
  const modes = new Set(['rain','dew','pane','fall','worms','trails','breath','cause','lens']);
  const nodeFrames = new Map();
  canvas.style.pointerEvents = 'none'; canvas.setAttribute('aria-hidden', 'true');

  function source() {
    const image = resolve(options.image);
    const iw = image?.naturalWidth || image?.videoWidth || image?.width;
    const ih = image?.naturalHeight || image?.videoHeight || image?.height;
    return image && iw > 0 && ih > 0 && image.complete !== false ? { image, w: iw, h: ih } : null;
  }
  function film() {
    const video = resolve(options.video);
    return video && video.readyState >= 2 && video.videoWidth && video.videoHeight
      ? { image: video, w: video.videoWidth, h: video.videoHeight } : null;
  }
  function position() {
    const p = resolve(options.position) || { x: .57, y: .54 };
    return { x: clamp(finite(p.x, .57), 0, 1), y: clamp(finite(p.y, .54), 0, 1) };
  }
  function crop(s, targetW = width, targetH = height) {
    const fit = Math.max(targetW / s.w, targetH / s.h), p = position();
    return { sx: (s.w * fit - targetW) * p.x / fit, sy: (s.h * fit - targetH) * p.y / fit, sw: targetW / fit, sh: targetH / fit };
  }
  function captureFrame(force = false) {
    if (dead || !atlasCtx) return null;
    if (timeOffset>0) return sequence>=0?sequence:null;
    const time = now();
    const video = film(), s = video || source();
    if (!s) return null;
    if (!force && sequence >= 0 && s.image === captureOrigin && time - lastCapture < 250) return sequence;
    const next = sequence + 1, slot = next % frameCount;
    const c = crop(s), x = (slot % atlasCols) * cell, y = Math.floor(slot / atlasCols) * cell;
    try { atlasCtx.drawImage(s.image, c.sx, c.sy, c.sw, c.sh, x, y, cell, cell); }
    catch { return sequence >= 0 ? sequence : null; }
    sequence = next; history[slot] = sequence; historyVideo[slot] = Boolean(video); historyTime[slot]=time;
    frameOrigins.set(sequence,Boolean(video));
    if(frameOrigins.size>frameCount*4)frameOrigins.delete(frameOrigins.keys().next().value);
    captureOrigin = s.image; lastCapture = time; atlasDirty = true;
    return sequence;
  }
  function historySpan() {
    if(sequence<0)return 0;
    const newest=historyTime[(timeOffset>0?scrubFrame:sequence)%frameCount];
    let oldest=newest;
    for(let slot=0;slot<frameCount;slot++)if(history[slot]>=0&&historyTime[slot]<=newest)oldest=Math.min(oldest,historyTime[slot]);
    return Math.max(0,(newest-oldest)/1000);
  }
  function rewindFrame() {
    if(timeOffset<=0||scrubFrame<0)return -1;
    const target=scrubTime-timeOffset*1000;
    let picked=-1,distance=Infinity;
    for(let slot=0;slot<frameCount;slot++){
      const id=history[slot];
      if(id<0||id>scrubFrame||(historyVideo[slot]&&!allowVideoFrames))continue;
      const delta=Math.abs(historyTime[slot]-target);
      if(delta<distance){distance=delta;picked=id;}
    }
    return picked;
  }
  function frameSlot(id) {
    if (!Number.isInteger(id) || id < 0) return -1;
    const slot = id % frameCount;
    if (historyVideo[slot] && !allowVideoFrames) return -2;
    return history[slot] === id ? slot : -2;
  }
  function compile(type, text) {
    const shader = gl.createShader(type); gl.shaderSource(shader, text); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message || 'Fluid shader failed');
    }
    return shader;
  }
  function setupGL() {
    gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) return false;
    maxFields = clamp(Math.floor((gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) - 24) / 2), 24, 80);
    const vertex = `attribute vec2 a_position; varying vec2 v_uv; void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
    const fragment = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_view;
      uniform vec2 u_sourceSize;
      uniform vec2 u_position;
      uniform vec4 u_a[${maxFields}];
      uniform vec4 u_b[${maxFields}];
      uniform int u_count;
      uniform sampler2D u_world;
      uniform sampler2D u_history;
      uniform float u_hasSource;
      uniform float u_time;
      const float THRESHOLD=.125;
      vec2 worldUV(vec2 p){
        float fit=max(u_view.x/u_sourceSize.x,u_view.y/u_sourceSize.y);
        vec2 offset=(u_view-u_sourceSize*fit)*u_position;
        vec2 uv=(p-offset)/(u_sourceSize*fit);
        return vec2(clamp(uv.x,.001,.999),1.-clamp(uv.y,.001,.999));
      }
      vec3 liveColor(vec2 p){
        vec2 uv=worldUV(p);
        return mix(vec3(.18,.23,.24),texture2D(u_world,uv).rgb,u_hasSource);
      }
      vec3 frameColor(float slot,vec2 p){
        if(slot<-.5)return liveColor(p);
        vec2 uv=clamp(p/u_view,vec2(.004),vec2(.996));
        vec2 tile=vec2(mod(slot,8.),floor(slot/8.));
        vec2 at=(tile+uv)/vec2(8.,${atlasRows}.);
        return texture2D(u_history,vec2(at.x,1.-at.y)).rgb;
      }
      void main(){
        vec2 p=vec2(v_uv.x,1.-v_uv.y)*u_view;
        float field=0.; vec2 gradient=vec2(0.);
        float sizeMass=0.; float warmth=0.; float pigmentMass=0.; float vaporMass=0.; float dominant=0.;
        vec3 sampleTime=vec3(-1.,-1.,0.);
        for(int i=0;i<${maxFields};i++){
          if(i>=u_count)break;
          vec4 a=u_a[i]; vec4 b=u_b[i];
          vec2 delta; vec2 derivative; float radius; float q; float along=0.;
          if(b.x<0.){
            delta=p-a.xy;
            if(abs(delta.x)>a.z||abs(delta.y)>a.w*(1.+abs(b.y)))continue;
            // A wet sheet bends across its width. The analytic derivative
            // keeps the same shared light across the bent body and its neck.
            float u=delta.x/max(a.z,.5);
            float bend=b.y*a.w*(u*.64+(u*u-.25)*.46);
            float bendSlope=b.y*a.w*(.64+.92*u)/max(a.z,.5);
            delta.y-=bend;
            vec2 inv=1./max(a.zw*a.zw,vec2(.25));
            q=1.-dot(delta*delta,inv);
            if(q<=0.)continue;
            derivative=-2.*delta*inv;
            derivative.x+=2.*delta.y*inv.y*bendSlope;
            radius=sqrt(a.z*a.w)*.70710678;
          }else{
            vec2 ab=a.zw-a.xy;
            float rr=max(b.x,b.y)*1.41421356;
            if(p.x<min(a.x,a.z)-rr||p.x>max(a.x,a.z)+rr||p.y<min(a.y,a.w)-rr||p.y>max(a.y,a.w)+rr)continue;
            float length2=max(dot(ab,ab),.01);
            float raw=dot(p-a.xy,ab)/length2;
            along=clamp(raw,0.,1.);
            radius=mix(b.x,b.y,along);
            float support=max(.7,radius*1.41421356);
            delta=p-(a.xy+ab*along);
            float distance2=dot(delta,delta);
            q=1.-distance2/(support*support);
            if(q<=0.)continue;
            vec2 radiusGradient=(raw>0.&&raw<1.)?(b.y-b.x)*1.41421356*ab/length2:vec2(0.);
            derivative=-2.*delta/(support*support)+2.*distance2*radiusGradient/(support*support*support);
          }
          float contribution=q*q*q*b.w;
          field+=contribution;
          gradient+=3.*q*q*derivative*b.w;
          sizeMass+=radius*contribution;
          float packedFrames=floor(b.z+.00001);
          float warm=mod(floor(fract(b.z)*4.+.001),2.);
          warmth+=warm*contribution;
          pigmentMass+=mod(floor(fract(b.z)*8.+.001),2.)*contribution;
          vaporMass+=step(.49,fract(b.z))*contribution;
          if(contribution>dominant){
            dominant=contribution;
            sampleTime=vec3(mod(packedFrames,64.)-1.,floor(packedFrames/64.)-1.,along);
          }
        }
        if(field<THRESHOLD-.025)discard;
        float coverage=smoothstep(THRESHOLD-.025,THRESHOLD+.025,field);
        float radius=sizeMass/max(field,.001);
        float depth=sqrt(max(field-THRESHOLD,0.));
        vec2 slope=-gradient*max(3.,radius)*.46/sqrt(max(.045,field-THRESHOLD));
        vec3 normal=normalize(vec3(slope,.92));
        vec2 refracted=p-normal.xy*(3.+min(26.,radius*.48))*(.68+min(.72,depth));
        vec3 water=mix(frameColor(sampleTime.x,refracted),frameColor(sampleTime.y,refracted),sampleTime.z);
        // Transmission carries the palette. Shared light supplies selective glints.
        vec3 light=normalize(vec3(-.48,-.7,1.05));
        vec3 eye=vec3(0.,0.,1.);
        vec3 halfVector=normalize(light+eye);
        float highlight=pow(max(dot(normal,halfVector),0.),80.);
        float pinpoint=pow(max(dot(normal,halfVector),0.),240.);
        float fresnel=pow(1.-max(normal.z,0.),3.);
        float skyFacing=smoothstep(-.2,.85,dot(normal.xy,normalize(vec2(-.5,-.8))));
        float warm=clamp(warmth/max(field,.001),0.,1.);
        float pigment=clamp(pigmentMass/max(field,.001),0.,1.);
        float vapor=clamp(vaporMass/max(field,.001),0.,1.);
        water=mix(water,water*vec3(.72,1.015,1.06)+vec3(.008,.035,.043),pigment*.32*min(1.,depth+.2));
        vec3 lightColor=mix(vec3(.94,.98,1.),vec3(1.,.92,.75),warm*.45);
        vec3 reflection=mix(vec3(.34,.43,.47),vec3(.87,.92,.94),skyFacing);
        vec3 color=water*(1.-fresnel*.11)+reflection*fresnel*.26*(1.-vapor*.8);
        color+=lightColor*(highlight*.52+pinpoint*.65)*(1.-vapor*.93);
        float lowerCaustic=pow(max(dot(normal,normalize(vec3(.12,.92,.45))),0.),24.);
        color+=lightColor*lowerCaustic*.13*(1.-vapor*.93);
        color+=vec3(.055,.065,.067)*vapor;
        float edge=1.-smoothstep(THRESHOLD,THRESHOLD+.075,field);
        color*=1.-edge*.16*(1.-skyFacing);
        float alpha=coverage*(.62+.22*min(1.,depth))*(1.-vapor*.78);
        gl_FragColor=vec4(clamp(color,0.,1.35)*alpha,alpha);
      }`;
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Fluid shader link failed');
    gl.useProgram(program);
    buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const attr = gl.getAttribLocation(program, 'a_position'); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr, 2, gl.FLOAT, false, 0, 0);
    for (const name of ['u_view','u_sourceSize','u_position','u_count','u_world','u_history','u_hasSource','u_time']) locations[name] = gl.getUniformLocation(program,name);
    locations.u_a = gl.getUniformLocation(program,'u_a[0]'); locations.u_b = gl.getUniformLocation(program,'u_b[0]');
    function texture(unit) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([49,60,62,255]));
      return tex;
    }
    worldTexture = texture(0); historyTexture = texture(1);
    gl.uniform1i(locations.u_world,0); gl.uniform1i(locations.u_history,1);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.clearColor(0,0,0,0);
    packedA = new Float32Array(maxFields * 4); packedB = new Float32Array(maxFields * 4);
    return true;
  }
  try { setupGL(); } catch { gl = null; }
  if (!gl) {
    ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      // A failed shader may have claimed the original canvas; retain its layout
      // while placing a transparent fallback in the identical stacking position.
      fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.className = canvas.className;
      fallbackCanvas.style.cssText = canvas.style.cssText;
      Object.assign(fallbackCanvas.style, { position:'absolute', inset:'0', width:'100%', height:'100%', zIndex:window.getComputedStyle?.(canvas)?.zIndex || 'auto' });
      fallbackCanvas.style.pointerEvents = 'none'; fallbackCanvas.setAttribute('aria-hidden','true');
      canvas.insertAdjacentElement('afterend', fallbackCanvas);
      ctx = fallbackCanvas.getContext('2d', { alpha: true });
    }
  }

  function historicalFrame(node, pathId, index) {
    if (timeOffset>0) return Number.isInteger(node.frame)?node.frame:rewindFrame();
    if (mode !== 'worms') return -1;
    const key = `${pathId}:${node.time ?? index}:${Math.round(node.x)}:${Math.round(node.y)}`;
    let birth=Number.isInteger(node.frame)?node.frame:nodeFrames.get(key);
    if(birth===undefined){birth=captureFrame()??-1;if(birth>=0)nodeFrames.set(key,birth);}
    if (nodeFrames.size > 640) nodeFrames.delete(nodeFrames.keys().next().value);
    // Only actual archive footage advances. Ordinary world/semantic memories
    // keep their recorded frame; slow film paths retain their temporal lag.
    if(!allowVideoFrames||!frameOrigins.get(birth))return birth;
    const playbackKey=`${key}:${birth}`;
    if(reduced&&historyPlayheads.has(playbackKey))return historyPlayheads.get(playbackKey);
    const rate=clamp(finite(node.playRate,.45),.05,1);
    const wanted=Number.isInteger(node.playheadFrame)?node.playheadFrame:birth+Math.floor(Math.max(0,finite(node.age))*4*rate);
    const candidate=Math.max(birth,Math.min(sequence,wanted));
    const frame=frameOrigins.get(candidate)&&history[candidate%frameCount]===candidate?candidate:birth;
    if(frame!==birth)advancingTrailSamples++;
    historyPlayheads.set(playbackKey,frame);
    if(historyPlayheads.size>640)historyPlayheads.delete(historyPlayheads.keys().next().value);
    return frame;
  }
  function encodeFrames(a, b, warm, vapor = false, pigment = false) {
    let sa = frameSlot(a), sb = frameSlot(b);
    if (sa === -2 || sb === -2) { retiredFrames++; return null; }
    return (sa + 1) + (sb + 1) * 64 + warm * .25 + (vapor?.5:0) + (pigment?.125:0);
  }
  function ellipse(x,y,rx,ry,alpha,kind,frame = -1,warp=0) {
    if (rx <= .4 || ry <= .4 || alpha <= .008) return;
    const encoding = encodeFrames(frame, frame, warmKind(kind),vaporKind(kind),waterKind(kind)); if (encoding === null) return;
    warp=clamp(warp,-.85,.85);
    const ey=ry*1.45*(1+Math.abs(warp));
    primitives.push({ a:[x,y,rx*1.41421356,ry*1.41421356], b:[-1,warp,encoding,clamp(alpha,0,1)], x:x-rx*1.45,y:y-ey,w:rx*2.9,h:ey*2, kind });
  }
  function segment(a,b,alpha,kind,fa=-1,fb=-1) {
    if (alpha <= .008) return;
    const ra=Math.max(.6,a.r), rb=Math.max(.6,b.r), r=Math.max(ra,rb)*1.45;
    const encoding = encodeFrames(fa, fb, warmKind(kind),vaporKind(kind),waterKind(kind)); if (encoding === null) return;
    primitives.push({ a:[a.x,a.y,b.x,b.y], b:[ra,rb,encoding,clamp(alpha,0,1)], x:Math.min(a.x,b.x)-r,y:Math.min(a.y,b.y)-r,w:Math.abs(a.x-b.x)+r*2,h:Math.abs(a.y-b.y)+r*2,kind });
  }
  function paths() {
    if (!trails.length) return [];
    if (Array.isArray(trails[0]?.nodes)) return trails;
    const groups = new Map();
    for (let i=0;i<trails.length;i++) {
      const node=trails[i];
      const key = node.trailId ?? node.ownerId ?? `flat-${i}`;
      if (!groups.has(key)) groups.set(key,{id:key,kind:node.kind,nodes:[]});
      groups.get(key).nodes.push(node);
    }
    return [...groups.values()];
  }
  function pack() {
    primitives=[]; retiredFrames=0; advancingTrailSamples=0;
    allowVideoFrames=Boolean(resolve(options.video));
    let currentFilmFrame=-1;
    if(allowVideoFrames && bodies.some(b=>b.kind==='film')){
      if(film())currentFilmFrame=captureFrame()??-1;
      else for(let i=0;i<frameCount;i++){
        const id=sequence-i;if(id<0)break;const slot=id%frameCount;
        if(history[slot]===id&&historyVideo[slot]){currentFilmFrame=id;break;}
      }
    }
    const heads=[];
    for (let index=0;index<bodies.length;index++) {
      const b=bodies[index];
      let alpha=finite(b.opacity,finite(b.alpha,1));
      const x=finite(b.x);let y=finite(b.y),rx=Math.max(1,finite(b.rx,finite(b.w,60)/2)),ry=Math.max(1,finite(b.ry,finite(b.h,50)/2));
      const volume=b.volume??b.fill;
      if(volume!==undefined&&Number.isFinite(Number(volume))){
        const fill=clamp(Number(volume),0,1),amount=Math.sqrt(fill);
        y+=ry*(1-fill)*.7;rx*=.46+.54*amount;ry*=.22+.78*amount;alpha*=.32+.68*amount;
      }
      const frame=Number.isInteger(b.frame)?b.frame:timeOffset>0?rewindFrame():b.kind==='film'?currentFilmFrame:-1;
      let hash=0;for(const c of String(b.id??index))hash=(hash*31+c.charCodeAt(0))|0;
      const side=(hash&1)?1:-1;
      const visc=typeof b.viscosity==='number'?clamp(b.viscosity,.2,8):/honey|amber|thick/.test(String(b.viscosity))?4:1.5;
      const phase=((hash>>>0)%997)/997*Math.PI*2;
      const breath=reduced||timeOffset>0?0:Math.sin(clock*.09/(.7+visc*.12)+phase)*.055;
      const warp=side*(.36+((hash>>>3)%7)*.035)+breath;
      // The readable heart remains calm. Its outline is an asymmetrical sheet
      // bent by surface tension, never a repeated circular icon silhouette.
      ellipse(x+side*rx*.025,y+ry*.045,rx*.97,ry*.86,alpha,b.kind,frame,warp);
      if(rx>=11&&ry>=10&&alpha>.025)heads.push({b,x,y,rx,ry,alpha,frame,side,visc,phase,warp});
    }
    if (pointerAlpha > .005) {
      const x=pointer.x,y=pointer.y,ox=x-pointer.dx,oy=y-pointer.dy;
      const distance=Math.hypot(pointer.dx,pointer.dy);
      if(distance>2){
        const bend=Math.min(16,distance*.15),nx=-pointer.dy/(distance||1),ny=pointer.dx/(distance||1);
        const middle={x:(ox+x)/2+nx*bend,y:(oy+y)/2+ny*bend,r:3.2};
        segment({x:ox,y:oy,r:12},middle,pointerAlpha,'water');
        segment(middle,{x,y,r:10},pointerAlpha,'water');
      } else ellipse(x,y,10,11,pointerAlpha,'water');
    }
    if (working) {
      const x=finite(options.pumpX,.5)*width, y=finite(options.pumpY,.58)*height;
      const end=Number.isFinite(options.pumpEndY)?options.pumpEndY*height:y+height*.14;
      segment({x,y,r:2.5},{x:x+1.4,y:end,r:1.9},.85,'water');
    }
    for(const p of emitted) ellipse(p.x,p.y,p.r,p.r*(1+p.vy*.002),p.alpha,p.kind);
    const all=paths().filter(p=>p.nodes?.length && finite(p.alpha,1)>.015);
    const reserve=Math.min(22,all.reduce((sum,p)=>sum+Math.min(2,p.nodes.length),0));
    const neckLimit=Math.max(primitives.length,maxFields-reserve);
    // Give every semantic head an upstream neck before spending spare fields
    // on larger low lobes. Necks are unlabelled water, not extra hit targets.
    const ordered=heads.slice().sort((a,b)=>Number(Boolean(b.b.critical))-Number(Boolean(a.b.critical))||b.ry-a.ry);
    const neckLength=mode==='dew'?.36:mode==='fall'?1.22:mode==='breath'?1.15:.72;
    const neckWidth=mode==='dew'?.85:mode==='fall'?.52:mode==='pane'?1.42:mode==='breath'?.58:1;
    for(let i=0;i<ordered.length;i++){
      const h=ordered[i];
      if(primitives.length>=neckLimit)break;
      const vx=finite(h.b.vx,finite(h.b.dx)),vy=finite(h.b.vy);
      const length=clamp(h.ry*(.6+h.visc*.12)+Math.abs(vy)*.28,24,115)*neckLength;
      const lean=clamp(vx*.13+h.side*(7+h.rx*.13),-44,44);
      const top={x:h.x-lean,y:h.y-h.ry-length,r:clamp(h.rx*.023,1.0,2.2)*neckWidth};
      const join={x:h.x+h.side*h.rx*.12,y:h.y-h.ry*.42,r:clamp(h.rx*.15,3.5,12)*neckWidth};
      if(mode==='breath'){
        const middle={x:h.x+h.side*h.rx*.42,y:h.y-h.ry-length*.47,r:2.8};
        if(neckLimit-primitives.length>ordered.length-i){segment(top,middle,h.alpha*.74,'vapor');segment(middle,join,h.alpha*.78,'vapor');}
        else segment(top,join,h.alpha*.74,'vapor');
      }else{
        const middle={x:h.x-h.side*h.rx*.18-lean*.28,y:h.y-h.ry*.72-length*.38,r:clamp(h.rx*.045,1.4,4.8)*neckWidth};
        if(neckLimit-primitives.length>ordered.length-i){segment(top,middle,h.alpha*.80,h.b.kind,h.frame,h.frame);segment(middle,join,h.alpha*.92,h.b.kind,h.frame,h.frame);}
        else segment(top,join,h.alpha*.82,h.b.kind,h.frame,h.frame);
      }
    }
    for(const h of ordered){
      if(primitives.length>=neckLimit)break;
      if(h.rx<30&&h.ry<30&&!h.b.critical)continue;
      ellipse(h.x-h.side*h.rx*.46,h.y+h.ry*.10,h.rx*.48,h.ry*.60,h.alpha*.26,h.b.kind,h.frame,-h.warp*.7);
    }
    const available=Math.max(0,maxFields-primitives.length);
    const trailScale=(.55+intensity*.45)*(mode==='dew'?.65:mode==='fall'?.6:mode==='pane'?1.3:mode==='breath'?.75:1);
    const desired=all.reduce((sum,p)=>sum+Math.max(1,p.nodes.length-1),0);
    let used=0;
    for(let pathIndex=0;pathIndex<all.length && used<available;pathIndex++){
      const p=all[pathIndex],nodes=p.nodes;
      const remainingPaths=all.length-pathIndex;
      const budget=Math.max(1,Math.min(available-used-remainingPaths+1,Math.round(available*Math.max(1,nodes.length-1)/Math.max(1,desired))));
      if(nodes.length===1){
        const n=nodes[0],f=historicalFrame(n,p.id??pathIndex,0);
        const wear=clamp(finite(n.age)/12,0,1)*erosion;
        const thin=n.eroded?1:1-wear*.6;
        ellipse(n.x,n.y,finite(n.r,3)*trailScale*thin,finite(n.r,3)*trailScale*thin,finite(p.alpha,1)*finite(n.opacity,finite(n.alpha,1)),mode==='breath'?'vapor':n.kind||p.kind,f);used++;continue;
      }
      const samples=Math.min(nodes.length-1,budget);
      for(let j=0;j<samples && used<available;j++){
        const ia=Math.round(j*(nodes.length-1)/samples),ib=Math.round((j+1)*(nodes.length-1)/samples);
        const a=nodes[ia],b=nodes[ib];
        const ageA=Math.max(0,finite(a.age,0)),ageB=Math.max(0,finite(b.age,0));
        const alpha=finite(p.alpha,1)*Math.min(finite(a.opacity,finite(a.alpha,1)),finite(b.opacity,finite(b.alpha,1)));
        const wearA=clamp(ageA/12,0,1)*erosion,wearB=clamp(ageB/12,0,1)*erosion,wear=Math.max(wearA,wearB);
        const ra=finite(a.r,3)*trailScale*(a.eroded?1:1-wearA*.6),rb=finite(b.r,3)*trailScale*(b.eroded?1:1-wearB*.6);
        const kind=mode==='breath'?'vapor':a.kind||p.kind;
        const fa=historicalFrame(a,p.id??pathIndex,ia),fb=historicalFrame(b,p.id??pathIndex,ib);
        // Evaporation first draws the neck inward. Later it breaks into wet
        // islands. The threshold is tied to a stable path sample, not noise
        // each frame, so erosion has a direction and can be scrubbed backward.
        const seed=Math.abs(Math.sin((pathIndex+1)*17.17+ia*1.917));
        if(wear>.52&&seed<(wear-.42)*1.8){
          const keep=clamp(1-(wear-.42)*1.35,.2,.88);
          const x=a.x+(b.x-a.x)*keep,y=a.y+(b.y-a.y)*keep;
          segment({x:a.x,y:a.y,r:ra},{x,y,r:Math.max(.6,rb*(1-wear*.72))},alpha,kind,fa,fb);
        }else segment({x:a.x,y:a.y,r:ra},{x:b.x,y:b.y,r:rb},alpha,kind,fa,fb);
        used++;
      }
    }
    if(primitives.length>maxFields)primitives.length=maxFields;
  }
  function uploadSource() {
    const s=source();
    if(!s){sourceReady=false;return;}
    sourceWidth=s.w; sourceHeight=s.h;
    const key=`${s.image.currentSrc||s.image.src||''}:${s.w}:${s.h}:${s.image.videoWidth?s.image.currentTime:''}`;
    if(key===sourceKey&&sourceReady&&typeof s.image.getContext!=='function')return;
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,worldTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,s.image);sourceKey=key;sourceReady=true;}
    catch{sourceReady=false;}
  }
  function scissorRegions() {
    const tile=64,cols=Math.ceil(width/tile),rows=Math.ceil(height/tile),grid=new Uint8Array(cols*rows);
    for(const p of primitives){
      const l=clamp(Math.floor(p.x/tile),0,cols-1),r=clamp(Math.floor((p.x+p.w)/tile),0,cols-1);
      const t=clamp(Math.floor(p.y/tile),0,rows-1),b=clamp(Math.floor((p.y+p.h)/tile),0,rows-1);
      if(p.x+p.w<0||p.y+p.h<0||p.x>width||p.y>height)continue;
      for(let row=t;row<=b;row++)for(let col=l;col<=r;col++)grid[row*cols+col]=1;
    }
    const regions=[],previous=new Map();
    for(let row=0;row<rows;row++){
      const current=new Map();let col=0;
      while(col<cols){
        if(!grid[row*cols+col]){col++;continue;}
        const first=col;while(col<cols&&grid[row*cols+col])col++;
        const key=`${first}:${col}`,old=previous.get(key);
        if(old&&old.row+old.rows===row){old.rows++;current.set(key,old);}
        else{const rect={col:first,cols:col-first,row,rows:1};regions.push(rect);current.set(key,rect);}
      }
      previous.clear();for(const [k,v]of current)previous.set(k,v);
    }
    return regions.map(r=>({x:r.col*tile,y:r.row*tile,w:Math.min(width-r.col*tile,r.cols*tile),h:Math.min(height-r.row*tile,r.rows*tile)}));
  }
  function drawGL() {
    gl.disable(gl.SCISSOR_TEST);gl.clear(gl.COLOR_BUFFER_BIT);if(!primitives.length)return;
    uploadSource();
    if(atlasDirty){
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,historyTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);atlasDirty=false;}catch{}
    }
    for(let i=0;i<primitives.length;i++){packedA.set(primitives[i].a,i*4);packedB.set(primitives[i].b,i*4);}
    gl.useProgram(program);gl.uniform4fv(locations.u_a,packedA);gl.uniform4fv(locations.u_b,packedB);
    const p=position();gl.uniform2f(locations.u_view,width,height);gl.uniform2f(locations.u_sourceSize,sourceWidth,sourceHeight);gl.uniform2f(locations.u_position,p.x,p.y);
    gl.uniform1i(locations.u_count,primitives.length);gl.uniform1f(locations.u_hasSource,sourceReady?1:0);gl.uniform1f(locations.u_time,clock);
    gl.enable(gl.SCISSOR_TEST);
    for(const r of scissorRegions()){
      const x=Math.floor(r.x*renderScale),y=Math.floor((height-r.y-r.h)*renderScale);
      gl.scissor(x,y,Math.ceil(r.w*renderScale),Math.ceil(r.h*renderScale));gl.drawArrays(gl.TRIANGLES,0,6);
    }
    gl.disable(gl.SCISSOR_TEST);
  }
  function fallbackPath(p) {
    const a=p.a,b=p.b,path=new Path2D();
    if(b[0]<0){
      const x=a[0],y=a[1],rx=a[2]*.7071,ry=a[3]*.7071;
      path.moveTo(x-rx*.13,y-ry*1.23);
      path.bezierCurveTo(x+rx*.32,y-ry*.68,x+rx*1.06,y-ry*.38,x+rx,y+ry*.16);
      path.bezierCurveTo(x+rx*.92,y+ry*.91,x-rx*.23,y+ry*1.13,x-rx*.76,y+ry*.61);
      path.bezierCurveTo(x-rx*1.12,y+ry*.19,x-rx*.77,y-ry*.53,x-rx*.13,y-ry*1.23);path.closePath();
    }else{
      const dx=a[2]-a[0],dy=a[3]-a[1],length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;
      const r0=b[0],r1=b[1];
      path.moveTo(a[0]+nx*r0,a[1]+ny*r0);path.lineTo(a[2]+nx*r1,a[3]+ny*r1);
      path.quadraticCurveTo(a[2]+dx/length*r1,a[3]+dy/length*r1,a[2]-nx*r1,a[3]-ny*r1);
      path.lineTo(a[0]-nx*r0,a[1]-ny*r0);path.quadraticCurveTo(a[0]-dx/length*r0,a[1]-dy/length*r0,a[0]+nx*r0,a[1]+ny*r0);path.closePath();
    }
    return path;
  }
  function cpuSurface() {
    const target=fallbackCanvas||canvas,cw=target.width,ch=target.height;
    if(cpu&&cpu.w===cw&&cpu.h===ch)return cpu;
    const pixels=cw*ch,sourceCanvas=document.createElement('canvas');
    sourceCanvas.width=cw;sourceCanvas.height=ch;
    const sourceContext=sourceCanvas.getContext('2d',{alpha:false,willReadFrequently:true});
    cpu={w:cw,h:ch,sx:cw/width,sy:ch/height,sourceCanvas,sourceContext,sourcePixels:null,sourceKey:'',sourceObject:null,
      output:ctx.createImageData(cw,ch),indices:new Uint32Array(pixels),owner:new Uint16Array(pixels),
      field:new Float32Array(pixels),gx:new Float32Array(pixels),gy:new Float32Array(pixels),mass:new Float32Array(pixels),
      warm:new Float32Array(pixels),pigment:new Float32Array(pixels),vapor:new Float32Array(pixels),peak:new Float32Array(pixels),along:new Float32Array(pixels),
      x:new Float32Array(cw),y:new Float32Array(ch),history:new Array(frameCount),sampleA:new Float32Array(3),sampleB:new Float32Array(3),
      count:0,ema:0,frameMs:0,fps:24,textureError:null};
    for(let x=0;x<cw;x++)cpu.x[x]=(x+.5)/cpu.sx;
    for(let y=0;y<ch;y++)cpu.y[y]=(y+.5)/cpu.sy;
    return cpu;
  }
  function cpuWorld(c) {
    const s=source();if(!s||!c.sourceContext){sourceReady=false;return;}
    const pos=position(),dynamic=typeof s.image.getContext==='function';
    const key=`${s.image.currentSrc||s.image.src||''}:${s.w}:${s.h}:${pos.x.toFixed(4)}:${pos.y.toFixed(4)}:${s.image.videoWidth?s.image.currentTime:''}`;
    if(c.sourcePixels&&c.sourceKey===key&&c.sourceObject===s.image&&!dynamic){sourceReady=true;return;}
    const view=crop(s);
    try{
      c.sourceContext.drawImage(s.image,view.sx,view.sy,view.sw,view.sh,0,0,c.w,c.h);
      c.sourcePixels=c.sourceContext.getImageData(0,0,c.w,c.h).data;
      c.sourceKey=key;c.sourceObject=s.image;c.textureError=null;sourceReady=true;
    }catch(error){c.textureError=error.name||'TextureReadError';sourceReady=false;}
  }
  function cpuHistory(c,slot) {
    if(slot<0)return c.sourcePixels;
    const cached=c.history[slot];if(cached?.id===history[slot])return cached.pixels;
    try{
      const pixels=atlasCtx.getImageData((slot%atlasCols)*cell,Math.floor(slot/atlasCols)*cell,cell,cell).data;
      c.history[slot]={id:history[slot],pixels};return pixels;
    }catch(error){c.textureError=error.name||'HistoryReadError';return c.sourcePixels;}
  }
  function cpuSample(data,w,h,x,y,out) {
    if(!data){out[0]=.18;out[1]=.23;out[2]=.24;return;}
    x=Math.max(0,Math.min(w-1.001,x));y=Math.max(0,Math.min(h-1.001,y));
    const ix=x|0,iy=y|0,fx=x-ix,fy=y-iy;
    const a=(iy*w+ix)*4,b=a+4,d=a+w*4,e=d+4;
    const wa=(1-fx)*(1-fy)/255,wb=fx*(1-fy)/255,wd=(1-fx)*fy/255,we=fx*fy/255;
    out[0]=data[a]*wa+data[b]*wb+data[d]*wd+data[e]*we;
    out[1]=data[a+1]*wa+data[b+1]*wb+data[d+1]*wd+data[e+1]*we;
    out[2]=data[a+2]*wa+data[b+2]*wb+data[d+2]*wd+data[e+2]*we;
  }
  function draw2D() {
    if(!ctx)return;
    const started=now(),c=cpuSurface();cpuWorld(c);
    const F=c.field,GX=c.gx,GY=c.gy,M=c.mass,W=c.warm,P=c.pigment,V=c.vapor,Peak=c.peak,Owner=c.owner,Along=c.along;
    F.fill(0);GX.fill(0);GY.fill(0);M.fill(0);W.fill(0);P.fill(0);V.fill(0);Peak.fill(0);c.output.data.fill(0);c.count=0;
    const samples=new Array(primitives.length);
    // The same compact potential and analytic derivatives as the GPU shader,
    // accumulated only in each body's compact support rectangle.
    for(let n=0;n<primitives.length;n++){
      const p=primitives[n],a=p.a,b=p.b,opacity=b[3];
      const packed=Math.floor(b[2]),slotA=packed%64-1,slotB=Math.floor(packed/64)-1,fraction=b[2]-packed,warm=Math.floor(fraction*4+.001)%2,pigment=Math.floor(fraction*8+.001)%2,vapor=fraction>=.49?1:0;
      const dataA=cpuHistory(c,slotA),dataB=slotB===slotA?dataA:cpuHistory(c,slotB);
      const aw=slotA<0||dataA===c.sourcePixels?c.w:cell,ah=slotA<0||dataA===c.sourcePixels?c.h:cell;
      const bw=slotB<0||dataB===c.sourcePixels?c.w:cell,bh=slotB<0||dataB===c.sourcePixels?c.h:cell;
      samples[n]={dataA,dataB,aw,ah,bw,bh,mix:dataA!==dataB};
      const x0=Math.max(0,Math.floor(p.x*c.sx)),x1=Math.min(c.w-1,Math.ceil((p.x+p.w)*c.sx));
      const y0=Math.max(0,Math.floor(p.y*c.sy)),y1=Math.min(c.h-1,Math.ceil((p.y+p.h)*c.sy));
      if(x1<x0||y1<y0)continue;
      if(b[0]<0){
        const invX=1/Math.max(.25,a[2]*a[2]),invY=1/Math.max(.25,a[3]*a[3]),radius=Math.sqrt(a[2]*a[3])*.70710678;
        for(let iy=y0;iy<=y1;iy++){
          const py=c.y[iy]-a[1],row=iy*c.w;
          for(let ix=x0;ix<=x1;ix++){
            const dx=c.x[ix]-a[0],u=dx/Math.max(a[2],.5);
            if(Math.abs(u)>1)continue;
            const bend=b[1]*a[3]*(u*.64+(u*u-.25)*.46),bendSlope=b[1]*a[3]*(.64+.92*u)/Math.max(a[2],.5);
            const dy=py-bend,q=1-dx*dx*invX-dy*dy*invY;if(q<=0)continue;
            const index=row+ix,q2=q*q,contribution=q2*q*opacity,derivative=-6*q2*opacity;
            if(F[index]===0)c.indices[c.count++]=index;
            F[index]+=contribution;GX[index]+=derivative*(dx*invX-dy*invY*bendSlope);GY[index]+=derivative*dy*invY;
            M[index]+=radius*contribution;W[index]+=warm*contribution;P[index]+=pigment*contribution;V[index]+=vapor*contribution;
            if(contribution>Peak[index]){Peak[index]=contribution;Owner[index]=n;Along[index]=0;}
          }
        }
      }else{
        const vx=a[2]-a[0],vy=a[3]-a[1],inverseLength=1/Math.max(.01,vx*vx+vy*vy),dr=b[1]-b[0];
        const drx=dr*1.41421356*vx*inverseLength,dry=dr*1.41421356*vy*inverseLength;
        for(let iy=y0;iy<=y1;iy++){
          const py=c.y[iy],row=iy*c.w;
          for(let ix=x0;ix<=x1;ix++){
            const px=c.x[ix],raw=((px-a[0])*vx+(py-a[1])*vy)*inverseLength,t=Math.max(0,Math.min(1,raw));
            const radius=b[0]+dr*t,support=Math.max(.7,radius*1.41421356),inv=1/(support*support);
            const dx=px-a[0]-vx*t,dy=py-a[1]-vy*t,d2=dx*dx+dy*dy,q=1-d2*inv;if(q<=0)continue;
            const index=row+ix,q2=q*q,contribution=q2*q*opacity,multiplier=3*q2*opacity;
            const taper=raw>0&&raw<1?2*d2*inv/support:0;
            if(F[index]===0)c.indices[c.count++]=index;
            F[index]+=contribution;GX[index]+=(-2*dx*inv+taper*drx)*multiplier;GY[index]+=(-2*dy*inv+taper*dry)*multiplier;
            M[index]+=radius*contribution;W[index]+=warm*contribution;P[index]+=pigment*contribution;V[index]+=vapor*contribution;
            if(contribution>Peak[index]){Peak[index]=contribution;Owner[index]=n;Along[index]=t;}
          }
        }
      }
    }
    const out=c.output.data,color=c.sampleA,other=c.sampleB;
    for(let k=0;k<c.count;k++){
      const index=c.indices[k],field=F[index];if(field<.10)continue;
      const iy=(index/c.w)|0,ix=index-iy*c.w,px=c.x[ix],py=c.y[iy];
      const radius=M[index]/field,depth=Math.sqrt(Math.max(0,field-.125));
      const normalScale=Math.max(3,radius)*.46/Math.sqrt(Math.max(.045,field-.125));
      const sx=-GX[index]*normalScale,sy=-GY[index]*normalScale,norm=1/Math.sqrt(sx*sx+sy*sy+.8464);
      const nx=sx*norm,ny=sy*norm,nz=.92*norm;
      const displacement=(3+Math.min(26,radius*.48))*(.68+Math.min(.72,depth));
      const rx=(px-nx*displacement)/width,ry=(py-ny*displacement)/height,sample=samples[Owner[index]];
      cpuSample(sample.dataA,sample.aw,sample.ah,rx*(sample.aw-1),ry*(sample.ah-1),color);
      if(sample.mix){
        cpuSample(sample.dataB,sample.bw,sample.bh,rx*(sample.bw-1),ry*(sample.bh-1),other);
        const t=Along[index];color[0]+=(other[0]-color[0])*t;color[1]+=(other[1]-color[1])*t;color[2]+=(other[2]-color[2])*t;
      }
      const oneMinusZ=1-nz,fresnel=oneMinusZ*oneMinusZ*oneMinusZ;
      let sky=Math.max(0,Math.min(1,(-.52999894*nx-.8479983*ny+.2)/1.05));sky=sky*sky*(3-2*sky);
      const warm=Math.max(0,Math.min(1,W[index]/field))*.45;
      const pigment=Math.max(0,Math.min(1,P[index]/field))*.32*Math.min(1,depth+.2);
      color[0]=color[0]*(1-pigment*.28)+pigment*.008;
      color[1]=color[1]*(1+pigment*.015)+pigment*.035;
      color[2]=color[2]*(1+pigment*.06)+pigment*.043;
      const vapor=Math.max(0,Math.min(1,V[index]/field));
      const dot=Math.max(0,-.188544*nx-.274960*ny+.942809*nz);
      const h2=dot*dot,h4=h2*h2,h8=h4*h4,h16=h8*h8,h32=h16*h16,h64=h32*h32,h80=h64*h16;
      const highlight=h80*.52+h80*h80*h80*.65;
      const cd=Math.max(0,.116374*nx+.892201*ny+.436403*nz),c2=cd*cd,c4=c2*c2,c8=c4*c4,c16=c8*c8;
      const glint=(highlight+c16*c8*.13)*(1-vapor*.93);
      let edge=Math.max(0,Math.min(1,(field-.125)/.075));edge=1-edge*edge*(3-2*edge);
      const darken=1-edge*.16*(1-sky),transmission=1-fresnel*.11,reflection=fresnel*.26*(1-vapor*.8);
      out[index*4]=Math.min(255,Math.max(0,(color[0]*transmission+(.34+.53*sky)*reflection+(.94+.06*warm)*glint+vapor*.055)*darken*255));
      out[index*4+1]=Math.min(255,Math.max(0,(color[1]*transmission+(.43+.49*sky)*reflection+(.98-.06*warm)*glint+vapor*.065)*darken*255));
      out[index*4+2]=Math.min(255,Math.max(0,(color[2]*transmission+(.47+.47*sky)*reflection+(1-.25*warm)*glint+vapor*.067)*darken*255));
      let coverage=Math.max(0,Math.min(1,(field-.10)/.05));coverage=coverage*coverage*(3-2*coverage);
      out[index*4+3]=coverage*(.62+.22*Math.min(1,depth))*(1-vapor*.78)*255;
    }
    ctx.putImageData(c.output,0,0);
    c.frameMs=Math.max(0,now()-started);c.ema=c.ema?c.ema*.85+c.frameMs*.15:c.frameMs;
    c.fps=Math.max(13,Math.min(24,Math.floor(850/(c.ema+4))));
  }
  function render(dt=0) {
    if(dead)return;
    if(timeOffset===0)clock+=dt;
    if(!reduced&&timeOffset===0){
      pointerAlpha+=(Number(pointer.active)-pointerAlpha)*Math.min(1,dt*12);
      for(let i=emitted.length-1;i>=0;i--){const p=emitted[i];p.vy+=dt*4;p.y+=p.vy*dt;p.x+=p.vx*dt;p.alpha-=dt*.16;if(p.alpha<=0||p.y>height+30)emitted.splice(i,1);}
    }
    captureFrame();
    pack();if(gl)drawGL();else draw2D();
  }
  function resize(){
    if(dead)return;
    const r=canvas.getBoundingClientRect();width=Math.max(1,r.width||canvas.clientWidth||window.innerWidth);height=Math.max(1,r.height||canvas.clientHeight||window.innerHeight);
    const area=width*height,phone=Math.min(width,height)<650,cap=gl?(width<650?240000:520000):(phone?220000:135000);
    renderScale=gl?Math.min(window.devicePixelRatio||1,width<650?.95:1.2,Math.sqrt(cap/area)):
      Math.min(1,Math.sqrt(cap/area),(phone?700:900)/Math.max(width,height));
    canvas.width=Math.max(1,Math.round(width*renderScale));canvas.height=Math.max(1,Math.round(height*renderScale));
    if(gl)gl.viewport(0,0,canvas.width,canvas.height);
    // CPU fields are already sampled in native output pixels. Keep the 2D
    // transform neutral; optical geometry never passes through a second scale.
    if(ctx){const target=fallbackCanvas||canvas;target.width=canvas.width;target.height=canvas.height;ctx.setTransform(1,0,0,1,0,0);}
    sourceKey='';render(0);
  }
  function frame(time){
    raf=0;if(dead||reduced||document.hidden)return;
    if(time-lastPaint>=1000/(gl?30:cpu?.fps||24)-1){const dt=lastTick?Math.min(.085,Math.max(0,(time-lastTick)/1000)):0;lastTick=time;lastPaint=time;render(dt);}
    raf=requestAnimationFrame(frame);
  }
  function start(){if(!dead&&!raf&&!reduced&&!document.hidden){lastTick=0;lastPaint=0;raf=requestAnimationFrame(frame);}}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;lastTick=0;}
  function visibility(){if(document.hidden)stop();else{render(0);start();}}
  function updateStatic(){if(reduced||document.hidden)render(0);}
  function contextLost(event){event.preventDefault();stop();}
  function contextRestored(){sourceKey='';sourceReady=false;atlasDirty=true;try{setupGL();resize();start();}catch{}}
  canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;observer?.observe(canvas);
  if(!observer)window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);
  resize();start();
  return {
    setBodies(next=[]){if(dead)return;bodies=Array.isArray(next)?next:[];updateStatic();},
    setTrails(next=[]){if(dead)return;trails=Array.isArray(next)?next:[];updateStatic();},
    setPointer(next={}){if(dead)return;pointer={x:finite(next.x,pointer.x),y:finite(next.y,pointer.y),dx:finite(next.dx),dy:finite(next.dy),active:Boolean(next.active)};if(pointer.active)pointerAlpha=Math.max(pointerAlpha,.85);if(reduced)pointerAlpha=Number(pointer.active);updateStatic();},
    setMode(next){if(dead||!modes.has(next)||next===mode)return;mode=next;if(next==='worms')captureFrame(true);updateStatic();},
    setIntensity(value){if(dead)return;intensity=clamp(finite(value,intensity),0,1);updateStatic();},
    setErosion(value){if(dead)return;erosion=clamp(finite(value,erosion),0,1);updateStatic();},
    setTimeOffset(value){
      if(dead)return;
      const wanted=Math.max(0,finite(value));
      if(wanted>0&&timeOffset===0){
        captureFrame(true);scrubFrame=sequence;scrubTime=sequence>=0?historyTime[sequence%frameCount]:0;
      }
      timeOffset=Math.min(wanted,historySpan());
      if(timeOffset===0){scrubFrame=-1;scrubTime=0;lastCapture=-Infinity;}
      render(0);
    },
    setReducedMotion(value){if(dead)return;reduced=Boolean(value);stop();pointerAlpha=Number(pointer.active);if(reduced)emitted=[];render(0);start();},
    burst(x,y,kind='water'){if(dead||timeOffset>0)return;const n=reduced?1:Math.round(2+intensity*2);for(let i=0;i<n;i++)emitted.push({x:finite(x)+(i-n/2)*3,y:finite(y),r:1.6+Math.random()*2.8,vx:(Math.random()-.5)*7,vy:3+Math.random()*7,alpha:.8,kind});if(emitted.length>10)emitted.splice(0,emitted.length-10);updateStatic();},
    setActivity(value){if(dead)return;working=Boolean(value);updateStatic();},
    captureFrame,
    getStats(){return{renderer:gl?'webgl':'canvas2d',optics:gl?'gpu-field':'cpu-field',fields:primitives.length,maxFields,historyFrames:Math.min(frameCount,sequence+1),latestFrame:sequence,availableHistorySeconds:Math.round(historySpan()*100)/100,timeOffset,selectedHistoryFrame:rewindFrame(),erosion,retiredFrames,advancingTrailSamples,reducedMotion:reduced,width,height,outputWidth:canvas.width,outputHeight:canvas.height,renderScale,mode,intensity,sourceReady,cpuPixels:cpu?cpu.w*cpu.h:0,cpuFrameMs:cpu?Math.round(cpu.ema*10)/10:0,cpuFPS:cpu?.fps||0,textureError:cpu?.textureError||null};},
    destroy(){if(dead)return;dead=true;stop();observer?.disconnect();window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);if(gl){gl.deleteTexture(worldTexture);gl.deleteTexture(historyTexture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.clear(gl.COLOR_BUFFER_BIT);}else ctx?.clearRect(0,0,width,height);fallbackCanvas?.remove();bodies=[];trails=[];emitted=[];nodeFrames.clear();historyPlayheads.clear();frameOrigins.clear();cpu=null;},
  };
}

return Object.freeze({ createFluidGlass });
})();
// Module: rain-field.js
RainModules["./rain-field.js"] = (() => {
/**
 * Physical lifecycle for semantic water drops. This module owns no game state.
 *
 * createRainField({host,glass,onAdjust,onCatch,onRelease})
 *   .sync([{id,element,role,viscosity,anchorX,anchorY,critical,adjust,label}])
 *   .tick(seconds) .setReducedMotion(bool) .setMenuOpen(bool)
 *   .setErosion(0..1) .setTimeOffset(seconds) .getHistoryRange()
 *   .erodeAt(x,y,radius) // only existing wet traces, never live bodies
 *   .suppressClick(eventOrId) .getBodies() .getTrails() .destroy()
 *
 * Anchors are normalized CENTRES (0..1), relative to host. The renderer receives
 * pixel centres and radii. Anchors are wet contact points: water rests there,
 * deforms under a gesture and relaxes. A clock never ejects a valid action.
 * adjust=true calls onAdjust(id, incrementalNormalizedDelta, meta); positive is
 * an upward pull. A function-valued adjust receives (delta, meta) instead.
 * meta.dx/dy and totalDx/totalDy are pixels; normalizedDx is right-positive and
 * normalizedDy is up-positive. Set host.dataset.scene before sync to retire
 * unrelated history on a state change while retaining its real wet trace.
 * #menu-toggle is an external continuous edge source, excluded here. #steer is
 * rendered, but its positioning and pointer gesture remain owned by the game.
 */

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const hash = text => [...String(text)].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 17);
const smooth = value => { const t=clamp(value,0,1); return t*t*(3-2*t); };

function createRainField({ host, glass, onAdjust, onCatch, onRelease, historyLabels=true } = {}) {
  if (!host || typeof host.getBoundingClientRect !== 'function') throw new TypeError('RainField needs a positioned host element.');
  const doc = host.ownerDocument || globalThis.document;
  const drops = new Map();
  const trails = new Map();
  const shed = [];
  const currents = [];
  let material='pane', erosion=.32, timeOffset=0;
  const historyWindow=12;
  let width=1, height=1, elapsed=0, reduced=false, menuOpen=false, dead=false, nodeSequence=0, shedSequence=0;
  let capturedAt=-1, capturedFrame;
  let context=host.dataset.scene || 'world';

  function size() {
    const rect=host.getBoundingClientRect();
    width=Math.max(1,rect.width || host.clientWidth || 1);
    height=Math.max(1,rect.height || host.clientHeight || 1);
    return rect;
  }
  size();

  function labelOf(drop) {
    if (typeof drop.descriptor.label === 'string') return drop.descriptor.label.trim();
    const value=drop.element.querySelector?.('.drop-value')?.textContent?.trim();
    const name=drop.element.querySelector?.('.drop-kicker')?.textContent?.trim();
    if (value) return [name,value].filter(Boolean).join(': ');
    return (drop.element.getAttribute?.('aria-label') || drop.element.textContent || '').replace(/\s+/g,' ').trim().slice(0,150);
  }
  function point(event) {
    const rect=host.getBoundingClientRect();
    return {x:event.clientX-rect.left,y:event.clientY-rect.top};
  }
  function focusInside(drop) {
    const focused=doc?.activeElement;
    return !!focused && (focused===drop.element || drop.element.contains?.(focused));
  }
  function pinned(drop) {
    return !!drop.pointer || (focusInside(drop) && drop.focusMode!=='pointer') || (drop.external && drop.element.classList?.contains('pinned'));
  }
  function nativeTarget(drop,target) {
    let node=target;
    while(node && node!==drop.element){
      if(/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(node.tagName||'') || node.isContentEditable)return true;
      node=node.parentElement || node.parentNode || node.parent;
    }
    return target===drop.element && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName||'') || target.isContentEditable);
  }
  function measure(drop) {
    const rect=drop.element.getBoundingClientRect();
    drop.w=Math.max(38,rect.width || drop.element.offsetWidth || drop.w || 90);
    drop.h=Math.max(38,rect.height || drop.element.offsetHeight || drop.h || 64);
    drop.rx=drop.w*.54;
    drop.ry=drop.h*.58;
    if (drop.external) {
      const hostRect=host.getBoundingClientRect();
      drop.x=rect.left+rect.width/2-hostRect.left;
      drop.y=rect.top+rect.height/2-hostRect.top;
    }
  }
  function bounds(drop, dragged=false) {
    const pad=8;
    let left=Math.min(drop.rx+pad,width*.45), right=Math.max(width-drop.rx-pad,width*.55);
    // Edge-born rain stays in its own stream unless deliberately pulled away.
    if (!dragged && !drop.displaced && !drop.critical) {
      if (drop.anchorX<.33) right=Math.max(left,width*.29);
      if (drop.anchorX>.67) left=Math.min(right,width*.71);
    }
    drop.x=clamp(drop.x,left,right);
    drop.y=clamp(drop.y,Math.min(drop.ry+pad,height*.4),Math.max(height-drop.ry-pad,height*.6));
  }
  function nodeAge(node,at=elapsed) {
    const held=node.holds.reduce((sum,range)=>sum+Math.max(0,Math.min(at,range.end??at)-range.start),0);
    return Math.max(0,at-node.time-held);
  }
  function nodeLife() { return 20-13*erosion; }
  function nodeMass(node,at=elapsed){return clamp(1-node.cuts.reduce((sum,cut)=>sum+(cut.time<=at?cut.amount:0),0),0,1);}
  function nodeAlpha(node,at=elapsed) {
    if(node.time>at)return 0;
    const lifetime=1-nodeAge(node,at)/nodeLife();
    const retirement=node.retiredAt===null ? 1 : 1-(at-node.retiredAt)/2.4;
    const heldAt=node.holds.some(range=>range.start<=at&&(range.end===null||range.end>at));
    return Math.pow(clamp(heldAt?lifetime:Math.min(lifetime,retirement),0,1),1.15+erosion*.75)*Math.pow(nodeMass(node,at),1.2);
  }
  function nodeRadius(node,at=elapsed) {
    const wetness=clamp(1-nodeAge(node,at)/nodeLife(),0,1);
    return node.r*(.17+.83*Math.pow(wetness,.4+erosion*.7))*Math.sqrt(nodeMass(node,at));
  }
  function holdNode(node,hold) {
    if (hold && !node.held) { node.held=true; node.holdSince=elapsed;node.holds.push({start:elapsed,end:null}); }
    if (!hold && node.held) { node.heldDuration+=elapsed-node.holdSince; node.held=false;node.holds.at(-1).end=elapsed; }
  }
  function historyElement(drop,node) {
    if(!historyLabels)return;
    if (!node.label || !doc?.createElement || node.context!==context) return;
    const trail=trails.get(drop.id);
    const visible=trail.nodes.filter(value=>value.element);
    // Preserve real samples in the water, but do not stamp identical text at
    // every pointer frame or stack new values over one stationary position.
    if(visible.some(value=>value.label===node.label))return;
    if(visible.some(value=>Math.hypot(value.x-node.x,value.y-node.y)<Math.max(34,Math.min(52,drop.h*.6))))return;
    while (visible.length>=3) {
      const candidate=visible.find(value=>!value.held);
      if (!candidate) return;
      candidate.element.remove(); candidate.element=null;
      visible.splice(visible.indexOf(candidate),1);
    }
    const allVisible=[...trails.values()].flatMap(value=>value.nodes).filter(value=>value.element);
    const budget=width<600?6:10;
    while(allVisible.length>=budget){
      const candidate=allVisible.find(value=>!value.held);
      if(!candidate)return;
      candidate.element.remove();candidate.element=null;
      allVisible.splice(allVisible.indexOf(candidate),1);
    }
    const el=doc.createElement('button');
    el.type='button'; el.className='rain-memory';
    el.dataset.rainHistory='true'; el.dataset.owner=drop.id;
    el.textContent=node.label.length>58 ? node.label.slice(0,55)+'…' : node.label;
    const historyKind=node.reason==='motion'?'Earlier position':'Earlier value';
    el.setAttribute('aria-label',`${historyKind}, read only: ${node.label}`);
    el.title=`${historyKind} · ${node.label}`;
    Object.assign(el.style,{
      position:'absolute',left:`${node.x}px`,top:`${node.y}px`,transform:'translate(-50%, -50%)',
      background:'none',border:'0',padding:'5px 7px',margin:'0',minWidth:'44px',minHeight:'34px',
      maxWidth:`${Math.max(100,Math.min(180,width*.32))}px`,font:'inherit',fontSize:'14px',lineHeight:'1.25',
      color:'rgba(219,250,250,.86)',textShadow:'0 1px 4px #061721, 0 0 9px #061721',
      cursor:'help',zIndex:'5',touchAction:'none',pointerEvents:'none',visibility:'hidden',whiteSpace:'normal'
    });
    el.addEventListener('pointerenter',()=>holdNode(node,true));
    el.addEventListener('pointerleave',()=>{if(doc.activeElement!==el)holdNode(node,false);});
    el.addEventListener('focus',()=>{holdNode(node,true);el.style.textDecoration='underline dotted';});
    el.addEventListener('blur',()=>{holdNode(node,false);el.style.textDecoration='none';});
    el.addEventListener('pointerdown',event=>{event.stopPropagation();holdNode(node,true);});
    el.addEventListener('pointercancel',()=>{if(doc.activeElement!==el)holdNode(node,false);});
    el.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();holdNode(node,true);});
    host.append(el); node.element=el;
  }
  function sample(drop,{label=drop.label,force=false,readable=false,reason='value'}={}) {
    if(timeOffset>0)return;
    let trail=trails.get(drop.id);
    if (!trail) {trail={id:`trail-${drop.id}`,ownerId:drop.id,nodes:[],kind:drop.kind,viscosity:drop.viscosity};trails.set(drop.id,trail);}
    const previous=trail.nodes.at(-1);
    const distance=previous ? Math.hypot(drop.x-previous.x,drop.y-previous.y) : Infinity;
    if (!force && previous && elapsed-previous.time<.19) return;
    if (!force && distance<7 && previous?.label===label) return;
    let frame=capturedFrame;
    if(elapsed-capturedAt>=.19 || capturedFrame===undefined){
      try {capturedFrame=glass?.captureFrame?.();capturedAt=elapsed;frame=capturedFrame;} catch {frame=undefined;}
    }
    const node={id:++nodeSequence,x:drop.x,y:drop.y,r:Math.max(3,Math.min(drop.rx,drop.ry)*.2),time:elapsed,label:label||'',frame,context,reason,retiredAt:null,held:false,heldDuration:0,holdSince:0,holds:[],cuts:[],element:null};
    trail.nodes.push(node);
    if (trail.nodes.length>256) {
      const index=trail.nodes.findIndex(value=>!value.held);
      if(index>=0){trail.nodes[index].element?.remove();trail.nodes.splice(index,1);}
    }
    drop.lastSample=elapsed;
    if (readable && node.label) historyElement(drop,node);
    return node;
  }
  function beginCatch(drop,event) {
    if (drop.external || drop.pointer || drop.element.disabled || event.button>0 || nativeTarget(drop,event.target)) return;
    event.preventDefault();
    const p=point(event);
    drop.pointer={id:event.pointerId,startX:p.x,startY:p.y,lastX:p.x,lastY:p.y,bodyX:drop.x,bodyY:drop.y,dragged:false,originNode:null};
    drop.focusMode='pointer';
    drop.vx=0;drop.vy=0;drop.phase='caught';drop.alpha=1;
    drop.element.dataset.rainCaught='true';
    try{drop.element.setPointerCapture?.(event.pointerId);}catch{}
    // Pointer focus belongs to the current semantic object, even while its
    // physical source has moved. Labels never disappear beneath a held touch.
    try{drop.element.focus?.({preventScroll:true});}catch{}
    drop.pointer.originNode=sample(drop,{force:true,readable:false,reason:'motion'});
    onCatch?.(drop.id,{reason:'pointer',role:drop.role,x:drop.x,y:drop.y});
  }
  function moveCatch(drop,event) {
    const gesture=drop.pointer;
    if (!gesture || gesture.id!==event.pointerId) return;
    event.preventDefault();
    const p=point(event),dx=p.x-gesture.lastX,dy=p.y-gesture.lastY;
    if (!gesture.dragged && Math.hypot(p.x-gesture.startX,p.y-gesture.startY)>6) {
      gesture.dragged=true;
      if(gesture.originNode)historyElement(drop,gesture.originNode);
    }
    if (gesture.dragged) {
      if(!drop.critical)drop.displaced=true;
      const totalX=p.x-gesture.startX,totalY=p.y-gesture.startY;
      drop.x=gesture.bodyX+(drop.critical ? clamp(totalX,-18,18) : totalX);
      drop.y=gesture.bodyY+(drop.critical ? clamp(totalY,-18,18) : totalY);
      bounds(drop,true);
      drop.suppressUntil=elapsed+.75;
      currents.push({x:drop.x,y:drop.y,vx:clamp(dx*5,-240,240),vy:clamp(dy*5,-240,240),age:0});
      if(currents.length>20)currents.shift();
      glass?.setPointer?.({x:p.x,y:p.y,dx,dy,active:true});
      if(drop.descriptor.adjust){
        const delta=dy===0?0:-dy/Math.max(160,height*.48);
        const meta={id:drop.id,phase:'move',x:p.x,y:p.y,dx,dy,totalDx:totalX,totalDy:totalY,normalizedDx:dx/Math.max(160,width*.6),normalizedDy:delta};
        if(typeof drop.descriptor.adjust==='function')drop.descriptor.adjust(delta,meta);
        else onAdjust?.(drop.id,delta,meta);
      }
      sample(drop,{label:'',readable:false});
      place(drop);
    }
    gesture.lastX=p.x;gesture.lastY=p.y;
  }
  function endCatch(drop,event) {
    const gesture=drop.pointer;
    if (!gesture || (event.pointerId!==undefined && gesture.id!==event.pointerId)) return;
    const dragged=gesture.dragged;
    const cancelled=['pointercancel','lostpointercapture','contextchange','detach','destroy'].includes(event.type);
    drop.pointer=null;
    if(dragged||cancelled)drop.suppressUntil=elapsed+.75;
    if(dragged)sample(drop,{label:'',force:true,readable:false});
    drop.phase=pinned(drop)?'caught':'settling';
    // Runoff is a consequence of a substantial pull, never a timer that makes
    // a command run away. Thick water keeps its mass and slowly relaxes.
    if(dragged&&!cancelled&&Math.hypot(gesture.lastX-gesture.startX,gesture.lastY-gesture.startY)>100&&elapsed-drop.shedAt>4&&drop.viscosity<3){shedWater(drop);drop.shedAt=elapsed;}
    drop.element.dataset.rainCaught=String(pinned(drop));
    try{if(drop.element.hasPointerCapture?.(gesture.id))drop.element.releasePointerCapture(gesture.id);}catch{}
    glass?.setPointer?.({x:drop.x,y:drop.y,dx:0,dy:0,active:false});
    onRelease?.(drop.id,{reason:event.type||'pointerup',role:drop.role,dragged,cancelled,x:drop.x,y:drop.y});
  }
  function attach(drop) {
    const el=drop.element;
    drop.original={style:{position:el.style.position,left:el.style.left,right:el.style.right,top:el.style.top,bottom:el.style.bottom,margin:el.style.margin,transform:el.style.transform,touchAction:el.style.touchAction,opacity:el.style.opacity},tabIndex:el.getAttribute?.('tabindex')};
    drop.handlers=[];
    if(drop.external)return;
    el.style.touchAction='none';
    if(['info','range'].includes(drop.role) && !el.hasAttribute?.('tabindex'))el.setAttribute('tabindex','0');
    const listen=(name,fn,options)=>{el.addEventListener(name,fn,options);drop.handlers.push([name,fn,options]);};
    listen('pointerdown',event=>beginCatch(drop,event),{passive:false});
    listen('pointermove',event=>moveCatch(drop,event),{passive:false});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(type,event=>endCatch(drop,event),{passive:false});
    listen('focusin',()=>{
      if(!drop.pointer)drop.focusMode='keyboard';
      drop.phase='caught';drop.alpha=1;drop.vx=0;drop.vy=0;drop.element.dataset.rainCaught='true';
      if(!drop.pointer)onCatch?.(drop.id,{reason:'focus',role:drop.role,x:drop.x,y:drop.y});
      place(drop);
    });
    listen('focusout',()=>{
      drop.focusMode=null;
      if(!drop.pointer){drop.phase='flowing';drop.element.dataset.rainCaught='false';onRelease?.(drop.id,{reason:'blur',role:drop.role,dragged:false});}
    });
    listen('keydown',event=>{
      if(nativeTarget(drop,event.target))return;
      drop.focusMode='keyboard';drop.phase='caught';drop.alpha=1;drop.vx=0;drop.vy=0;place(drop);
      if(!drop.descriptor.adjust || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      if(event.target!==el && /^(INPUT|TEXTAREA)$/.test(event.target?.tagName||''))return;
      event.preventDefault();event.stopPropagation();
      const delta=event.key==='Home'?-1:event.key==='End'?1:['ArrowUp','ArrowRight'].includes(event.key)?.02:-.02;
      onCatch?.(drop.id,{reason:'keyboard',role:drop.role});
      sample(drop,{force:true,readable:true});
      const horizontal=['ArrowLeft','ArrowRight','Home','End'].includes(event.key);
      const meta={id:drop.id,phase:'keyboard',key:event.key,dx:horizontal?delta*Math.max(160,width*.6):0,dy:horizontal?0:-delta*Math.max(160,height*.48),normalizedDx:horizontal?delta:0,normalizedDy:horizontal?0:delta,totalDx:0,totalDy:0};
      if(typeof drop.descriptor.adjust==='function')drop.descriptor.adjust(delta,meta);else onAdjust?.(drop.id,delta,meta);
      onRelease?.(drop.id,{reason:'keyboard',role:drop.role,dragged:false});
    });
  }
  function detach(drop) {
    if(drop.pointer)endCatch(drop,{type:dead?'destroy':'detach',pointerId:drop.pointer.id});
    else if(focusInside(drop))onRelease?.(drop.id,{reason:dead?'destroy':'detach',role:drop.role,dragged:false,cancelled:true});
    for(const [name,fn,options]of drop.handlers||[])drop.element.removeEventListener(name,fn,options);
    if(drop.original){
      Object.assign(drop.element.style,drop.original.style);
      if(drop.original.tabIndex===null || drop.original.tabIndex===undefined)drop.element.removeAttribute?.('tabindex');
      else drop.element.setAttribute('tabindex',drop.original.tabIndex);
    }
    delete drop.element.dataset.rainCaught;delete drop.element.dataset.rainPhase;
    drop.pointer=null;
  }
  function place(drop) {
    if(drop.external)return;
    Object.assign(drop.element.style,{position:'absolute',left:`${drop.x.toFixed(2)}px`,right:'auto',top:`${drop.y.toFixed(2)}px`,bottom:'auto',margin:'0',transform:'translate(-50%, -50%)',opacity:String(pinned(drop)||drop.critical?1:Math.max(.68,drop.alpha))});
    drop.element.dataset.rainPhase=drop.phase;
    drop.element.dataset.rainCaught=String(pinned(drop));
  }
  function sync(descriptors=[]) {
    if(dead)return;
    size();
    const nextContext=host.dataset.scene || 'world';
    if(nextContext!==context){
      context=nextContext;
      for(const trail of trails.values())for(const node of trail.nodes){
        if(node.context===context)continue;
        node.retiredAt=elapsed;
        if(doc.activeElement!==node.element){holdNode(node,false);node.element?.remove();node.element=null;}
      }
      for(const drop of drops.values()){
        if(drop.pointer)endCatch(drop,{type:'contextchange',pointerId:drop.pointer.id});
      }
    }
    const keep=new Set();
    for(const descriptor of descriptors){
      if(!descriptor?.element || !descriptor.id || descriptor.id==='menu-toggle' || descriptor.element.id==='menu-toggle')continue;
      const id=String(descriptor.id);keep.add(id);
      let drop=drops.get(id);
      if(drop && drop.element!==descriptor.element){detach(drop);drop.element=descriptor.element;drop.role=descriptor.role||'info';attach(drop);}
      if(!drop){
        const rect=descriptor.element.getBoundingClientRect(),hostRect=host.getBoundingClientRect();
        const anchorX=finite(descriptor.anchorX)?clamp(descriptor.anchorX,0,1):(rect.left+rect.width/2-hostRect.left)/width;
        const anchorY=finite(descriptor.anchorY)?clamp(descriptor.anchorY,0,1):(rect.top+rect.height/2-hostRect.top)/height;
        const seed=hash(id);
        drop={id,element:descriptor.element,descriptor,context,role:descriptor.role||'info',anchorX,anchorY,x:anchorX*width,y:anchorY*height,vx:0,vy:0,rx:40,ry:35,w:80,h:70,age:0,seed,phase:'condensing',alpha:1,viscosity:1.5,critical:false,external:id==='steer'||descriptor.element.id==='steer',pointer:null,focusMode:null,displaced:false,suppressUntil:-1,lastSample:-1,lastReadable:-1,lastLabelSample:elapsed,shedAt:elapsed-5,label:'',handlers:[]};
        drops.set(id,drop);attach(drop);
      }
      const oldLabel=drop.liveLabel??drop.label;
      drop.descriptor=descriptor;drop.role=descriptor.role||'info';
      drop.viscosity=clamp(finite(descriptor.viscosity)?descriptor.viscosity:1.5,.25,8);
      drop.critical=!!descriptor.critical || drop.role==='menu' || drop.external;
      drop.kind=descriptor.kind || (descriptor.element.classList?.contains('amber')?'amber':'water');
      if(finite(descriptor.anchorX))drop.anchorX=clamp(descriptor.anchorX,0,1);
      if(finite(descriptor.anchorY))drop.anchorY=clamp(descriptor.anchorY,0,1);
      measure(drop);
      const label=labelOf(drop);
      const sameContext=drop.context===context;
      if(timeOffset===0&&oldLabel && sameContext && label!==oldLabel && elapsed-drop.lastLabelSample>=.29){
        sample(drop,{label:oldLabel,force:true,readable:true});drop.lastLabelSample=elapsed;
      }
      if(!sameContext){drop.context=context;drop.x=drop.anchorX*width;drop.y=drop.anchorY*height;drop.age=0;drop.vx=0;drop.vy=0;drop.alpha=1;drop.displaced=false;drop.lastLabelSample=elapsed;}
      drop.label=label;
      if(timeOffset===0)drop.liveLabel=label;
      if(reduced&&!pinned(drop)&&!drop.external){drop.x=drop.anchorX*width;drop.y=drop.anchorY*height;}
      if(!drop.external)bounds(drop,!!drop.pointer);place(drop);
    }
    for(const [id,drop]of drops){if(!keep.has(id)){
      detach(drop);drops.delete(id);
      const trail=trails.get(id);
      if(trail)for(const node of trail.nodes){if(doc.activeElement!==node.element){holdNode(node,false);node.element?.remove();node.element=null;}}
    }}
    publish();
  }
  function shedWater(drop) {
    if(reduced)return;
    shed.push({id:`shed-${drop.id}-${++shedSequence}`,x:drop.x+(Math.sin(drop.seed+elapsed)*drop.rx*.2),y:drop.y+drop.ry*.8,rx:Math.max(3,Math.min(11,drop.rx*.12)),ry:Math.max(5,Math.min(16,drop.ry*.2)),vx:Math.sin(drop.seed)*3,vy:7,age:0,viscosity:drop.viscosity,kind:drop.kind});
    if(shed.length>8)shed.shift();
  }
  function advance(drop,dt) {
    if(drop.external){measure(drop);drop.alpha=1;drop.phase=pinned(drop)?'caught':'source';return;}
    if(pinned(drop)){drop.alpha=1;drop.phase='caught';drop.vx=0;drop.vy=0;return;}
    if(timeOffset>0){drop.alpha=1;drop.phase='remembering';drop.vx=0;drop.vy=0;return;}
    if(reduced){drop.x=drop.anchorX*width;drop.y=drop.anchorY*height;drop.alpha=1;drop.phase='held';bounds(drop);return;}
    drop.age+=dt;
    const ax=drop.anchorX*width,ay=drop.anchorY*height;
    if(drop.critical){
      drop.phase='source';drop.alpha=1;
      const pull=1-Math.exp(-dt*2.8);
      drop.x+=(ax+Math.sin(elapsed/(14+drop.viscosity)+drop.seed)*1.1-drop.x)*pull;
      drop.y+=(ay+Math.sin(elapsed/(12+drop.viscosity)+drop.seed)*1.8-drop.y)*pull;
      bounds(drop);return;
    }
    drop.phase=drop.age<1.8?'condensing':drop.displaced?'settling':'resting';
    drop.alpha=drop.age<1.8?.8+.2*smooth(drop.age/1.8):1;
    const gravity=material==='dew'?.18:material==='fall'?1.4:material==='pane'?.48:material==='breath'?-.6:.8;
    const wind=Math.sin(elapsed*.085+drop.seed)*1.5*(material==='breath'?2:material==='dew'?.2:1);
    const wetSettle=gravity*6*(1-Math.exp(-drop.age/9))/(.6+drop.viscosity*.55);
    const stiffness=.3/(.6+drop.viscosity*.3),damping=1.15/(.7+drop.viscosity*.15);
    drop.vx+=((ax+wind-drop.x)*stiffness-drop.vx*damping)*dt;
    drop.vy+=((ay+wetSettle-drop.y)*stiffness-drop.vy*damping)*dt;
    for(const current of currents){
      const distance=Math.hypot(drop.x-current.x,drop.y-current.y);
      if(distance<210){const influence=(1-distance/210)*Math.exp(-current.age*2.5)/(.7+drop.viscosity);drop.vx+=current.vx*influence*dt;drop.vy+=current.vy*influence*dt;}
    }
    drop.x+=drop.vx*dt;drop.y+=drop.vy*dt;
    if(drop.displaced&&Math.hypot(drop.x-ax,drop.y-ay)<12)drop.displaced=false;
    // A resting film needs no trail stamping. Only a real displacement deposits
    // a path; old readable values are sampled separately in sync().
    if(elapsed-drop.lastSample>.3&&Math.hypot(drop.vx,drop.vy)>.7)sample(drop,{label:'',readable:false});
    bounds(drop);
  }
  function separate(dt) {
    const all=[...drops.values()];
    for(let a=0;a<all.length;a++)for(let b=a+1;b<all.length;b++){
      const one=all[a],two=all[b];
      if(one.external||two.external)continue;
      let dx=two.x-one.x,dy=two.y-one.y;
      if(Math.abs(dx)+Math.abs(dy)<.01){dx=Math.sin(one.seed+two.seed)*.25;dy=(one.seed%2?1:-1)*.5;}
      const sx=(one.w+two.w)*.52+5,sy=(one.h+two.h)*.52+6;
      const distance=Math.sqrt((dx/sx)**2+(dy/sy)**2);
      if(distance>=1 || distance===0)continue;
      const force=(1-distance)*Math.min(10,dt*80);
      if(!pinned(one)&&!one.critical){one.x-=dx/distance*.035*force;one.y-=dy/distance*.035*force;bounds(one);}
      if(!pinned(two)&&!two.critical){two.x+=dx/distance*.035*force;two.y+=dy/distance*.035*force;bounds(two);}
    }
  }
  function getBodies() {
    const result=[...drops.values()].map(drop=>({id:drop.id,x:drop.x,y:drop.y,rx:drop.rx,ry:drop.ry,vx:drop.vx,vy:drop.vy,alpha:drop.alpha,opacity:drop.alpha,viscosity:drop.viscosity,kind:drop.kind,pinned:pinned(drop),critical:drop.critical,phase:drop.phase,trailId:`trail-${drop.id}`}));
    for(const bit of shed)result.push({...bit,alpha:Math.max(0,1-bit.age/4),opacity:Math.max(0,1-bit.age/4),phase:'falling',pinned:false,critical:false});
    return result;
  }
  function getTrails() {
    const at=elapsed-timeOffset;
    return [...trails.values()].map(trail=>({id:trail.id,ownerId:trail.ownerId,alpha:1,kind:trail.kind,viscosity:trail.viscosity,readOnly:timeOffset>0,nodes:trail.nodes.filter(node=>nodeAlpha(node,at)>.001).map(node=>({x:node.x,y:node.y,r:nodeRadius(node,at),eroded:true,alpha:nodeAlpha(node,at),age:nodeAge(node,at),playRate:timeOffset>0?0:clamp(.25+.65/(trail.viscosity+.5),.3,.75),time:node.time,label:node.label,frame:node.frame}))})).filter(trail=>trail.nodes.length);
  }
  function publish() {
    glass?.setBodies?.(getBodies());glass?.setTrails?.(getTrails());
  }
  function tick(seconds) {
    if(dead||!finite(seconds)||seconds<0)return;
    // Looking back holds the weather clock. The caller owns any game or media
    // clock; no dispatch or resource mutation occurs in this material layer.
    const dt=timeOffset>0?0:Math.min(.15,seconds);elapsed+=dt;
    size();
    for(const current of currents)current.age+=dt;
    while(currents.length&&currents[0].age>1.6)currents.shift();
    for(const drop of drops.values())advance(drop,dt);
    if(!reduced&&timeOffset===0)separate(dt);
    for(const drop of drops.values())place(drop);
    for(let i=shed.length-1;i>=0;i--){const bit=shed[i];bit.age+=dt;bit.vy+=23/(.5+bit.viscosity)*dt;bit.y+=bit.vy*dt;bit.x+=bit.vx*dt;if(bit.age>4||bit.y>height+20)shed.splice(i,1);}
    for(const [id,trail]of trails){
      for(let i=trail.nodes.length-1;i>=0;i--){
        const node=trail.nodes[i];
        // Raw deposition survives its visible erosion for a real lookback.
        // Keep the maximum material lifetime + lookback, not just visible nodes.
        if(nodeAge(node)>20+historyWindow&&!node.held){node.element?.remove();trail.nodes.splice(i,1);continue;}
        if(node.context!==context && !node.held && node.element){node.element.remove();node.element=null;}
        if(node.element){
          const underCurrent=[...drops.values()].some(drop=>Math.abs(drop.x-node.x)<drop.w*.55+24 && Math.abs(drop.y-node.y)<drop.h*.55+18);
          const opacity=node.held?1:underCurrent?0:nodeAlpha(node,elapsed-timeOffset)*.65;
          node.element.style.opacity=String(opacity);node.element.style.pointerEvents=opacity>.07?'auto':'none';node.element.style.visibility=opacity>.07?'visible':'hidden';
          node.element.tabIndex=opacity>.07?0:-1;
        }
      }
      if(!trail.nodes.length&&!drops.has(id))trails.delete(id);
    }
    publish();
  }
  function suppressClick(input) {
    if(input&&typeof input==='object'&&input.detail===0)return false;
    const drop=typeof input==='string'?drops.get(input):[...drops.values()].find(value=>value.element===input?.target||value.element.contains?.(input?.target));
    return !!drop && (drop.pointer?.dragged || elapsed<drop.suppressUntil);
  }
  function captureClick(event) {
    if(suppressClick(event)){event.preventDefault();event.stopImmediatePropagation();}
  }
  host.addEventListener('click',captureClick,true);
  function setReducedMotion(value) {
    reduced=!!value;
    if(reduced){shed.length=0;currents.length=0;}
    for(const drop of drops.values()){
      drop.vx=0;drop.vy=0;drop.age=0;drop.alpha=1;drop.displaced=false;
      if(!pinned(drop)&&!drop.external){drop.x=drop.anchorX*width;drop.y=drop.anchorY*height;bounds(drop);place(drop);}
    }
    publish();
  }
  function setMenuOpen(value) {menuOpen=!!value;host.dataset.rainMenu=String(menuOpen);}
  function setMaterial(value){if(['worms','pane','fall','dew','breath'].includes(value)){material=value;host.dataset.rainMaterial=value;}}
  function setErosion(value){
    if(!finite(value))return erosion;
    erosion=clamp(value,0,1);host.dataset.rainErosion=String(erosion);publish();return erosion;
  }
  function getHistoryRange(){
    const oldest=Math.max(0,elapsed-historyWindow);
    return {oldest,newest:elapsed,available:elapsed-oldest,offset:timeOffset};
  }
  function setTimeOffset(seconds){
    if(!finite(seconds))return timeOffset;
    timeOffset=clamp(seconds,0,getHistoryRange().available);
    host.dataset.rainTimeOffset=String(timeOffset);
    publish();return timeOffset;
  }
  function erodeAt(x,y,radius=36){
    if(timeOffset>0||!finite(x)||!finite(y)||!finite(radius)||radius<=0)return 0;
    let affected=0;
    for(const trail of trails.values())for(const node of trail.nodes){
      const distance=Math.hypot(node.x-x,node.y-y),reach=radius+node.r;
      if(distance>=reach||nodeAlpha(node)<=.001)continue;
      const amount=.22*(1-distance/reach)**2,last=node.cuts.at(-1);
      if(last&&elapsed-last.time<.12)last.amount+=amount;
      else node.cuts.push({time:elapsed,amount});
      // Older cuts coalesce only outside the scrub window; recent cuts retain
      // their exact time so looking back can reveal the un-rubbed trace.
      if(node.cuts.length>64){const first=node.cuts[0],second=node.cuts[1];if(second.time<elapsed-historyWindow){second.amount+=first.amount;node.cuts.shift();}}
      affected++;
    }
    if(affected)publish();return affected;
  }
  function destroy() {
    dead=true;host.removeEventListener('click',captureClick,true);
    for(const drop of drops.values())detach(drop);
    for(const trail of trails.values())for(const node of trail.nodes)node.element?.remove();
    drops.clear();trails.clear();shed.length=0;currents.length=0;
    glass?.setBodies?.([]);glass?.setTrails?.([]);
  }
  return Object.freeze({sync,tick,setReducedMotion,setMenuOpen,setMaterial,setErosion,setTimeOffset,getHistoryRange,erodeAt,suppressClick,getBodies,getTrails,destroy});
}

return Object.freeze({ createRainField });
})();
// Module: weather-memory.js
RainModules["./weather-memory.js"] = (() => {
/**
 * Read-only time held in weather. This module never owns or mutates game state.
 *
 * const memory = createWeatherMemory({windowSeconds:12, erosion:.32});
 * memory.record({scene:'pump', label:'Water arrived', values:{can:12,source:28}});
 * const line = memory.recordDialogue({key:'Daniel:4',speaker:'Daniel',text:'The pump is nearby.'});
 * memory.tick(.25);                       // active session time, not wall time
 * memory.seekAge(4);                      // preview four seconds before now
 * const view = memory.view();             // immutable selected snapshot
 * memory.resume();                        // show the live head; no game Undo
 * memory.holdDialogue(line.id, true);     // reconstitute words while reading
 * memory.holdDialogue(line.id, false);    // begin a fresh erosion envelope
 *
 * view.dialogue = {id,speaker,text,at,age,wetAge,held,phase,opacity,wetness,
 *   erosion,phrases:[{id,index,text,age,opacity,wetness,erosion,
 *   words:[{id,index,text,opacity,wetness,erosion}]}]} or null.
 * Full text and punctuation remain in transcript(), even when visible ink has
 * eroded. Paint phrase/word opacity on the visual spans; expose the full text to
 * assistive technology. All timestamps are seconds on this module's clock.
 */

const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const clone=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
};
const stable=value=>{
  if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';
  return JSON.stringify(value);
};
const clean=(value,max=240)=>String(value??'').trim().slice(0,max);

function splitPhrases(text){
  return (text.match(/[^.!?;\n]+[.!?;]?/gu)||[text]).flatMap(part=>{
    const line=part.trim();
    if(line.length<82)return [line];
    // Preserve every word and mark. Long clauses settle as breath-sized phrases.
    const words=line.split(/\s+/u),pieces=[];let phrase='';
    for(const word of words){
      if(phrase&&phrase.length+word.length>68){pieces.push(phrase);phrase='';}
      phrase+=(phrase?' ':'')+word;
    }
    if(phrase)pieces.push(phrase);
    return pieces;
  }).filter(Boolean);
}

function createWeatherMemory(options={}){
  const windowSeconds=clamp(finite(options.windowSeconds)?options.windowSeconds:90,2,300);
  const maxEvents=Math.round(clamp(finite(options.maxEvents)?options.maxEvents:720,16,2400));
  const maxUtterances=Math.round(clamp(finite(options.maxUtterances)?options.maxUtterances:20,1,100));
  let erosion=clamp(finite(options.erosion)?options.erosion:.32,0,1);
  let now=0,selectedAt=null,sequence=0,firstAt=null;
  const events=[],utterances=[],held=new Set(),rewetTimes=new Map();

  function range(){
    const floor=Math.max(0,now-windowSeconds,firstAt??now);
    // A hard count bound can reduce the available interval under dense input.
    const stateEvents=events.filter(event=>event.values!==null);
    const earliest=stateEvents.length?stateEvents[0].at:events[0]?.at;
    const start=Math.max(floor,earliest??floor);
    return {start,end:now,duration:Math.max(0,now-start),maxAge:Math.max(0,now-start),windowSeconds};
  }
  function point(){const r=range();return selectedAt===null?now:clamp(selectedAt,r.start,now);}
  function prune(){
    const cutoff=Math.max(0,now-windowSeconds);
    // Retain the latest state before the interval: it remains true at its start.
    let carry=-1;
    for(let i=0;i<events.length;i++)if(events[i].at<cutoff&&events[i].values!==null)carry=i;
    for(let i=events.length-1;i>=0;i--)if(events[i].at<cutoff&&i!==carry)events.splice(i,1);
    while(events.length>maxEvents)events.shift();
    while(utterances.length>maxUtterances){
      const removed=utterances.shift();held.delete(removed.id);rewetTimes.delete(removed.id);
    }
    if(selectedAt!==null)selectedAt=clamp(selectedAt,range().start,now);
  }
  function record(input={}){
    if(!input||typeof input!=='object')return null;
    const type=clean(input.type||'state',40),scene=clean(input.scene,40),label=clean(input.label,400);
    let values;
    try{values=clone(input.values);}catch{return null;}
    const signature=clean(input.key,200)||stable({type,scene,label,values});
    const previous=events.findLast(event=>event.type===type);
    if(previous?.signature===signature)return freeze(clone(previous));
    const event={id:'weather-'+(++sequence),type,scene,label,values,at:now,signature};
    if(firstAt===null)firstAt=now;
    events.push(event);prune();
    return freeze(clone(event));
  }
  function recordDialogue(input={}){
    if(!input||typeof input!=='object')return null;
    const text=clean(input.text,2000).replace(/\s+/gu,' '),speaker=clean(input.speaker||'Voice',80),key=clean(input.key,200);
    if(!text)return null;
    const previous=key?utterances.find(entry=>entry.key===key):utterances.at(-1);
    if(previous&&(key||previous.speaker===speaker&&previous.text===text))return freeze(clone(previous));
    const entry={id:'voice-'+(++sequence),key,speaker,text,at:now,scene:clean(input.scene||'dialogue',40)};
    if(firstAt===null)firstAt=now;
    utterances.push(entry);
    // Speech is an event, but it is not a replacement world snapshot.
    events.push({id:entry.id,type:'dialogue',scene:entry.scene,label:speaker+': '+text,values:null,at:now,signature:entry.id});
    prune();return freeze(clone(entry));
  }
  function projection(entry,at=point()){
    if(!entry)return null;
    const isHeld=held.has(entry.id),age=Math.max(0,at-entry.at);
    const rewet=(rewetTimes.get(entry.id)||[]).findLast(time=>time<=at);
    const wetAge=isHeld?1.2:Math.max(0,at-Math.max(entry.at,rewet??entry.at));
    const phrases=splitPhrases(entry.text).map((text,index)=>{
      const start=index*.6,local=wetAge-start,words=text.split(/\s+/u);
      const readFor=clamp(words.length*.32+4.5,6,13);
      const dryTime=erosion===0?Infinity:28-erosion*20;
      const phaseErosion=isHeld?0:smooth((local-readFor)/dryTime);
      const wordFields=words.map((word,wordIndex)=>{
        const born=wordIndex*.026;
        const condensed=isHeld?1:smooth((local-born)/.75);
        // Uneven edges open gaps before the whole phrase thins. This represents
        // visual ink only; its original sentence is never rewritten or deleted.
        const edge=((wordIndex*7+index*3)%11)/10;
        const eroded=phaseErosion===0?0:smooth((phaseErosion-(.14+edge*.35))/.51);
        const wetness=condensed*(1-eroded);
        return {id:entry.id+'-word-'+index+'-'+wordIndex,index:wordIndex,text:word,opacity:wetness,wetness,erosion:eroded};
      });
      const opacity=wordFields.reduce((sum,word)=>sum+word.opacity,0)/Math.max(1,wordFields.length);
      return {id:entry.id+'-phrase-'+index,index,text,age:Math.max(0,local),opacity,wetness:1-phaseErosion,erosion:phaseErosion,words:wordFields};
    });
    const ink=phrases.reduce((sum,phrase)=>sum+phrase.opacity,0)/Math.max(1,phrases.length);
    const loss=phrases.reduce((sum,phrase)=>sum+phrase.erosion,0)/Math.max(1,phrases.length);
    const phase=isHeld?'held':wetAge<.8?'condensing':loss===0?'legible':ink>.04?'eroding':'trace';
    return {...entry,age,wetAge,held:isHeld,phase,opacity:ink,wetness:1-loss,erosion:loss,phrases};
  }
  function view(){
    const at=point(),chosen=events.filter(event=>event.at<=at),state=chosen.findLast(event=>event.values!==null);
    const speech=utterances.findLast(entry=>entry.at<=at);
    return freeze(clone({mode:selectedAt===null?'live':'past',now,at,age:Math.max(0,now-at),range:range(),
      snapshot:state?.values??null,event:state??chosen.at(-1)??null,events:chosen.slice(-12),
      dialogue:projection(speech,at),erosion,readOnly:selectedAt!==null}));
  }
  function seekAge(seconds){
    if(!finite(seconds))return view();
    const r=range();selectedAt=clamp(now-Math.max(0,seconds),r.start,now);
    return view();
  }
  function resume(){selectedAt=null;return view();}
  function tick(seconds){
    if(!finite(seconds)||seconds<0)return view();
    now+=seconds;prune();return view();
  }
  function rewet(id){
    if(!utterances.some(entry=>entry.id===id))return false;
    const times=rewetTimes.get(id)||[];times.push(point());times.sort((a,b)=>a-b);
    if(times.length>12)times.splice(0,times.length-12);rewetTimes.set(id,times);
    return true;
  }
  function holdDialogue(id,hold=true){
    if(!utterances.some(entry=>entry.id===id))return false;
    if(hold)held.add(id);else{held.delete(id);rewet(id);}
    return true;
  }
  function projectDialogue(id){return freeze(clone(projection(utterances.find(entry=>entry.id===id),point())));}
  function setErosion(value){if(finite(value))erosion=clamp(value,0,1);return erosion;}
  function transcript(){return freeze(clone(utterances));}
  return Object.freeze({record,recordDialogue,tick,seekAge,resume,setErosion,view,getSnapshot:view,
    getHistoryRange:()=>freeze(range()),transcript,rewet,holdDialogue,projectDialogue});
}

return Object.freeze({ createWeatherMemory });
})();
// Module: trace-ink.js
RainModules["./trace-ink.js"] = (() => {
/**
 * Words are deposits in a drawn wet path, never labels on a moving head.
 *
 * arm({id,text,x,y,keyboard}) starts a held gesture. Re-arming that held id
 * updates its latest value, keeping the first value. hold(id,false) commits it.
 * setTrails(rainField.getTrails()) supplies real ownerId deposition geometry.
 * A pointer mark appears only when its path exceeds 80px. Complete words flow
 * into at most two 16px filaments; more words emerge as the path grows. Exact
 * full text is retained even when the current trace is short. Keyboard focus makes an edge
 * filament immediately. SVG is decoration; the native semantic node owns ARIA.
 */
const SVG='http://www.w3.org/2000/svg';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const hash=value=>[...String(value)].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,17);
const segment=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);

function sampleTracePath(nodes,{startTime=-Infinity,minDistance=2,maxPoints=120}={}){
  const points=[];
  for(const node of nodes||[]){
    if(!finite(node?.x)||!finite(node?.y)||(finite(node.time)&&node.time<startTime))continue;
    const point={x:node.x,y:node.y};
    if(!points.length||segment(points.at(-1),point)>=minDistance)points.push(point);
    else if(points.length>1)points[points.length-1]=point;
  }
  if(points.length<=maxPoints)return points;
  return Array.from({length:maxPoints},(_,i)=>points[Math.round(i*(points.length-1)/(maxPoints-1))]);
}
const traceLength=points=>(points||[]).reduce((sum,p,i)=>sum+(i?segment(points[i-1],p):0),0);

function tracePointAt(points,distance){
  if(!points?.length)return{x:0,y:0};
  let remaining=Math.max(0,distance);
  for(let i=1;i<points.length;i++){
    const length=segment(points[i-1],points[i]);
    if(remaining<=length&&length>0){const t=remaining/length;return{x:points[i-1].x+(points[i].x-points[i-1].x)*t,y:points[i-1].y+(points[i].y-points[i-1].y)*t};}
    remaining-=length;
  }
  return{...points.at(-1)};
}

function tracePath(points,offset=0){
  if(!points?.length)return'';
  const ordered=[...points];
  const first=ordered[0],last=ordered.at(-1);
  if(last.x-first.x<-.01||(Math.abs(last.x-first.x)<.01&&last.y<first.y))ordered.reverse();
  const shifted=ordered.map((p,i)=>{
    const a=ordered[Math.max(0,i-1)],b=ordered[Math.min(ordered.length-1,i+1)];
    const length=segment(a,b)||1;
    return{x:p.x-(b.y-a.y)/length*offset,y:p.y+(b.x-a.x)/length*offset};
  });
  const xy=p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  let d=`M ${xy(shifted[0])}`;
  for(let i=1;i<shifted.length-1;i++){
    const mid={x:(shifted[i].x+shifted[i+1].x)/2,y:(shifted[i].y+shifted[i+1].y)/2};
    d+=` Q ${xy(shifted[i])} ${xy(mid)}`;
  }
  if(shifted.length>1)d+=` L ${xy(shifted.at(-1))}`;
  return d;
}

const defaultMeasure=text=>[...text].reduce((width,c)=>width+( "ilI.,' :;".includes(c)?4.5:/[MW@]/.test(c)?14:8.3),0);

/** No glyph clipping or shrinking: full words fit, remaining words wait for more path. */
function layoutTraceText(text,length,measure=defaultMeasure){
  const full=String(text??'').trim(),available=Math.max(0,length-18);
  if(!full||length<80)return{lines:[],remaining:full};
  if(measure(full)<=available)return{lines:[full],remaining:''};
  let best=null;
  for(let split=1;split<full.length;split++){
    if(full[split]!==' ')continue;
    const first=full.slice(0,split).trimEnd(),second=full.slice(split+1).trimStart();
    const a=measure(first),b=measure(second);
    if(a<=available&&b<=available&&(!best||Math.abs(a-b)<best.imbalance))best={lines:[first,second],imbalance:Math.abs(a-b)};
  }
  if(best)return{lines:best.lines,remaining:''};
  const words=full.split(/\s+/),lines=[];
  while(words.length&&lines.length<2){
    let line='';
    while(words.length&&measure([line,words[0]].filter(Boolean).join(' '))<=available)line=[line,words.shift()].filter(Boolean).join(' ');
    if(!line)break;
    lines.push(line);
  }
  return{lines,remaining:words.join(' ')};
}
const fitTraceText=(text,length,measure=defaultMeasure)=>layoutTraceText(text,length,measure).lines;

function createTraceInk({host}={}){
  if(!host?.ownerDocument?.createElementNS)throw new TypeError('TraceInk needs a positioned DOM host.');
  const doc=host.ownerDocument;
  const svg=doc.createElementNS(SVG,'svg'),defs=doc.createElementNS(SVG,'defs');
  svg.setAttribute('class','trace-ink');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',overflow:'visible',pointerEvents:'none',zIndex:'7'});
  svg.append(defs);host.append(svg);
  const marks=[],active=new Map();
  const recentTrails=new Map();
  let elapsed=0,offset=0,erosion=.32,sequence=0,width=1,height=1,dead=false;
  let measure=defaultMeasure;
  try{
    const canvas=doc.createElement?.('canvas'),ctx=canvas?.getContext?.('2d');
    if(ctx){ctx.font='16px Georgia, serif';measure=text=>ctx.measureText(text).width;}
  }catch{}
  const key=node=>node?`${node.time}:${node.x}:${node.y}`:null;
  function size(){const rect=host.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);svg.setAttribute('viewBox',`0 0 ${width} ${height}`);}
  size();
  function ageAt(mark,at){return Math.max(0,at-mark.born-mark.holds.reduce((sum,hold)=>sum+Math.max(0,Math.min(at,hold.end??at)-hold.start),0));}
  function wetness(mark,at){if(mark.inspection&&mark.held)return 1;if(at<mark.born)return 0;return clamp(1-ageAt(mark,at)/(30-20*erosion),0,1);}
  function fullText(mark){return mark.initialText===mark.text?mark.text:`${mark.initialText}  /  ${mark.text}`;}
  function keyboardPath(mark){
    const textWidth=measure(fullText(mark));
    const length=Math.min(width-32,Math.max(150,textWidth/2+30));
    const x=clamp(mark.x-length*.5,16,Math.max(16,width-length-16));
    const y=clamp(mark.y+30,28,height-60);
    return[{x,y},{x:x+length*.35,y:y-3},{x:x+length*.7,y:y+3},{x:x+length,y}];
  }
  function removeMark(mark){mark.group?.remove();for(const path of mark.paths||[])path.remove();if(active.get(mark.id)===mark)active.delete(mark.id);}
  function arm({id,text,x,y,kind='water',keyboard=false,inspection=false}={}){
    if(dead||!id||!finite(x)||!finite(y))return null;
    const exact=String(text??'').trim();if(!exact)return null;
    let mark=active.get(String(id));
    if(mark?.held){mark.text=exact;if(keyboard)mark.points=keyboardPath(mark);else if(segment(mark.points.at(-1),{x,y})>2)mark.points=sampleTracePath([...mark.points,{x,y}]);mark.dirty=true;render();return mark.key;}
    inspection=inspection||String(id)==='time-current';
    if(offset>0&&!inspection)return null;
    const existing=recentTrails.get(String(id))?.nodes||[];
    mark={key:`ink-${++sequence}`,id:String(id),initialText:exact,text:exact,x,y,kind,keyboard:!!keyboard,inspection,born:elapsed,held:true,holds:[{start:elapsed,end:null}],points:[{x,y}],baseline:key(existing.at(-1)),baselineTime:existing.at(-1)?.time??-Infinity,finalizing:false,done:false,dirty:true,rubs:[],group:null,paths:[],glyphs:[],ready:false,remaining:exact,lastWet:-1};
    if(keyboard)mark.points=keyboardPath(mark);
    marks.push(mark);active.set(mark.id,mark);
    const budget=width<600?18:30;
    while(marks.length>budget){const index=marks.findIndex(value=>!value.held);if(index<0)break;removeMark(marks[index]);marks.splice(index,1);}
    render();return mark.key;
  }
  function hold(id,value){
    const mark=active.get(String(id))||[...marks].reverse().find(mark=>mark.id===String(id));
    if(!mark)return;
    if(!value&&mark.inspection){removeMark(mark);marks.splice(marks.indexOf(mark),1);return;}
    if(value&&!mark.held){mark.held=true;mark.holds.push({start:elapsed,end:null});active.set(String(id),mark);}
    if(!value&&mark.held){mark.held=false;mark.holds.at(-1).end=elapsed;mark.finalizing=true;active.delete(mark.id);}
    render();
  }
  function setTrails(trails=[]){
    if(dead)return;
    if(offset===0){
      for(const trail of trails)if(trail.ownerId)recentTrails.set(String(trail.ownerId),trail);
      for(const mark of marks){
        if(mark.keyboard||mark.done||(!mark.held&&!mark.finalizing))continue;
        const nodes=recentTrails.get(mark.id)?.nodes||[];
        const index=mark.baseline===null?-1:nodes.findIndex(node=>key(node)===mark.baseline);
        const relevant=index>=0?nodes.slice(index+1):nodes.filter(node=>node.time>=mark.baselineTime);
        const next=sampleTracePath([{x:mark.x,y:mark.y},...relevant]);
        if(next.length>1&&traceLength(next)>=traceLength(mark.points)){mark.points=next;mark.dirty=true;}
        if(mark.finalizing){mark.done=true;mark.finalizing=false;}
      }
    }
    render();
  }
  function construct(mark){
    mark.dirty=false;
    mark.group?.remove();for(const path of mark.paths)path.remove();
    mark.paths=[];mark.glyphs=[];
    let length=traceLength(mark.points);
    // Fit the rendered curve, not its longer control polygon. Browser path
    // metrics include the rounding at bends; the deterministic fallback serves
    // non-browser tests and unavailable geometry APIs.
    const metric=doc.createElementNS(SVG,'path');metric.setAttribute('d',tracePath(mark.points));defs.append(metric);
    try{const curved=metric.getTotalLength?.();if(finite(curved)&&curved>0)length=Math.min(length,curved);}catch{}
    metric.remove();
    const {lines,remaining}=layoutTraceText(fullText(mark),length,measure);mark.remaining=remaining;
    mark.lastWet=-1;
    mark.ready=lines.length>0;
    if(!mark.ready){mark.group=null;return;}
    const group=doc.createElementNS(SVG,'g');group.setAttribute('data-trace-owner',mark.id);group.setAttribute('data-ink-id',mark.key);svg.append(group);mark.group=group;
    lines.forEach((line,lineIndex)=>{
      const path=doc.createElementNS(SVG,'path'),pathId=`${mark.key}-line-${lineIndex}`;
      path.setAttribute('id',pathId);path.setAttribute('d',tracePath(mark.points,lineIndex*22));defs.append(path);mark.paths.push(path);
      const thread=doc.createElementNS(SVG,'use');thread.setAttribute('href',`#${pathId}`);thread.setAttribute('fill','none');thread.setAttribute('stroke','rgba(181,235,230,.17)');thread.setAttribute('stroke-width','1.2');group.append(thread);
      const text=doc.createElementNS(SVG,'text');text.setAttribute('font-family','Georgia, serif');text.setAttribute('font-size','16');text.setAttribute('fill',mark.kind==='voice'?'#e8e0ce':'#d9eeea');text.setAttribute('stroke','rgba(3,18,24,.62)');text.setAttribute('stroke-width','1.6');text.setAttribute('paint-order','stroke');text.style.whiteSpace='pre';
      const textPath=doc.createElementNS(SVG,'textPath');textPath.setAttribute('href',`#${pathId}`);textPath.setAttribute('startOffset','8');
      let distance=8;
      [...line].forEach((char,index)=>{
        const glyph=doc.createElementNS(SVG,'tspan');glyph.textContent=char;textPath.append(glyph);
        const advance=measure(char);mark.glyphs.push({element:glyph,seed:hash(`${mark.key}:${lineIndex}:${index}`),point:tracePointAt(mark.points,distance+advance*.5),line:lineIndex});distance+=advance;
      });
      text.append(textPath);group.append(text);
    });
  }
  function render(){
    if(dead)return;
    const at=elapsed-offset;
    for(const mark of marks){
      if(mark.dirty)construct(mark);
      if(!mark.group)continue;
      const wet=wetness(mark,at);
      if(Math.abs(wet-mark.lastWet)<.002&&!mark.rubDirty)continue;
      mark.lastWet=wet;mark.rubDirty=false;
      mark.group.setAttribute('opacity',String(wet>0?1:0));
      let previousShift=0,previousLine=-1;
      for(const glyph of mark.glyphs){
        const grain=(glyph.seed%997)/997;
        const threshold=.12+grain*.5;
        let alpha=clamp((wet-threshold)/(1-threshold),0,1);
        for(const rub of mark.rubs){if(rub.time>at)continue;const distance=segment(glyph.point,rub);alpha*=clamp(distance/rub.radius,0,1)**2;}
        const shift=(1-wet)*erosion*((glyph.seed%9)-4)*.7;
        if(glyph.line!==previousLine)previousShift=0;
        glyph.element.setAttribute('opacity',String(alpha));glyph.element.setAttribute('dy',String(shift-previousShift));glyph.element.setAttribute('rotate',String((1-wet)*erosion*((glyph.seed%7)-3)));
        previousShift=shift;previousLine=glyph.line;
      }
    }
  }
  function tick(seconds){
    if(dead||!finite(seconds)||seconds<0)return;
    if(offset===0)elapsed+=Math.min(.15,seconds);
    size();
    for(let index=marks.length-1;index>=0;index--)if(!marks[index].held&&ageAt(marks[index],elapsed)>42){removeMark(marks[index]);marks.splice(index,1);}
    render();
  }
  function setErosion(value){if(finite(value))erosion=clamp(value,0,1);render();return erosion;}
  function setTimeOffset(seconds){if(finite(seconds))offset=clamp(seconds,0,Math.min(elapsed,12));render();return offset;}
  function rub(x,y,radius=36){
    if(offset>0||!finite(x)||!finite(y)||!finite(radius)||radius<=0)return 0;
    let affected=0;
    for(const mark of marks){if(mark.glyphs.some(glyph=>segment(glyph.point,{x,y})<radius&&Number(glyph.element.getAttribute('opacity'))>.01)){mark.rubs.push({x,y,radius,time:elapsed});mark.rubDirty=true;affected++;if(mark.rubs.length>24)mark.rubs.shift();}}
    render();
    return affected;
  }
  function getMarks(){return marks.map(mark=>({id:mark.id,key:mark.key,text:mark.text,initialText:mark.initialText,fullText:fullText(mark),remaining:mark.remaining,ready:mark.ready,held:mark.held,age:ageAt(mark,elapsed-offset),opacity:wetness(mark,elapsed-offset),length:traceLength(mark.points),points:mark.points.map(point=>({...point}))}));}
  function getTrails(){return marks.filter(mark=>(mark.keyboard||mark.held)&&mark.ready&&wetness(mark,elapsed-offset)>0).map(mark=>({id:`filament-${mark.key}`,ownerId:mark.id,kind:mark.kind,alpha:wetness(mark,elapsed-offset)*.35,nodes:mark.points.map(point=>({...point,r:3,age:ageAt(mark,elapsed-offset),time:mark.born,alpha:1}))}));}
  function clear(){for(const mark of marks)removeMark(mark);marks.length=0;active.clear();recentTrails.clear();}
  function destroy(){clear();dead=true;svg.remove();}
  return Object.freeze({arm,setTrails,tick,setErosion,setTimeOffset,hold,rub,clear,getMarks,getTrails,destroy});
}

return Object.freeze({ sampleTracePath, traceLength, tracePointAt, tracePath, layoutTraceText, fitTraceText, createTraceInk });
})();

})();
