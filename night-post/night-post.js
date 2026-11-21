/* THRESHOLD · MONOLITH-3 Open World × Donkey Water Sci-Fi × 11 Tonal Zone Worlds
 * - Streams real USGS Grand Teton (Snake River Overlook, Bluff Trail, Silver Ford, Oxbow, Far-Bank)
 *   and Yosemite Half Dome terrain, planar-reflected river, and 11,800+ instanced trees/stones from ../MONOLITH-3.html.
 * - Physics & Collisions OFF: crisp cruiser 1940s Woody Station Wagon with Mistletoe riding the roof-deck.
 * - Donkey Base-Jumping & Rogallo Valley Fly-Glide (KeyJ / cliff launch) with wingtip cyan contrails.
 * - WiFi Water Cyan Rain strictly constrained to active Donkey / Cistern Relay / Filmstrip Forest coverage domes.
 * - 14 High-Definition GPU Zone Shaders, Live IN-FRAME WIFI % 8x10 Viewfinder & Cyan Jerikan Over Cosmic Addis tape deck. */
(function () {
  "use strict";
  const T = window.THREE;
  const TAU = Math.PI * 2;
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const fract = v => v - Math.floor(v);
  const hash2 = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7 + 4.3) * 43758.5453123);
  function seedRandom(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }
  function inside(bounds, x, z) {
    const [west, east, south, north] = bounds;
    return x >= west && x <= east && z >= -north && z <= -south;
  }

  /* ---------- Exact MONOLITH-3 Shaders (from monolith3/game.js) ---------- */
  const noiseGLSL = `
float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float noise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x),
             mix(hash21(i + vec2(0,1)), hash21(i + 1.), f.x), f.y);
}
float fbm(vec2 p) {
  mat2 turn = mat2(.80, .60, -.60, .80);
  return noise2(p) * .53
       + noise2(turn * p * 2.07 + 17.) * .26
       + noise2(turn * turn * p * 4.19 + 31.) * .14
       + noise2(p * 8.13 + 10.) * .07;
}
float film(float linearValue) {
  float gamma = pow(max(linearValue, 0.), .44);
  float toe = smoothstep(0., .16, gamma);
  return clamp(gamma * mix(.70, 1., toe) * .98 + .012, .012, .96);
}
float paper(float gray) {
  float grain = hash21(gl_FragCoord.xy + 31.7) - .5;
  return clamp(gray + grain * (.019 + .010 * (1. - gray)), 0., 1.);
}`;

  const stormGLSL = `
uniform float uTime;
uniform sampler2D uSky;
uniform float uGlass;
uniform vec3 sun;
float skyPlate(vec2 uv) {
  vec2 drift = vec2((uTime-8.)*.0027,-(uTime-8.)*.0008);
  vec2 place = vec2(.065,.025) + uv * vec2(.865,.89) + drift;
  float photo = texture2D(uSky,place).r;
  float sky=mix(.10,.85,pow(photo,.95));
  return sky*(1.-.58*step(2.5,uGlass)*step(uGlass,3.5));
}
float lightWindow(vec2 p) {
  vec2 q = (p + vec2(-uTime * 66., uTime * 17.)) * .00019;
  float bank = fbm(q + vec2(14.6,-2.8));
  float breakX = -1350. - uTime*39.;
  vec2 window=(p-vec2(breakX,400.))*vec2(.00066,.00055);
  float opening = exp(-dot(window,window));
  return (.40 + .42*smoothstep(.37,.71,bank) + .33*opening)*(.64+.52*sun.y);
}`;

  const meshVertex = `
varying vec3 vWorld, vNormal;
varying vec2 vUV;
void main() {
  vWorld = (modelMatrix * vec4(position,1.)).xyz;
  vNormal = mat3(modelMatrix) * normal;
  vUV = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld,1.);
}`;

  const skyVertex = `
varying vec2 vUV;
void main() {
  vUV = uv;
  gl_Position = vec4(position.xy, .999995, 1.);
}`;

  const surfaceGLSL = `
uniform sampler2D uRock, uScree, uGround, uCobbles, uGeology, uCanopy, uFlow, uGravel;
uniform vec4 uGeoBounds, uCanopyBounds, uFlowBounds;
vec2 fieldUV(vec2 xz, vec4 bounds) {
  return (xz - bounds.xy) * bounds.zw;
}
float inField(vec2 uv) {
  return step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
}
vec3 triplanar(sampler2D detail, vec3 p, vec3 n) {
  vec3 weights = pow(abs(n),vec3(4.));
  weights /= dot(weights,vec3(1.));
  return texture2D(detail,p.yz*vec2(.79,.89)).rgb*weights.x
       + texture2D(detail,p.xz).rgb*weights.y
       + texture2D(detail,p.xy*vec2(.91,.83)).rgb*weights.z;
}
vec3 bumpFromHeight(vec3 position, vec3 normal, float height, float strength) {
  vec3 dx = dFdx(position), dy = dFdy(position);
  vec3 rx = cross(dy,normal), ry = cross(normal,dx);
  float det = dot(dx,rx);
  vec3 gradient = sign(det)*(dFdx(height)*rx+dFdy(height)*ry);
  return normalize(abs(det)*normal - gradient*strength);
}
float air(float dist, float height) {
  return (1. - exp(-dist*.000033)) * (1. - smoothstep(70.,2190.,height)*.81);
}
float hazeValue(vec2 xz) {
  return .087 + .035 * lightWindow(xz);
}
vec3 gravelSample(vec2 p) {
  vec2 turn=mat2(.71,-.71,.71,.71)*p;
  vec3 coarse=texture2D(uCobbles,turn*.117).rgb;
  vec3 fine=texture2D(uCobbles,p*.37+vec2(.39,.18)).rgb;
  return mix(coarse,fine,.44);
}
float willowClumps(vec2 p) {
  vec2 scaled=p*.28;
  vec2 cell=floor(scaled);
  float d=2.;
  for(int j=0;j<2;j++)for(int i=0;i<2;i++) {
    vec2 n=cell+vec2(float(i),float(j));
    vec2 offset=vec2(hash21(n+12.1),hash21(n+26.5))-.5;
    vec2 diff=(scaled-n-offset*.68)*vec2(1.12,.83);
    float size=mix(.58,1.17,hash21(n+2.7));
    d=min(d,length(diff)*size);
  }
  return 1.-smoothstep(.12,.36,d);
}`;

  const printTerrainFragment = `
varying vec3 vWorld, vNormal;
varying vec2 vUV;
uniform sampler2D uSurface;
uniform sampler2D uMountainRelief;
uniform vec4 uMountainBounds;
uniform float uUnlit;
${noiseGLSL}
${stormGLSL}
${surfaceGLSL}
void main() {
  vec3 p = vWorld;
  vec3 n = normalize(vNormal);
  vec2 local = p.xz;
  vec3 fields = texture2D(uSurface,vUV).rgb;
  vec2 flowUV = fieldUV(local,uFlowBounds);
  float flowCoverage = inField(flowUV);
  float bank = texture2D(uFlow,flowUV).b*flowCoverage*160. - 32.;
  float aerial = fields.r;
  float d = length(cameraPosition - p);
  float slope = 1. - n.y;
  float cloudLight = lightWindow(local);
  vec3 form = texture2D(uGeology,fieldUV(local,uGeoBounds)).rgb;
  vec2 foliageUV = fieldUV(local,uCanopyBounds);
  vec3 canopy = texture2D(uCanopy,foliageUV).rgb*inField(foliageUV);
  float bankGravel=(1.-smoothstep(3.,19.,abs(bank)))*flowCoverage;
  float alpine = smoothstep(255.,800.,p.y);
  float nearLand = 1.-smoothstep(1000.,4700.,d);
  vec2 bar=texture2D(uGravel,flowUV).rg*flowCoverage;
  float exposedBar=bar.x;
  float wash = fbm(vec2(local.x*.005+2.,local.y*.006));
  float rockFace = alpine*smoothstep(.035,.42,slope);
  float softFloor = (1.-alpine)*(1.-bankGravel);
  vec3 faceCoarse = triplanar(uRock,p/288. + vec3(.08,.16,.07),n);
  vec3 faceFine = triplanar(uRock,p/68. + vec3(.17,.09,.13),n);
  vec3 scree = triplanar(uScree,p/104. + vec3(.07,.31,.24),n);
  vec3 floor = vec3(.52,.55,.78);
  if (nearLand > .002) {
    vec3 closeFloor = texture2D(uGround,local*.19).rgb;
    vec3 soil = texture2D(uScree,local*.069 + vec2(.26,.17)).rgb;
    floor = mix(mix(soil,closeFloor,.69),soil,min(1.,.48*wash+bankGravel*.38+exposedBar*.64));
  }
  float rockRelief = (faceCoarse.g - .52)*13.7 + (faceFine.g - .51)*2.2;
  rockRelief = mix((scree.g-.5)*4.9,rockRelief,rockFace);
  float gravelCover=max(bankGravel,exposedBar);
  vec3 cobble=vec3(.5);
  if(gravelCover>.005)cobble=gravelSample(local);
  float clumps=0.;
  if(bar.y>.03)clumps=willowClumps(local);
  float shrub=clumps*smoothstep(.16,.63,bar.y);
  float leafLitter=mix((floor.g-.5)*.53,(cobble.g-.5)*.54+shrub*.23,gravelCover)*nearLand;
  vec3 litNormal = bumpFromHeight(p,n,mix(leafLitter,rockRelief,alpine),.72);
  float diff = max(0.,dot(litNormal,sun));
  float formShade = 1.-form.g*.61*alpine;
  float weather = cloudLight * formShade;
  float rockLum = (.019 + .104 * pow(mix(scree.r,faceCoarse.r,rockFace),1.8)) * mix(.64,1.12,faceFine.r);
  rockLum *= .68 + .37*mix(scree.b,faceCoarse.b,rockFace);
  vec2 mountainUV=fieldUV(local,uMountainBounds);
  float mapped=alpine*inField(mountainUV);
  vec3 relief=texture2D(uMountainRelief,mountainUV).rgb;
  float leftExposure=smoothstep(2200.,6400.,p.z);
  float snowHeight = 920. + 300.*(wash-.5) - 270.*n.z - 290.*leftExposure + 190.*smoothstep(2000.,4200.,-p.z);
  float snowBase = smoothstep(snowHeight-90.,snowHeight+345.,p.y);
  float mineral=triplanar(uRock,p/141. + vec3(.18,.50,.62),n).g;
  float crack = mix(faceCoarse.g,faceFine.g,.34) + .66*form.r - .27*form.b + .24*(mineral-.5);
  float gullies=relief.r*.66-relief.b*.32+(mineral-.5)*.32+.34*form.r+.40;
  crack=mix(crack,gullies,mapped*.58);
  float snow = snowBase * smoothstep(.48,.70,crack) * (1.-smoothstep(.43,.89,slope));
  float drift=snowBase*smoothstep(.22,.71,relief.r)*(1.-smoothstep(.54,.88,relief.b));
  snow=max(snow,drift*mapped*.46);
  float rockShade = rockLum * (.17 + 1.16*diff*weather);
  float snowShade = (.28 + .74 * diff*weather) * (.58 + .39*faceFine.g + .14*form.r);
  rockShade*=mix(1.,.43+.74*relief.g+.17*relief.b,mapped*.86);
  snowShade*=mix(1.,.67+.89*relief.g,mapped*.68);
  float alpineShade = mix(rockShade,snowShade,snow);
  float landBase = pow(max(aerial,.025),1.79) * (.69 + .42*wash);
  float wetReach=flowCoverage*smoothstep(-2.65,-.16,bank+(cobble.g-.5)*1.1);
  float sediment=fbm(local*vec2(.109,.096)+vec2(6.1,-9.3));
  float gravel=(.056+.185*pow(cobble.r,1.42))*(.55+.71*cobble.b)*(.72+.51*sediment);
  gravel*=1.-.72*shrub-.12*smoothstep(.31,.79,bar.y);
  gravel*=1.-.35*wetReach;
  float ground=mix(landBase*(.64+.58*floor.r),gravel,gravelCover*.96);
  float shadow = 1.-canopy.b*.50*(1.-exposedBar);
  float landShade = ground * (.52 + .66*diff*weather) * shadow * (1.+.16*exposedBar);
  landShade *= 1.-canopy.g*.20*(1.-exposedBar);
  float value = mix(landShade,alpineShade,alpine);
  float lowMist=air(d,p.y)*(1.-.46*mapped);
  value = mix(value,hazeValue(local),lowMist*.61);
  float nearShade = 1.-smoothstep(78.,450.,d);
  value *= 1.-nearShade*.78;
  value += nearShade*softFloor * .006 * (floor.r+.21)*floor.b;
  gl_FragColor = vec4(vec3(paper(film(value))),1.);
}`;

  const riverFragment = `
varying vec3 vWorld;
varying vec2 vUV;
uniform sampler2D uFlowCoordinates;
uniform vec3 uForward, uRight, uUp;
uniform vec2 uShift;
uniform float uTan, uAspect, uUnlit;
uniform vec2 uReflectionSize;
uniform sampler2D uBankReflection, uReachBed;
uniform vec4 uReachBounds;
uniform mat4 uReflectionCamera;
${noiseGLSL}
${stormGLSL}
${surfaceGLSL}
vec2 wave(vec2 p,vec2 dir,float wavelength,float steepness,float offset,float speed) {
  float phase = dot(p,dir)*(6.2831853/wavelength) + offset - uTime*speed;
  float footprint = fwidth(phase);
  float fade = 1. - smoothstep(.42,2.5,footprint);
  return dir * (cos(phase)*steepness*fade);
}
float skyRadiance(vec3 ray) {
  float forward = max(.035,dot(ray,uForward));
  vec2 ndc = vec2(dot(ray,uRight)/(uTan*uAspect),dot(ray,uUp)/uTan)/forward;
  vec2 uv = ndc*.5+.5+vec2(uShift.x,-uShift.y);
  float leftOpening=(uv.x-.30)*2.44;
  float horizon = .33 + .26*exp(-leftOpening*leftOpening);
  float tone = skyPlate(vec2(clamp(uv.x,-.08,1.10),clamp((uv.y-.48)/.52,0.,1.)));
  float cloudAngle = skyPlate(vec2(clamp(uv.x*.77+.13,-.06,1.08),clamp((uv.y-.47)*1.22,0.,1.)));
  return mix(horizon,pow(.65*tone+.35*cloudAngle,1.58),smoothstep(.008,.215,ray.y));
}
float reachDepth(vec3 p,float bank) {
  float estimate=2.18*(1.-exp(-max(0.,bank)/12.5));
  vec2 uv=fieldUV(p.xz,uReachBounds);
  vec3 packedBed=texture2D(uReachBed,uv).rgb*255.;
  float bed=(packedBed.r*256.+packedBed.g)*.1+packedBed.b*.02-120.;
  return mix(estimate,clamp(p.y-bed,0.,3.4),inField(uv));
}
float reflectedScene(vec3 p,vec3 ray,vec2 g,float roughness,float fallback) {
  vec4 q=uReflectionCamera*vec4(p,1.);
  vec2 uv=q.xy/max(.001,q.w)*.5+.5;
  uv+=vec2(g.x*.23+g.y*.07,g.y*.17-g.x*.06);
  float valid=smoothstep(0.,.025,min(uv.x,1.-uv.x))*smoothstep(0.,.025,min(uv.y,1.-uv.y));
  vec2 spread=(2.+5.5*roughness)/uReflectionSize;
  float reflected=.40*texture2D(uBankReflection,uv).r
    +.16*texture2D(uBankReflection,uv+vec2(spread.x,spread.y)).r
    +.16*texture2D(uBankReflection,uv-vec2(spread.x,spread.y)).r
    +.14*texture2D(uBankReflection,uv+vec2(spread.x,-spread.y)).r
    +.14*texture2D(uBankReflection,uv+vec2(-spread.x,spread.y)).r;
  float linearValue=pow(clamp((reflected-.012)/.98,0.,1.),1./.44);
  return mix(fallback,linearValue,valid*(1.-.52*smoothstep(.06,.23,ray.y)));
}
void main() {
  vec3 p = vWorld;
  vec2 pos = p.xz;
  vec3 info = texture2D(uFlow,vUV).rgb;
  float toBank = info.b*160. - 32.;
  float coverage=smoothstep(-2.65,-.75,toBank);
  if(coverage < .01) discard;
  vec2 f = info.rg*2. - 1.;
  vec2 stream = normalize(f+vec2(.0001));
  vec2 across = vec2(-stream.y,stream.x);
  vec4 flowUV = texture2D(uFlowCoordinates,vUV)*255.;
  vec2 q = vec2((flowUV.r*256.+flowUV.g)*.25,(flowUV.b*256.+flowUV.a)/18.-420.);
  float swell = fbm(pos*.016+vec2(-uTime*.06,0.));
  vec2 drifting=pos-stream*uTime*.41;
  float chop=noise2(drifting*vec2(.28,.36)+vec2(6.7,-1.4));
  float shear=noise2(drifting*vec2(.42,.19)+vec2(8.3,1.3));
  q+=vec2(5.3,-4.7)*(swell-.5)+vec2(chop-.5,shear-.5)*2.3;
  vec2 gradient = wave(q,normalize(vec2(.37,.93)),3.3,.022,5.4*swell+3.8*chop,1.44)
                + wave(q,normalize(vec2(.59,-.80)),2.6,.024,4.6*swell+3.7*shear,2.97)
                + wave(q,normalize(vec2(.27,.96)),1.31,.032,2.3*swell+1.6*chop,5.35)
                + wave(q,normalize(vec2(.93,.37)),1.81,.038,5.1*swell+2.9*shear,4.37)
                + wave(q,normalize(vec2(.81,.59)),1.04,.030,7.7*swell,6.9)
                + wave(q,normalize(vec2(.64,-.77)),.76,.028,2.1*swell,9.2);
  float rough=noise2(drifting*.53);
  vec2 flicker=vec2(chop-shear,shear+rough-1.);
  gradient+=flicker*.085*(1.-smoothstep(.08,.8,length(fwidth(drifting))));
  float bankDepth=2.18*(1.-exp(-max(0.,toBank)/12.5));
  float edge=1.-smoothstep(.05,1.13,bankDepth);
  gradient *= (.64+.94*swell)*(1.-.55*edge);
  vec2 g = stream*gradient.x + across*gradient.y;
  vec3 n = normalize(vec3(-g.x,1.,-g.y));
  vec3 v = normalize(cameraPosition-p);
  vec3 ray = reflect(-v,n);
  float d = length(cameraPosition-p);
  float f0 = .0204;
  float ndv = clamp(dot(n,v),0.,1.);
  float fresnel = f0 + (1.-f0)*pow(1.-ndv,5.);
  float sky = skyRadiance(ray);
  float cloudLight = lightWindow(pos);
  vec2 bendLight=(pos-vec2(-830.,122.))*vec2(.00084,.0028);
  float lightOnBend=exp(-dot(bendLight,bendLight));
  float farOpening=(p.x+1790.)*.00071;
  float fartherBend=exp(-farOpening*farOpening);
  float openReflection=(.21+.79*sky)*(.76+.39*lightOnBend+.27*fartherBend);
  float bankEnvironment=reflectedScene(p,ray,g,swell,openReflection);
  float reflectionWeight=(.58+.24*edge)*(1.-.54*fartherBend);
  float reflected=mix(openReflection,bankEnvironment,reflectionWeight);
  float vertical=reachDepth(p,toBank);
  float path=vertical/max(.14,ndv);
  float shallow=1.-smoothstep(.05,1.30,min(vertical,bankDepth));
  vec3 sediment=gravelSample(pos+refract(-v,n,1./1.333).xz*min(.83,vertical));
  float gravel=(.034+.098*pow(sediment.r,1.24))*(.69+.41*sediment.b);
  float through=exp(-.68*min(path,6.));
  float base=mix(.080+.040*swell,gravel,through*shallow*.78);
  float radiance=mix(base,reflected,clamp(fresnel*1.22+.10,0.,1.));
  vec3 sunPatch = normalize(vec3(-.93,.23,.28));
  float spec = pow(max(0.,dot(ray,sunPatch)),105.);
  radiance += spec*.077*(.28+lightOnBend)*cloudLight*(1.-edge*.66);
  vec2 nearLight=(pos-vec2(-409.,122.))*vec2(.0037,.0044);
  float bendFront=exp(-dot(nearLight,nearLight));
  float facets = pow(clamp(.55+4.2*dot(g,normalize(vec2(.61,.79))),0.,1.),2.1);
  float breaks=noise2(q*vec2(.91,1.21)+vec2(.73,-.51)*uTime);
  vec2 gleamWindow=(pos-vec2(-435.,107.))*vec2(.00191,.00304);
  float longGleam=exp(-dot(gleamWindow,gleamWindow));
  vec2 tail=(pos-vec2(-359.,58.))*vec2(.0034,.0101);
  float foregroundLight=exp(-dot(tail,tail));
  float textureFade=1.-smoothstep(425.,1450.,d);
  radiance+=(bendFront*.22+longGleam*.18)*(1.-edge*.64)*facets*(.48+1.01*breaks)*cloudLight;
  radiance+=foregroundLight*(.067+.16*facets)*(.64+.63*breaks)*(1.-edge*.48);
  radiance *= 1.+textureFade*(1.-edge*.71)*((breaks-.49)*.17+(rough-.50)*.064);
  float foam=pow(max(0.,fbm(pos*.21-stream*uTime*.22)-.73)*3.2,2.);
  radiance+=foam*.021*shallow*smoothstep(0.,1.5,toBank);
  radiance *= 1.-.25*exp(-d*.0018);
  radiance = mix(radiance,.165, (1.-exp(-d*.00011))*.20);
  gl_FragColor = vec4(vec3(paper(film(radiance))),coverage);
}`;

  const viewSkyFragment = `
varying vec2 vUV;
uniform vec3 uSkyRight,uSkyUp,uSkyForward;
uniform vec2 uSkyScale,uSkyShift;
${noiseGLSL}
${stormGLSL}
void main() {
  vec2 xy=(vUV*2.-1.-uSkyShift)*uSkyScale;
  vec3 ray=normalize(uSkyForward+uSkyRight*xy.x+uSkyUp*xy.y);
  float angle=atan(ray.x,-ray.z);
  float rawAz=fract(angle/6.2831853+.70);
  float seam=smoothstep(.86,1.,rawAz)+(1.-smoothstep(0.,.14,rawAz));
  float az=mix(rawAz,.5,clamp(seam,0.,1.));
  float elevation=asin(clamp(ray.y,-1.,1.));
  vec2 uv=vec2(az,clamp(.32+elevation*.99,0.,1.));
  float clouds=skyPlate(uv);
  float valley=exp(-max(0.,elevation)*7.);
  float horizon=(.49+.09*ray.z)*(1.-.28*step(2.5,uGlass)*step(uGlass,3.5));
  float value=mix(clouds,horizon,.37*valley);
  gl_FragColor=vec4(vec3(paper(value)),1.);
}`;

  const ridgeWorldVertex = `
attribute vec3 aLocal;
varying vec3 vWorld, vNormal, vLocal;
varying vec2 vUV;
void main() {
  vWorld = (modelMatrix * vec4(position, 1.)).xyz;
  vNormal = mat3(modelMatrix) * normal;
  vLocal = aLocal;
  vUV = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.);
}`;

  const ridgeFragment = `
varying vec3 vWorld,vNormal,vLocal;
varying vec2 vUV;
uniform sampler2D uGround,uRock,uScree,uAerial,uRelief;
uniform vec4 uAerialBounds;
${noiseGLSL}
${stormGLSL}
vec3 faces(sampler2D map,vec3 p,vec3 n) {
  vec3 k=pow(abs(n),vec3(4.));
  k/=dot(k,vec3(1.));
  return texture2D(map,p.yz).rgb*k.x+texture2D(map,p.xz).rgb*k.y+texture2D(map,p.xy).rgb*k.z;
}
void main() {
  vec3 p=vWorld,lp=vLocal,n=normalize(vNormal);
  float d=length(cameraPosition-p), slope=1.-n.y;
  vec2 field=(lp.xz-uAerialBounds.xy)*uAerialBounds.zw;
  float mapped=step(0.,field.x)*step(field.x,1.)*step(0.,field.y)*step(field.y,1.);
  vec3 relief=texture2D(uRelief,field).rgb;
  float airborne=fbm(lp.xz*.006);
  vec3 slabs=faces(uRock,lp/132.,n);
  vec3 grains=faces(uRock,lp/14.,n);
  vec3 grit=texture2D(uGround,lp.xz*.23).rgb;
  float aerial=texture2D(uAerial,field).r;
  float cliff=smoothstep(.16,.47,slope)*.75+.25*smoothstep(230.,1000.,lp.y);
  float stone=(.077+.27*slabs.r)*(.66+.68*grains.r);
  float soil=(.026+.117*grit.r)*(.69+.46*grit.b);
  float wood=mix(.56,.94,airborne);
  float key=max(0.,dot(n,sun));
  float value=mix(soil*wood,stone,clamp(cliff,0.,1.));
  value*=mix(1.,.57+.81*aerial,mapped*.75);
  value*=.22+1.25*key*lightWindow(lp.xz);
  value*=mix(1.,.49+.66*relief.g+.22*relief.r,mapped*cliff*.64);
  float flakes=smoothstep(850.,1550.,lp.y)*smoothstep(.32,.72,relief.r+airborne*.35)*(1.-smoothstep(.45,.88,slope));
  value=mix(value,(.16+.66*key)*(.62+.45*grains.r),flakes*.64);
  float haze=(1.-exp(-d*.00018))*(1.-smoothstep(90.,1500.,lp.y)*.65);
  value=mix(value,.20,haze*.48);
  gl_FragColor=vec4(vec3(paper(film(value))),1.);
}`;

  /* ---------- Abyssal Field Studio Procedural Sanctuary & Reef Builders ---------- */
  const ABYSS_OX = -1085, ABYSS_OZ = -35, ABYSS_SCALE = 2.15, ABYSS_BASE_Y = 47.5, ABYSS_SURF_Y = 86.0;
  const AHIYA_OX = -1630, AHIYA_OZ = 665, AHIYA_BASE_Y = 74.0;
  let AHIYA_GROUND_MODE = "sculpted";   // "real" once ahiya-real-terrain.js is in use
  const RIDGE_OX = 620, RIDGE_OZ = 0, RIDGE_OY = 128;
  const TETON_ARRIVAL_DISTANCE = 160;

  const AB_PERM = new Uint8Array(512);
  (() => {
    const rng = seedRandom(0xAB155A1);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
    for (let i = 0; i < 512; i++) AB_PERM[i] = p[i & 255];
  })();
  function abGrad3(hash, x, y, z) {
    const h = hash & 15, u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
  function abNoise3(x, y, z) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);
    const A = AB_PERM[X] + Y, AA = AB_PERM[A] + Z, AB = AB_PERM[A + 1] + Z;
    const B = AB_PERM[X + 1] + Y, BA = AB_PERM[B] + Z, BB = AB_PERM[B + 1] + Z;
    return lerp(
      lerp(lerp(abGrad3(AB_PERM[AA], x, y, z), abGrad3(AB_PERM[BA], x - 1, y, z), u),
           lerp(abGrad3(AB_PERM[AB], x, y - 1, z), abGrad3(AB_PERM[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(abGrad3(AB_PERM[AA + 1], x, y, z - 1), abGrad3(AB_PERM[BA + 1], x - 1, y, z - 1), u),
           lerp(abGrad3(AB_PERM[AB + 1], x, y - 1, z - 1), abGrad3(AB_PERM[BB + 1], x - 1, y - 1, z - 1), u), v), w
    );
  }
  function abFbm2(x, z, octaves) {
    let sum = 0, amp = .5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += amp * abNoise3(x * freq, .37 + i * 3.1, z * freq); norm += amp; freq *= 2.03; amp *= .5; }
    return sum / norm;
  }
  function abFbm3(x, y, z, octaves) {
    let sum = 0, amp = .5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += amp * abNoise3(x * freq, y * freq, z * freq); norm += amp; freq *= 2.07; amp *= .5; }
    return sum / norm;
  }
  function abSeabedH(x, z) {
    let h = abFbm2(x * .018, z * .018, 4) * 9.5 + abFbm2(x * .055 + 5.2, z * .055 - 3.1, 3) * 2.4;
    const dxS = (x + 1.2) / 14.5, dzS = (z - 6.0) / 15.5;
    const sanctMask = Math.exp(-(dxS * dxS + dzS * dzS));
    const sandRipples = Math.sin(x * 1.45 + z * .65 + abNoise3(x * .25, .2, z * .25) * 2.2) * .07;
    h = lerp(h, .25 + sandRipples, sanctMask * .88);
    const leftBank = Math.exp(-Math.pow((x + 10.5) / 6.5, 2) - Math.pow((z - 4.0) / 16.0, 2));
    const rightBank = Math.exp(-Math.pow((x - 10.2) / 7.0, 2) - Math.pow((z - 3.0) / 17.0, 2));
    h += (leftBank * 3.1 + rightBank * 2.8) * (.7 + .6 * abNoise3(x * .14, 1.1, z * .14));
    const dxShip = (x + 12.0) / 14.5, dzShip = (z + 25.5) / 13.0;
    const shipShelf = Math.exp(-(dxShip * dxShip + dzShip * dzShip));
    h = lerp(h, 10.6 + abFbm2(x * .09, z * .09, 2) * 1.3, shipShelf * .92);
    const dxArch = (x - 18.0) / 6.2, dzArch = (z + 5.5) / 14.0;
    const canyonFloor = Math.exp(-(dxArch * dxArch + dzArch * dzArch));
    h = lerp(h, .4 + sandRipples, canyonFloor * .82);
    const canyonWalls = Math.exp(-Math.pow((Math.abs(x - 18.0) - 6.8) / 3.2, 2) - Math.pow((z + 5.5) / 11.0, 2));
    h += canyonWalls * 6.4;
    const trenchT = smooth(-26.0, -52.0, z) * smooth(-8.0, 22.0, x + 8.0);
    h -= trenchT * 12.5;
    const edgeR = Math.hypot(x, z);
    h += smooth(56.0, 90.0, edgeR) * 10.5;
    return h;
  }

  class AbyssMB {
    constructor() { this.pos = []; this.norm = []; this.col = []; this.idx = []; }
    vtx(px, py, pz, nx, ny, nz, r, g, b) {
      const i = (this.pos.length / 3) | 0;
      this.pos.push(px, py, pz);
      const l = Math.hypot(nx, ny, nz) || 1;
      this.norm.push(nx / l, ny / l, nz / l);
      this.col.push(r, g, b);
      return i;
    }
    tri(a, b, c) { this.idx.push(a, b, c); }
    qd(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }
    tb(pts, radii, sides, colFn, capEnds) {
      const rings = pts.length, bRng = [];
      let upX = 0, upY = 1, upZ = 0;
      for (let i = 0; i < rings; i++) {
        const p = pts[i], pPrev = pts[Math.max(0, i - 1)], pNext = pts[Math.min(rings - 1, i + 1)];
        let tx = pNext[0] - pPrev[0], ty = pNext[1] - pPrev[1], tz = pNext[2] - pPrev[2];
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        if (Math.abs(tx * upX + ty * upY + tz * upZ) > .92) { upX = 1; upY = 0; upZ = 0; }
        let bx = ty * upZ - tz * upY, by = tz * upX - tx * upZ, bz = tx * upY - ty * upX;
        const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
        const nx0 = by * tz - bz * ty, ny0 = bz * tx - bx * tz, nz0 = bx * ty - by * tx;
        const rx = Array.isArray(radii[i]) ? radii[i][0] : radii[i];
        const ry = Array.isArray(radii[i]) ? radii[i][1] : radii[i];
        const vf = i / Math.max(1, rings - 1), ringIdx = [];
        for (let s = 0; s < sides; s++) {
          const ang = (s / sides) * TAU, ca = Math.cos(ang), sa = Math.sin(ang);
          const ox = bx * ca * rx + nx0 * sa * ry, oy = by * ca * rx + ny0 * sa * ry, oz = bz * ca * rx + nz0 * sa * ry;
          const nrx = (bx * ca) / Math.max(.02, rx) + (nx0 * sa) / Math.max(.02, ry);
          const nry = (by * ca) / Math.max(.02, rx) + (ny0 * sa) / Math.max(.02, ry);
          const nrz = (bz * ca) / Math.max(.02, rx) + (nz0 * sa) / Math.max(.02, ry);
          const c = colFn(vf, ang, p[0] + ox, p[1] + oy, p[2] + oz);
          ringIdx.push(this.vtx(p[0] + ox, p[1] + oy, p[2] + oz, nrx, nry, nrz, c[0], c[1], c[2]));
        }
        bRng.push(ringIdx);
      }
      for (let i = 0; i < rings - 1; i++) for (let s = 0; s < sides; s++) {
        const ns = (s + 1) % sides;
        this.qd(bRng[i][s], bRng[i][ns], bRng[i + 1][ns], bRng[i + 1][s]);
      }
      if (capEnds && rings >= 2) {
        const p0 = pts[0], pN = pts[rings - 1], c0 = colFn(0, 0, p0[0], p0[1], p0[2]), cN = colFn(1, 0, pN[0], pN[1], pN[2]);
        const iS = this.vtx(p0[0], p0[1], p0[2], 0, -1, 0, c0[0], c0[1], c0[2]);
        const iE = this.vtx(pN[0], pN[1], pN[2], 0, 1, 0, cN[0], cN[1], cN[2]);
        for (let s = 0; s < sides; s++) {
          const ns = (s + 1) % sides;
          this.tri(iS, bRng[0][ns], bRng[0][s]);
          this.tri(iE, bRng[rings - 1][s], bRng[rings - 1][ns]);
        }
      }
    }
    bx(cx, cy, cz, sx, sy, sz, rx, ry, rz, col) {
      const cr = Math.cos(rx), sr = Math.sin(rx), cp = Math.cos(ry), sp = Math.sin(ry), cyw = Math.cos(rz), syw = Math.sin(rz);
      const rot = (x, y, z) => {
        const y1 = y * cr - z * sr, z1 = y * sr + z * cr;
        const x2 = x * cp + z1 * sp, z2 = -x * sp + z1 * cp;
        return [x2 * cyw - y1 * syw, x2 * syw + y1 * cyw, z2];
      };
      const faces = [
        [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1], [1, 0, 0]],
        [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1], [-1, 0, 0]],
        [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [0, 1, 0]],
        [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [0, -1, 0]],
        [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 1]],
        [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1], [0, 0, -1]]
      ];
      for (const f of faces) {
        const n = rot(f[4][0], f[4][1], f[4][2]), vi = [];
        for (let k = 0; k < 4; k++) {
          const p = rot(f[k][0] * sx * .5, f[k][1] * sy * .5, f[k][2] * sz * .5);
          const nVar = .92 + .16 * abNoise3((cx + p[0]) * 1.4, (cy + p[1]) * 1.4, (cz + p[2]) * 1.4);
          vi.push(this.vtx(cx + p[0], cy + p[1], cz + p[2], n[0], n[1], n[2], col[0] * nVar, col[1] * nVar, col[2] * nVar));
        }
        this.qd(vi[0], vi[1], vi[2], vi[3]);
      }
    }
    calcN() {
      const n = new Float32Array(this.pos.length), p = this.pos, idx = this.idx;
      for (let i = 0; i < idx.length; i += 3) {
        const ia = idx[i] * 3, ib = idx[i + 1] * 3, ic = idx[i + 2] * 3;
        const abx = p[ib] - p[ia], aby = p[ib + 1] - p[ia + 1], abz = p[ib + 2] - p[ia + 2];
        const acx = p[ic] - p[ia], acy = p[ic + 1] - p[ia + 1], acz = p[ic + 2] - p[ia + 2];
        const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
        n[ia] += nx; n[ia + 1] += ny; n[ia + 2] += nz;
        n[ib] += nx; n[ib + 1] += ny; n[ib + 2] += nz;
        n[ic] += nx; n[ic + 1] += ny; n[ic + 2] += nz;
      }
      for (let i = 0; i < n.length; i += 3) {
        const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
        this.norm[i] = n[i] / l; this.norm[i + 1] = n[i + 1] / l; this.norm[i + 2] = n[i + 2] / l;
      }
    }
    toGeo() {
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(this.pos, 3));
      g.setAttribute("normal", new T.Float32BufferAttribute(this.norm, 3));
      g.setAttribute("color", new T.Float32BufferAttribute(this.col, 3));
      g.setIndex(this.idx);
      g.computeBoundingSphere();
      return g;
    }
  }

  function addAbyssRockBlob(mb, cx, cy, cz, rx, ry, rz, seed, tint) {
    const lat = 8, lon = 12, rings = [];
    for (let i = 0; i <= lat; i++) {
      const phi = (i / lat) * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi), row = [];
      for (let j = 0; j < lon; j++) {
        const theta = (j / lon) * TAU, dx = sp * Math.cos(theta), dy = cp, dz = sp * Math.sin(theta);
        const n = abFbm3(dx * 1.6 + seed, dy * 1.6 - seed * .5, dz * 1.6 + seed * .3, 3);
        const scale = 1.0 + n * .36 + Math.sin(dy * 7.0 + n * 4.0) * .06;
        const shade = .88 + n * .25;
        row.push(mb.vtx(cx + dx * rx * scale, cy + dy * ry * scale, cz + dz * rz * scale, dx, dy, dz, tint[0] * shade, tint[1] * shade, tint[2] * shade));
      }
      rings.push(row);
    }
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) mb.qd(rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % lon], rings[i][(j + 1) % lon]);
  }

  function mkAbyssWhaleGeo() {
    const mb = new AbyssMB(), steps = 22, pts = [], rads = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push([-.9 - 2.65 * (t ** 1.08), -.6 + 6.45 * t, 4.2 - 1.85 * t + Math.sin(t * 2.2) * .25]);
      rads.push([lerp(1.42, .62, t ** .72), lerp(1.18, .44, t ** .78)]);
    }
    const stoneCol = (vf, ang, wx, wy, wz) => {
      const strata = abFbm3(wx * .55, wy * .95, wz * .55, 3);
      const moss = smooth(0, 2.2, 2.2 - wy) * .35 + clamp(strata * .5 + .15, 0, .35);
      const base = .48 + strata * .22;
      return [lerp(base * .72, .16, moss), lerp(base * .88, .44, moss), lerp(base * 1.02, .48, moss)];
    };
    mb.tb(pts, rads, 20, stoneCol, true);
    for (let i = 0; i < mb.pos.length; i += 3) {
      const d = abFbm3(mb.pos[i] * .85, mb.pos[i + 1] * .85, mb.pos[i + 2] * .85, 3) * .20;
      mb.pos[i] += mb.norm[i] * d; mb.pos[i + 1] += mb.norm[i + 1] * d; mb.pos[i + 2] += mb.norm[i + 2] * d;
    }
    const junc = [-3.65, 5.65, 2.35], spanSteps = 30, chStp = 14;
    const cy = Math.cos(.26), sy = Math.sin(.26), cp = Math.cos(.62), sp = Math.sin(.62), cr = Math.cos(-.28), sr = Math.sin(-.28);
    const flukeWorld = (lx, ly, lz) => {
      const x1 = lx * cr - ly * sr, y1 = lx * sr + ly * cr;
      const y2 = y1 * cp - lz * sp, z2 = y1 * sp + lz * cp;
      return [junc[0] + x1 * cy + z2 * sy, junc[1] + y2, junc[2] - x1 * sy + z2 * cy];
    };
    const grid = [];
    for (let is = -spanSteps; is <= spanSteps; is++) {
      const s = is / spanSteps, absS = Math.abs(s), lxBase = s * 5.45;
      const leadY = 1.05 * (1 - absS ** 1.45) + 1.85 * (absS ** 1.15);
      const trailY = -.65 + 2.05 * (absS ** 1.38) + .58 * Math.exp(-Math.pow(s / .11, 2));
      const archZ = -(absS ** 1.7) * .85, thickMax = lerp(.52, .075, absS ** .82) * (1 - .35 * Math.exp(-Math.pow(s / .09, 2)));
      const ring = [];
      for (let ic = 0; ic < chStp * 2; ic++) {
        const upper = ic < chStp, u = upper ? ic / (chStp - 1) : 1 - (ic - chStp) / (chStp - 1);
        const profile = 1.48 * (.2969 * Math.sqrt(Math.max(.001, u)) - .126 * u - .3516 * u * u + .2843 * u * u * u - .1015 * u * u * u * u);
        const signZ = upper ? 1 : -1;
        const wp = flukeWorld(lxBase, lerp(leadY, trailY, u), archZ + signZ * profile * thickMax);
        const c = stoneCol(absS, u, wp[0], wp[1], wp[2]);
        const barn = smooth(.55, .98, absS) * (1 - u) * .18;
        ring.push(mb.vtx(wp[0], wp[1], wp[2], 0, signZ, 0, c[0] + barn, c[1] + barn, c[2] + barn));
      }
      grid.push(ring);
    }
    for (let i = 0; i < grid.length - 1; i++) for (let j = 0; j < chStp * 2; j++) {
      const nj = (j + 1) % (chStp * 2);
      mb.qd(grid[i][j], grid[i + 1][j], grid[i + 1][nj], grid[i][nj]);
    }
    const rng = seedRandom(0x774A1E), baseY = abSeabedH(-.9, 4.2);
    for (let b = 0; b < 14; b++) {
      const ang = (b / 14) * TAU + rng() * .35, dist = .95 + rng() * 1.85;
      const bx = -1.0 + Math.cos(ang) * dist, bz = 4.1 + Math.sin(ang) * dist, rad = .55 + rng() * .85;
      addAbyssRockBlob(mb, bx, abSeabedH(bx, bz) - rad * .32, bz, rad * 1.35, rad * (.48 + rng() * .32), rad * 1.15, 11 + b * 4.7, [.18, .38, .44]);
    }
    mb.calcN();
    return mb.toGeo();
  }

  function mkAbyssShipGeo() {
    const local = new AbyssMB(), wDrk = [.22, .16, .11], wMid = [.32, .24, .16], woodMoss = [.14, .32, .28];
    const zSteps = 20, profSteps = 12, pGrd = [], sGrd = [];
    for (let iz = 0; iz <= zSteps; iz++) {
      const t = iz / zSteps, z = lerp(-9.2, 10.2, t);
      const beam = Math.sin(Math.pow(clamp(t * 1.06, 0, 1), .68) * Math.PI) * 3.45 + (1 - t) * .85;
      const sheerY = Math.pow(Math.abs(t - .42), 2) * 2.8 + (t < .22 ? (.22 - t) * 5.2 : 0);
      const keelY = -2.35 + smooth(.75, 1, t) * 1.55;
      const pCol = [], sCol = [];
      for (let ip = 0; ip <= profSteps; ip++) {
        const u = ip / profSteps, inBreach = t > .38 && t < .62 && u > .35, flare = Math.sin(u * Math.PI * .62);
        const x = flare * beam * (inBreach ? .86 : 1), y = lerp(keelY, 1.65 + sheerY, u ** .86);
        const algae = smooth(1.2, -2, y) * .55, plank = .9 + .1 * Math.sin(u * 38);
        const c = [lerp(wMid[0], woodMoss[0], algae) * plank, lerp(wMid[1], woodMoss[1], algae) * plank, lerp(wMid[2], woodMoss[2], algae) * plank];
        pCol.push(local.vtx(-x, y, z, -flare - .2, u - .5, 0, c[0], c[1], c[2]));
        sCol.push(local.vtx(x, y, z, flare + .2, u - .5, 0, c[0], c[1], c[2]));
      }
      pGrd.push(pCol); sGrd.push(sCol);
    }
    for (let iz = 0; iz < zSteps; iz++) for (let ip = 0; ip < profSteps; ip++) {
      local.qd(pGrd[iz][ip], pGrd[iz + 1][ip], pGrd[iz + 1][ip + 1], pGrd[iz][ip + 1]);
      if (!(iz >= 7 && iz <= 12 && ip >= 5)) local.qd(sGrd[iz][ip], sGrd[iz][ip + 1], sGrd[iz + 1][ip + 1], sGrd[iz + 1][ip]);
    }
    local.bx(0, -2.45, .3, .42, .55, 19.2, 0, 0, 0, wDrk);
    for (let r = 0; r < 13; r++) {
      const t = (r + .5) / 13, z = lerp(-8.6, 9.2, t), beam = Math.sin(Math.pow(clamp(t * 1.06, 0, 1), .68) * Math.PI) * 3.38 + (1 - t) * .8;
      const pts = [];
      for (let k = -6; k <= 6; k++) {
        const u = Math.abs(k) / 6;
        pts.push([Math.sign(k) * Math.sin(u * Math.PI * .62) * beam, lerp(-2.25, 1.75 + Math.pow(Math.abs(t - .42), 2) * 2.5, u ** .86), z]);
      }
      local.tb(pts, new Array(pts.length).fill(.13), 5, () => wDrk, true);
    }
    local.bx(0, 1.4, -9.2, 3.6, 3.8, .35, -.18, 0, 0, wMid);
    local.bx(0, 2.9, -7.2, 3.8, 1.8, 3.8, 0, 0, 0, wDrk);
    local.tb([[0, 2.2, 8.8], [0, 3.6, 12.6], [0, 4.7, 15.8]], [.24, .17, .09], 7, () => wMid, true);
    local.tb([[0, -2.1, -.4], [.1, 4.8, -.2], [.35, 10.6, .1]], [.34, .26, .16], 8, () => wMid, true);
    local.tb([[0, -1.9, 5.2], [-.15, 3.6, 5.4], [-.3, 7.8, 5.7]], [.28, .21, .13], 7, () => wMid, true);
    local.tb([[-3.8, 7.6, -.3], [.2, 8.1, -.05], [4.1, 7.1, .2]], [.10, .15, .10], 6, () => wDrk, true);
    local.tb([[-2.9, 5.7, 5.3], [-.2, 5.9, 5.5], [2.7, 5.2, 5.8]], [.09, .13, .09], 6, () => wDrk, true);
    local.calcN();
    const shipPos = [-11.8, 12.6, -25.5];
    const cy = Math.cos(.68), sy = Math.sin(.68), cp = Math.cos(-.16), sp = Math.sin(-.16), cr = Math.cos(.36), sr = Math.sin(.36);
    const xform = (x, y, z) => {
      const x1 = x * cr - y * sr, y1 = x * sr + y * cr, y2 = y1 * cp - z * sp, z2 = y1 * sp + z * cp;
      return [x1 * cy + z2 * sy, y2, -x1 * sy + z2 * cy];
    };
    for (let i = 0; i < local.pos.length; i += 3) {
      const p = xform(local.pos[i], local.pos[i + 1], local.pos[i + 2]);
      const n = xform(local.norm[i], local.norm[i + 1], local.norm[i + 2]);
      local.pos[i] = shipPos[0] + p[0]; local.pos[i + 1] = shipPos[1] + p[1]; local.pos[i + 2] = shipPos[2] + p[2];
      local.norm[i] = n[0]; local.norm[i + 1] = n[1]; local.norm[i + 2] = n[2];
    }
    return local.toGeo();
  }

  function mkAbyssArchGeo() {
    const mb = new AbyssMB(), steps = 28, pts = [], rads = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, ang = t * Math.PI, spanX = 18.0 - Math.cos(ang) * 7.2;
      const archY = Math.max(abSeabedH(spanX, -6.0) - .8, .2) + Math.sin(ang) * 9.2;
      const archZ = -6.0 + Math.sin(t * TAU) * 1.15;
      pts.push([spanX, archY, archZ]);
      const r = 1.65 - Math.sin(ang) * .48 + .22 * Math.cos(t * 15);
      rads.push([r * 1.18, r * .92]);
    }
    mb.tb(pts, rads, 14, (vf, ang, wx, wy, wz) => {
      const n = abFbm3(wx * .5, wy * .5, wz * .5, 3), cT = smooth(2, 9, wy) * .22;
      return [.24 + n * .16 + cT, .38 + n * .15, .48 + n * .16 + cT];
    }, true);
    mb.calcN();
    return mb.toGeo();
  }

  function mkAbyssCoralGeo() {
    const mb = new AbyssMB();
    const branches = [
      [[0, 0, 0], [.01, .28, 0], [-.14, .62, .03], [-.28, .96, .05], [-.36, 1.18, .06]],
      [[.01, .24, 0], [.16, .58, -.02], [.32, .92, -.05], [.42, 1.14, -.06]],
      [[-.09, .48, .02], [-.03, .82, -.06], [.03, 1.12, -.09]],
      [[.11, .46, -.01], [.08, .80, .08], [.14, 1.08, .12]],
      [[0, .16, 0], [-.20, .44, -.08], [-.38, .74, -.12], [-.46, .96, -.14]],
      [[0, .18, 0], [.20, .42, .09], [.36, .70, .14], [.44, .92, .16]]
    ];
    for (const br of branches) mb.tb(br, br.map((_, idx) => lerp(.048, .016, idx / (br.length - 1))), 5, vf => [.72 + .28 * vf, .62 + .32 * vf, .80 + .20 * vf], true);
    mb.calcN();
    return mb.toGeo();
  }

  function mkAbyssSpongeGeo() {
    const mb = new AbyssMB();
    const tubes = [{ ox: 0, oz: 0, h: 1.0, r: .22, lx: .06, lz: .02 }, { ox: .24, oz: .14, h: .74, r: .16, lx: .14, lz: .08 }, { ox: -.20, oz: .16, h: .62, r: .15, lx: -.12, lz: .10 }];
    for (const tb of tubes) {
      const pts = [], rads = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        pts.push([tb.ox + tb.lx * t * t, t * tb.h, tb.oz + tb.lz * t * t]);
        rads.push(tb.r * (Math.sin(t * Math.PI * .82) * .35 + .75) * (k === 5 ? .78 : 1));
      }
      mb.tb(pts, rads, 8, vf => [.74 + .22 * vf, .70 + .24 * vf, .94], true);
    }
    mb.calcN();
    return mb.toGeo();
  }

  function mkAbyssMantaGeo() {
    const mb = new AbyssMB(), sxSteps = 12, szStp = 10, gTop = [], gBot = [];
    for (let ix = -sxSteps; ix <= sxSteps; ix++) {
      const s = ix / sxSteps, a = Math.abs(s);
      const zF = .88 * Math.pow(1 - a, .72) - .32 * a, zB = -.85 * (1 - Math.pow(a, .65)) - .36 * a;
      const thick = .15 * Math.pow(1 - a, 1.35) + .014, tR = [], bR = [];
      for (let iz = 0; iz <= szStp; iz++) {
        const u = iz / szStp, z = lerp(zF, zB, u), x = s * 1.85, foil = Math.sin(Math.pow(u, .65) * Math.PI) * thick;
        const chev = smooth(.12, .35, a) * (1 - smooth(.38, .62, a)) * smooth(.55, .18, u) * .52;
        tR.push(mb.vtx(x, foil, z, s * .15, 1, 0, lerp(.08, .55, chev), lerp(.16, .78, chev), lerp(.28, .92, chev)));
        bR.push(mb.vtx(x, -foil * .62, z, s * .1, -1, 0, .72, .88, .96));
      }
      gTop.push(tR); gBot.push(bR);
    }
    for (let ix = 0; ix < sxSteps * 2; ix++) for (let iz = 0; iz < szStp; iz++) {
      mb.qd(gTop[ix][iz], gTop[ix + 1][iz], gTop[ix + 1][iz + 1], gTop[ix][iz + 1]);
      mb.qd(gBot[ix][iz], gBot[ix][iz + 1], gBot[ix + 1][iz + 1], gBot[ix + 1][iz]);
    }
    mb.tb([[0, 0, -.78], [0, -.02, -1.55], [0, -.04, -2.45]], [.045, .022, .007], 4, () => [.10, .20, .34], true);
    mb.calcN();
    return mb.toGeo();
  }

  function mkAbyssJellyGeo() {
    const mb = new AbyssMB(), lat = 6, lon = 12, rings = [];
    for (let i = 0; i <= lat; i++) {
      const v = i / lat, ang = v * Math.PI * .58, r = Math.sin(ang) * .52, y = Math.cos(ang) * .42, row = [];
      for (let j = 0; j < lon; j++) {
        const th = (j / lon) * TAU;
        row.push(mb.vtx(Math.cos(th) * r, y, Math.sin(th) * r, Math.cos(th) * Math.sin(ang), Math.cos(ang), Math.sin(th) * Math.sin(ang), .45, .86, 1.0));
      }
      rings.push(row);
    }
    for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) mb.qd(rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % lon], rings[i][(j + 1) % lon]);
    for (let t = 0; t < 6; t++) {
      const a = (t / 6) * TAU, rx = Math.cos(a) * .18, rz = Math.sin(a) * .18;
      mb.tb([[rx * .5, .15, rz * .5], [rx, -.22, rz], [rx * 1.15, -.68, rz * 1.15], [rx * .9, -1.18, rz * .9]], [.032, .024, .016, .007], 4, () => [.76, .62, 1.0], false);
    }
    mb.calcN();
    return mb.toGeo();
  }

  /* ---------- MONOLITH-3 + Abyssal Async Loader & Unified World Constructor ---------- */

  const gameBillboardVertex = `
attribute float aSeed;
varying vec2 vUV;
varying vec3 vBase;
varying float vSeed;
uniform float uTime;
void main(){
  vec3 root=instanceMatrix[3].xyz;
  vec3 facing=normalize(vec3(cameraPosition.x-root.x,0.,cameraPosition.z-root.z));
  vec3 right=vec3(facing.z,0.,-facing.x);
  float width=length(instanceMatrix[0].xyz);
  float height=length(instanceMatrix[1].xyz);
  float sway=sin(uTime*1.11+root.x*.04+root.z*.03)*.021*uv.y*uv.y;
  vec3 world=root+right*((position.x+sway)*width)+vec3(0.,uv.y*height,0.);
  vUV=uv; vBase=root; vSeed=aSeed;
  gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
}`;

  const gameBillboardFragment = `
varying vec2 vUV;
varying vec3 vBase;
varying float vSeed;
uniform sampler2D uCrowns;
${noiseGLSL}
${stormGLSL}
void main(){
  float species=floor(vSeed);
  float seed=fract(vSeed);
  vec2 tile=vec2(floor(seed*4.),11.-species);
  vec4 sampleColor=texture2D(uCrowns,(tile+vUV*.972+.014)/vec2(4.,12.));
  if(sampleColor.a<.32)discard;
  float dist=length(cameraPosition-vBase);
  float light=lightWindow(vBase.xz);
  float filtered=1.+.19*step(3.5,uGlass);
  float trunk=(.018+.27*pow(clamp(sampleColor.r/max(.16,sampleColor.a),0.,1.),1.5));
  float value=trunk*(.34+.48*light+.39*vUV.y)*(.74+.44*seed)*filtered;
  value*=.61+.39*smoothstep(80.,500.,dist);
  value=mix(value,.16,(1.-exp(-dist*.00018))*.55);
  gl_FragColor=vec4(vec3(paper(film(value))),1.);
}`;

  /* ---------- MONOLITH-3 Async Loader & World Constructor ---------- */
  async function loadMonolithAssets(renderer) {
    const loaderMsg = $("world-loader-msg");
    if (loaderMsg) loaderMsg.textContent = "Fetching MONOLITH-3 USGS Grand Teton & Half Dome assets…";
    const resp = await fetch("../MONOLITH-3.html");
    if (!resp.ok) throw new Error(`Failed to fetch ../MONOLITH-3.html (${resp.status})`);
    const htmlText = await resp.text();
    if (loaderMsg) loaderMsg.textContent = "Decompressing elevation grids & lidar tree canopy…";
    const doc = new DOMParser().parseFromString(htmlText, "text/html");
    const assetMap = new Map();
    for (const sc of doc.querySelectorAll('script[type="text/plain"][id]')) {
      assetMap.set(sc.id, sc);
    }
    const asset = id => (assetMap.get(id)?.textContent || "").trim();
    const rawBytes = text => Uint8Array.from(atob(text), v => v.charCodeAt(0));
    async function inflate(text) {
      const stream = new Blob([rawBytes(text)]).stream().pipeThrough(new DecompressionStream("deflate"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    async function loadFloatAsset(id) {
      const node = assetMap.get(id);
      const text = node.textContent.trim();
      const bytes = node.dataset.encoding === "deflate" ? await inflate(text) : rawBytes(text);
      const aligned = bytes.byteOffset % 4 === 0 ? bytes : bytes.slice();
      return new Float32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 4);
    }
    async function loadImage(id) {
      const img = new Image();
      img.src = asset(id);
      await img.decode();
      return img;
    }
    function pixels(image) {
      const c = document.createElement("canvas");
      c.width = image.width; c.height = image.height;
      const gx = c.getContext("2d", { willReadFrequently: true });
      gx.drawImage(image, 0, 0);
      return gx.getImageData(0, 0, image.width, image.height);
    }
    function makeGrid(width, height, values, bounds) {
      const [west, east, south, north] = bounds;
      return {
        width, height, values, bounds,
        at(x, z) {
          const u = clamp((x - west) / (east - west), 0, 1) * (width - 1);
          const v = clamp((z + north) / (north - south), 0, 1) * (height - 1);
          const i = Math.min(width - 2, Math.floor(u)), j = Math.min(height - 2, Math.floor(v));
          const p = u - i, q = v - j, k = j * width + i;
          const a = values[k], b = values[k + 1], c = values[k + width], d = values[k + width + 1];
          return p + q <= 1 ? a + (b - a) * p + (c - a) * q : d + (c - d) * (1 - p) + (b - d) * (1 - q);
        }
      };
    }
    function imageGrid(image, bounds) {
      const { width, height, data } = pixels(image);
      const values = new Float32Array(width * height);
      for (let i = 0; i < values.length; i++) {
        const j = i * 4;
        values[i] = (data[j] * 256 + data[j + 1]) * .1 + data[j + 2] * .02 - 120;
      }
      return makeGrid(width, height, values, bounds);
    }
    function textureBounds(bounds) {
      const [west, east, south, north] = bounds;
      return new T.Vector4(west, -south, 1 / (east - west), -1 / (north - south));
    }
    function rasterMesh(at, bounds, columns, rows, { cuts = [], uvBounds = bounds } = {}) {
      const [west, east, south, north] = bounds;
      const p = new Float32Array(columns * rows * 3), uv = new Float32Array(columns * rows * 2);
      const indices = new Uint32Array((columns - 1) * (rows - 1) * 6);
      for (let j = 0, k = 0; j < rows; j++) {
        const z = lerp(-north, -south, j / (rows - 1));
        for (let i = 0; i < columns; i++, k++) {
          const x = lerp(west, east, i / (columns - 1));
          p[k * 3] = x; p[k * 3 + 1] = at(x, z); p[k * 3 + 2] = z;
          uv[k * 2] = (x - uvBounds[0]) / (uvBounds[1] - uvBounds[0]);
          uv[k * 2 + 1] = (-z - uvBounds[2]) / (uvBounds[3] - uvBounds[2]);
        }
      }
      let used = 0;
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns - 1; i++) {
        const x = lerp(west, east, (i + .5) / (columns - 1));
        const z = lerp(-north, -south, (j + .5) / (rows - 1));
        if (cuts.some(cut => inside(cut, x, z))) continue;
        const a = j * columns + i;
        indices[used++] = a; indices[used++] = a + columns; indices[used++] = a + 1;
        indices[used++] = a + 1; indices[used++] = a + columns; indices[used++] = a + columns + 1;
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute("position", new T.BufferAttribute(p, 3));
      geometry.setAttribute("uv", new T.BufferAttribute(uv, 2));
      geometry.setIndex(new T.BufferAttribute(indices.subarray(0, used), 1));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      return geometry;
    }

    const config = JSON.parse(asset("terrain-data"));
    const survey = JSON.parse(asset("half-survey"));
    const ids = [
      "near-height", "far-height", "reach-height", "detail-height", "near-surface", "far-surface", "detail-surface",
      "sky-plate", "flow", "gravel", "cobbles", "mountain-relief", "canopy", "geology", "rock", "ground", "scree",
      "crowns", "half-ground", "half-relief", "prop-rock", "prop-ground"
    ];
    const coatIds = ["coat-side", "coat-top", "coat-front", "coat-rear", "coat-head"];

    const [loaded, coatLoaded, coords, half, riverLevelData, crownPositions] = await Promise.all([
      Promise.all(ids.map(loadImage)),
      Promise.all(coatIds.map(loadImage)),
      inflate(asset("flow-coordinates")),
      inflate(survey.data),
      loadFloatAsset("river-level"),
      loadFloatAsset("crown-positions")
    ]);

    const images = {};
    ids.forEach((id, i) => { images[id] = loaded[i]; });
    const coatTextures = {
      "coat_side.jpg": coatLoaded[0],
      "coat_top.jpg": coatLoaded[1],
      "coat_front.jpg": coatLoaded[2],
      "coat_rear.jpg": coatLoaded[3],
      "coat_head.jpg": coatLoaded[4]
    };

    function makeTex(name, repeat = false, packed = false) {
      const t = new T.Texture(images[name]);
      t.colorSpace = T.NoColorSpace;
      t.wrapS = t.wrapT = repeat ? T.RepeatWrapping : T.ClampToEdgeWrapping;
      t.generateMipmaps = !packed;
      t.minFilter = packed ? T.LinearFilter : T.LinearMipmapLinearFilter;
      t.magFilter = T.LinearFilter;
      t.anisotropy = Math.min(6, renderer.capabilities.getMaxAnisotropy());
      t.needsUpdate = true;
      return t;
    }
    const tex = Object.fromEntries(ids.filter(id => !id.endsWith("height") || id === "reach-height").map(id => [
      id, makeTex(id, id.startsWith("prop-") || ["rock", "ground", "scree", "cobbles"].includes(id), ["flow", "reach-height"].includes(id))
    ]));
    const U = name => ({ value: tex[name] });

    const coordTexture = new T.DataTexture(coords, ...config.river.flowSize, T.RGBAFormat);
    coordTexture.flipY = true;
    coordTexture.minFilter = coordTexture.magFilter = T.LinearFilter;
    coordTexture.needsUpdate = true;

    const heights = Object.fromEntries(["detail", "reach", "near", "far"].map(k => [k, imageGrid(images[k + "-height"], config[k].bounds)]));
    const [rw, rh] = config.river.grid;
    const water = makeGrid(rw, rh, riverLevelData, config.river.bounds);
    const riverMask = pixels(images.flow);
    const covers = pixels(images.gravel);

    const halfValues = new Float32Array(survey.size ** 2);
    const halfBytes = new DataView(half.buffer, half.byteOffset, half.byteLength);
    for (let i = 0; i < halfValues.length; i++) halfValues[i] = survey.meters * (survey.low + survey.range * halfBytes.getUint16(i * 2, true) / 65535);
    const halfSize = survey.span * survey.meters / 2;
    const halfCenter = survey.center * survey.meters;
    const halfGrid = makeGrid(survey.size, survey.size, halfValues, [-halfSize, halfSize, -halfCenter - halfSize, -halfCenter + halfSize]);

    // Match flight ground contact to the triangles drawn by the distant terrain mesh.
    const farColumns = 295, farRows = 479;
    const [west, east, south, north] = config.far.bounds;
    const farSamples = new Float32Array(farColumns * farRows);
    const tetonRange = { name: "Teton Range", x: 0, z: 0, y: -Infinity };
    for (let row = 0; row < farRows; row++) {
      const z = lerp(-north, -south, row / (farRows - 1));
      for (let col = 0; col < farColumns; col++) {
        const x = lerp(west, east, col / (farColumns - 1));
        const y = heights.far.at(x, z);
        farSamples[row * farColumns + col] = y;
        if (y > tetonRange.y && inside(config.mountainRelief, x, z)) Object.assign(tetonRange, { x, y, z });
      }
    }
    const farGround = makeGrid(farColumns, farRows, farSamples, config.far.bounds);
    const ridgeMinZ = RIDGE_OZ + halfGrid.bounds[2], ridgeMaxZ = RIDGE_OZ + halfGrid.bounds[3];
    const playableBounds = [
      Math.min(west + 64, -2060), RIDGE_OX - halfGrid.bounds[0] - 64,
      Math.max(-north, ridgeMinZ) + 64, Math.max(Math.min(-south, ridgeMaxZ) - 64, 1020)
    ];
    const tetonRawGround = (x, z) => {
      for (const h of [heights.detail, heights.reach, heights.near]) if (inside(h.bounds, x, z)) return h.at(x, z);
      return farGround.at(x, z);
    };
    const abyssLocalY = (ax, az) => ABYSS_BASE_Y + abSeabedH(ax, az) * 1.15;
    const ahiyaSculptedY = (x, z) => {
      const lx = x - AHIYA_OX, lz = z - AHIYA_OZ;
      // Sculpt Ahiya Highland Wadi (-1460,760), Ridge Cross-Beacon (-1610,590), Hill Archive (-1765,540), Daylight Compound (-1680,775)
      const gBasalt = Math.exp(-((x + 1460) ** 2 + (z - 760) ** 2) / (95 * 95));
      const gBeacon = Math.exp(-((x + 1610) ** 2 + (z - 590) ** 2) / (115 * 115));
      const gHill = Math.exp(-((x + 1765) ** 2 + (z - 540) ** 2) / (105 * 105));
      const gComp = Math.exp(-((x + 1680) ** 2 + (z - 775) ** 2) / (95 * 95));
      const strata = abFbm2(lx * .018, lz * .018, 3) * 11.5 + Math.sin(lx * .045 + lz * .03) * 2.2;
      const ridgeY = AHIYA_BASE_Y + strata + gBeacon * 48 + gHill * 39 + gComp * 14 - gBasalt * 4;
      const wadiCut = Math.exp(-((lz - 70 - Math.sin(lx * .02) * 35) ** 2) / (32 * 32)) * 9.0 * (1 - gBeacon);
      return ridgeY - wadiCut;
    };
    // Real ground: Copernicus GLO-30 heights of a Simien hillside (13.2246 N, 38.1045 E) in game coordinates, from
    // ahiya-real-terrain.js. The pump keeps its sculpted height so the four sets stay where the circuit expects them.
    // `?ground=sculpted` restores the invented ridge; a missing data file falls back to it as well.
    const AHIYA_REAL = (typeof window !== "undefined" && window.AHIYA_REAL
      && new URLSearchParams(location.search).get("ground") !== "sculpted") ? window.AHIYA_REAL : null;
    const AHIYA_REAL_BASE = AHIYA_REAL ? ahiyaSculptedY(-1460, 760) : 0;
    const ahiyaGroundY = AHIYA_REAL ? (x, z) => AHIYA_REAL.groundY(x, z, AHIYA_REAL_BASE) : ahiyaSculptedY;
    if (AHIYA_REAL) AHIYA_GROUND_MODE = "real";
    const tetonWithAbyss = (x, z) => {
      let tg = tetonRawGround(x, z);
      const ax = (x - ABYSS_OX) / ABYSS_SCALE, az = (z - ABYSS_OZ) / ABYSS_SCALE;
      const ar = Math.hypot(ax, az);
      if (ar < 88) {
        const mask = 1 - smooth(52, 86, ar);
        tg = lerp(tg, abyssLocalY(ax, az), mask);
      }
      const ahR = Math.hypot((x - AHIYA_OX) / 285, (z - AHIYA_OZ) / 260);
      if (ahR < 1.15) {
        const ahMask = 1 - smooth(.65, 1.15, ahR);
        tg = lerp(tg, ahiyaGroundY(x, z), ahMask);
      }
      return tg;
    };
    function ridgeGround(x, z) {
      const original = halfGrid.at(x, z);
      const onPass = smooth(48, 61, x) * (1 - smooth(106, 120, x));
      const gorge = smooth(-34, -31, z) * (1 - smooth(2.9, 5, z));
      const shoulder = smooth(-12, -2, z) * (1 - smooth(18, 38, z));
      const rootWall = 1 - smooth(-70.8, -68.5, z);
      const stone = onPass * (.23 * Math.sin(.51 * x + .19 * z) * Math.sin(z * .35) + .12 * Math.sin(z * 1.62));
      return original + onPass * (-12.5 * gorge + 4.4 * rootWall + shoulder * .44) + stone;
    }
    const ridgeWorldGround = (wx, wz) => RIDGE_OY + ridgeGround(RIDGE_OX - wx, RIDGE_OZ - wz);
    const unifiedGround = (wx, wz) => {
      if (wx <= 155) return tetonWithAbyss(wx, wz);
      const rg = ridgeWorldGround(wx, wz);
      if (wx >= 302) return rg;
      return lerp(tetonWithAbyss(wx, wz), rg, smooth(155, 302, wx));
    };
    function maskAt(image, x, z, channel) {
      if (!inside(config.river.bounds, x, z)) return 0;
      const [left, right, south, north] = config.river.bounds;
      const j = clamp(Math.floor((z + north) / (north - south) * image.height), 0, image.height - 1);
      const i = clamp(Math.floor((x - left) / (right - left) * image.width), 0, image.width - 1);
      return image.data[(j * image.width + i) * 4 + channel];
    }
    const wet = (x, z) => maskAt(riverMask, x, z, 2) * 160 / 255 - 32;

    const time = { value: 8 }, glass = { value: 0 }, sun = { value: new T.Vector3(.31, .51, .802).normalize() };
    const lighting = { uTime: time, uGlass: glass, sun };

    const skyUniforms = {
      ...lighting, uSky: U("sky-plate"), uSkyRight: { value: new T.Vector3() }, uSkyUp: { value: new T.Vector3() },
      uSkyForward: { value: new T.Vector3() }, uSkyScale: { value: new T.Vector2() }, uSkyShift: { value: new T.Vector2() }
    };
    const makeSky = () => {
      const sky = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
        uniforms: skyUniforms, vertexShader: skyVertex, fragmentShader: viewSkyFragment, depthTest: false, depthWrite: false
      }));
      sky.frustumCulled = false;
      sky.renderOrder = -1000;
      return sky;
    };
    function updateSkyBasis(viewCam) {
      viewCam.updateMatrixWorld();
      skyUniforms.uSkyRight.value.setFromMatrixColumn(viewCam.matrixWorld, 0);
      skyUniforms.uSkyUp.value.setFromMatrixColumn(viewCam.matrixWorld, 1);
      viewCam.getWorldDirection(skyUniforms.uSkyForward.value);
      const m = viewCam.projectionMatrix.elements;
      skyUniforms.uSkyScale.value.set(1 / m[0], 1 / m[5]);
      skyUniforms.uSkyShift.value.set(-m[8], -m[9]);
    }
    function makeRegionScene() {
      const world = new T.Scene();
      world.add(makeSky());
      world.add(new T.HemisphereLight(0xf6f4ee, 0x3b3c39, 1.35));
      const key = new T.DirectionalLight(0xfffaf0, 2.35);
      key.position.set(110, 145, 75);
      world.add(key);
      return { world, light: key };
    }

    const tetons = makeRegionScene();
    const ridgeAnchor = new T.Group();
    ridgeAnchor.position.set(RIDGE_OX, RIDGE_OY, RIDGE_OZ);
    ridgeAnchor.rotation.y = Math.PI;
    tetons.world.add(ridgeAnchor);

    const tetonMaterials = {
      ...lighting, uUnlit: { value: 0 }, uSky: U("sky-plate"),
      uRock: U("rock"), uGround: U("ground"), uScree: U("scree"), uCobbles: U("cobbles"),
      uFlow: U("flow"), uGravel: U("gravel"), uCanopy: U("canopy"), uGeology: U("geology"),
      uMountainRelief: U("mountain-relief"),
      uGeoBounds: { value: textureBounds(config.far.bounds) }, uFlowBounds: { value: textureBounds(config.river.bounds) },
      uCanopyBounds: { value: textureBounds(config.canopy.bounds) }, uMountainBounds: { value: textureBounds(config.mountainRelief) }
    };
    const trim = (box, n) => [box[0] + n, box[1] - n, box[2] + n, box[3] - n];
    const eastSeamCut = [312, east + 1, -ridgeMaxZ, -ridgeMinZ];
    function tetonLayer(k, width, height, cuts, texName, uvBounds, order) {
      const layer = heights[k];
      const mat = new T.ShaderMaterial({
        uniforms: { ...tetonMaterials, uSurface: U(texName) },
        vertexShader: meshVertex, fragmentShader: printTerrainFragment,
        polygonOffset: order > 0, polygonOffsetFactor: -order, polygonOffsetUnits: -order
      });
      const m = new T.Mesh(rasterMesh(unifiedGround, layer.bounds, width, height, { cuts, uvBounds }), mat);
      m.renderOrder = order;
      tetons.world.add(m);
    }
    tetonLayer("far", farColumns, farRows, [trim(config.near.bounds, 120), eastSeamCut], "far-surface", config.far.bounds, 0);
    // Ahiya fine ground: the near layer's 11 m cells left feet up to 0.6 m off the drawn surface at the sets.
    const AHIYA_PATCH = [-1976, -1284, -982, -348];   // west, east, south, north (z runs -north..-south)
    tetonLayer("near", 340, 360, [trim(config.detail.bounds, 17), trim(config.reach.bounds, 19), eastSeamCut, trim(AHIYA_PATCH, 14)], "near-surface", config.near.bounds, 1);
    {
      const mat = new T.ShaderMaterial({
        uniforms: { ...tetonMaterials, uSurface: U("near-surface") },
        vertexShader: meshVertex, fragmentShader: printTerrainFragment,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      });
      const m = new T.Mesh(rasterMesh(unifiedGround, AHIYA_PATCH, 347, 318, { uvBounds: config.near.bounds }), mat);
      m.renderOrder = 2; m.userData.terrain = true;
      tetons.world.add(m);
    }
    tetonLayer("reach", 500, 207, [], "near-surface", config.near.bounds, 2);
    tetonLayer("detail", 161, 161, [], "detail-surface", config.detail.bounds, 3);

    const ridgeMaterial = new T.ShaderMaterial({
      uniforms: {
        ...lighting, uSky: U("sky-plate"), uGround: U("ground"), uRock: U("rock"), uScree: U("scree"),
        uAerial: U("half-ground"), uRelief: U("half-relief"), uAerialBounds: { value: textureBounds([-3000, 3900, -600, 7200]) }
      },
      vertexShader: ridgeWorldVertex, fragmentShader: ridgeFragment, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    function rasterRidgeWorldMesh(localAt, bounds, columns, rows, { cuts = [], minWx = 302 } = {}) {
      const [west, east, south, north] = bounds;
      const p = new Float32Array(columns * rows * 3), aLocal = new Float32Array(columns * rows * 3), uv = new Float32Array(columns * rows * 2);
      const indices = new Uint32Array((columns - 1) * (rows - 1) * 6);
      for (let j = 0, k = 0; j < rows; j++) {
        const lz = lerp(-north, -south, j / (rows - 1));
        for (let i = 0; i < columns; i++, k++) {
          const lx = lerp(west, east, i / (columns - 1));
          const wx = RIDGE_OX - lx, wz = RIDGE_OZ - lz;
          p[k * 3] = wx; p[k * 3 + 1] = unifiedGround(wx, wz); p[k * 3 + 2] = wz;
          aLocal[k * 3] = lx; aLocal[k * 3 + 1] = localAt(lx, lz); aLocal[k * 3 + 2] = lz;
          uv[k * 2] = (lx - west) / (east - west);
          uv[k * 2 + 1] = (-lz - south) / (north - south);
        }
      }
      let used = 0;
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < columns - 1; i++) {
        const lx = lerp(west, east, (i + .5) / (columns - 1));
        const lz = lerp(-north, -south, (j + .5) / (rows - 1));
        if (RIDGE_OX - lx < minWx || cuts.some(cut => inside(cut, lx, lz))) continue;
        const a = j * columns + i;
        indices[used++] = a; indices[used++] = a + columns; indices[used++] = a + 1;
        indices[used++] = a + 1; indices[used++] = a + columns; indices[used++] = a + columns + 1;
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(p, 3));
      g.setAttribute("aLocal", new T.BufferAttribute(aLocal, 3));
      g.setAttribute("uv", new T.BufferAttribute(uv, 2));
      g.setIndex(new T.BufferAttribute(indices.subarray(0, used), 1));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    }
    const ridgeLocal = [-135, 240, -110, 195];
    const ridgeMid = [-680, 980, -700, 1120];
    const addRidge = (geo, ord) => { const m = new T.Mesh(geo, ridgeMaterial); m.renderOrder = ord; tetons.world.add(m); };
    addRidge(rasterRidgeWorldMesh(halfGrid.at, halfGrid.bounds, 455, 455, { cuts: [trim(ridgeMid, 35)], minWx: 300 }), 0);
    addRidge(rasterRidgeWorldMesh(ridgeGround, ridgeMid, 240, 240, { cuts: [trim(ridgeLocal, 14)], minWx: 300 }), 1);
    addRidge(rasterRidgeWorldMesh(ridgeGround, ridgeLocal, 198, 172, { minWx: 300 }), 2);

    /* Snake River Planar Reflection + Flowing Surface */
    const reflection = new T.WebGLRenderTarget(320, 240);
    const mirror = new T.PerspectiveCamera();
    const reflectionMatrix = new T.Matrix4();
    const reflectionSize = new T.Vector2(320, 240);
    const waterUniforms = {
      ...tetonMaterials, uFlowCoordinates: { value: coordTexture }, uReachBed: U("reach-height"),
      uReachBounds: { value: textureBounds(config.reach.bounds) }, uForward: { value: new T.Vector3(-1, 0, 0) },
      uRight: { value: new T.Vector3(0, 0, -1) }, uUp: { value: new T.Vector3(0, 1, 0) },
      uShift: { value: new T.Vector2() }, uTan: { value: .4 }, uAspect: { value: 1.4 }, uReflectionCamera: { value: reflectionMatrix },
      uBankReflection: { value: reflection.texture }, uReflectionSize: { value: reflectionSize }
    };
    const stream = new T.Mesh(rasterMesh(water.at, water.bounds, 161, 175), new T.ShaderMaterial({
      uniforms: waterUniforms, vertexShader: meshVertex, fragmentShader: riverFragment, alphaToCoverage: true
    }));
    stream.renderOrder = 4;
    tetons.world.add(stream);

    let lastReflection = -Infinity;
    const reflectedEye = new T.Vector3(), plane = new T.Plane(), vec = new T.Vector4(), corner = new T.Vector4(), aim = new T.Vector3();
    function renderReflection(clock, width, height, level, viewCam) {
      if (clock - lastReflection < .16 && reflectedEye.distanceToSquared(viewCam.position) < 9.0) return;
      lastReflection = clock;
      reflectedEye.copy(viewCam.position);
      const w = Math.min(420, Math.max(120, Math.floor(width * .45)));
      const h = Math.max(90, Math.floor(w * height / Math.max(1, width)));
      if (reflection.width !== w || reflection.height !== h) reflection.setSize(w, h);
      reflectionSize.set(w, h);
      mirror.position.set(viewCam.position.x, 2 * level - viewCam.position.y, viewCam.position.z);
      viewCam.getWorldDirection(aim);
      aim.y = -aim.y;
      mirror.up.set(0, -1, 0);
      mirror.lookAt(aim.add(mirror.position));
      mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(viewCam.projectionMatrix);
      plane.setComponents(0, 1, 0, -level + .14);
      plane.applyMatrix4(mirror.matrixWorldInverse);
      vec.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const m = mirror.projectionMatrix.elements;
      corner.set((Math.sign(vec.x) + m[8]) / m[0], (Math.sign(vec.y) + m[9]) / m[5], -1, (1 + m[10]) / m[14]);
      vec.multiplyScalar(2 / vec.dot(corner));
      m[2] = vec.x; m[6] = vec.y; m[10] = vec.z + 1; m[14] = vec.w;
      reflectionMatrix.multiplyMatrices(mirror.projectionMatrix, mirror.matrixWorldInverse);
      updateSkyBasis(mirror);
      stream.visible = false;
      renderer.setRenderTarget(reflection);
      try { renderer.render(tetons.world, mirror); }
      finally { stream.visible = true; renderer.setRenderTarget(null); }
    }

    /* MONOLITH-3 Props: Overlook Survey Deck, Forest/Grove Billboards, Boulders, Ford Riffles, Cloud Bridge & Iron Gate */
    const metal = new T.MeshStandardMaterial({ color: 0xaaa59a, roughness: .42, metalness: .49 });
    const iron = new T.MeshStandardMaterial({ color: 0x333532, roughness: .62, metalness: .64 });
    const pale = new T.MeshStandardMaterial({ color: 0xc8c2b3, roughness: .86 });
    const dark = new T.MeshStandardMaterial({ color: 0x232421, roughness: 1 });
    const walnutMat = new T.MeshStandardMaterial({ color: 0x42403c, roughness: .62, map: tex["prop-ground"] });
    const rockMaterial = new T.MeshStandardMaterial({ color: 0x7e7e7e, map: tex["prop-rock"], roughness: .93 });
    const wood = new T.MeshStandardMaterial({ color: 0x505050, map: tex["prop-ground"], roughness: .88 });
    const block = new T.BoxGeometry(1, 1, 1), ball = new T.SphereGeometry(1, 22, 16), cylinder = new T.CylinderGeometry(1, 1, 1, 14);
    const ringGeo = new T.TorusGeometry(1, .09, 10, 40), boulderGeo = new T.IcosahedronGeometry(1, 1);
    const addMesh = (grp, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
      const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); grp.add(m); return m;
    };
    const box = (grp, mat, x, y, z, sx, sy, sz) => addMesh(grp, block, mat, x, y, z, sx, sy, sz);
    const rock = (grp, mat, x, y, z, sx, sy, sz, a = 0) => { const m = addMesh(grp, boulderGeo, mat, x, y, z, sx, sy, sz); m.rotation.y = a; return m; };

    // Snake River Overlook Survey Deck + Ramp
    const DECK_Y = 156.31;
    const deckGroup = new T.Group();
    tetons.world.add(deckGroup);
    box(deckGroup, wood, -36.5, DECK_Y - .14, 1.35, 23.6, .24, 7.8);
    for (let i = 0; i < 14; i++) box(deckGroup, walnutMat, -47.8 + i * 1.75, DECK_Y - .01, 1.35, .12, .03, 7.7);
    for (const z of [-2.4, 5.1]) box(deckGroup, wood, -36.5, DECK_Y + .04, z, 23.6, .09, .16);
    box(deckGroup, wood, -48.25, DECK_Y + .04, 1.35, .16, .09, 7.8);
    for (const x of [-47.4, -40, -32.5, -25.4]) for (const z of [-2.1, 4.8]) {
      const gy = tetonRawGround(x, z) - 1.2, h = Math.max(1, DECK_Y - gy);
      box(deckGroup, iron, x, gy + h / 2, z, .26, h, .26);
    }
    const ramp = box(deckGroup, wood, -22.2, 155.8, 1.35, 5.5, .22, 7.6);
    ramp.rotation.z = -.18;

    // Instanced Trees (7,400+ Tetons + 4,400+ Half Dome in one world scene)
    const random = seedRandom(77269);
    function addTrees(worldParent, data) {
      if (!data.length) return;
      const g = new T.PlaneGeometry(1, 1);
      const mat = new T.ShaderMaterial({
        uniforms: { ...lighting, uSky: U("sky-plate"), uCrowns: U("crowns") },
        vertexShader: gameBillboardVertex, fragmentShader: gameBillboardFragment, side: T.DoubleSide
      });
      const mesh = new T.InstancedMesh(g, mat, data.length);
      const o = new T.Object3D(), seed = new Float32Array(data.length);
      data.forEach(([x, y, z, h, w, mark], i) => {
        o.position.set(x, y - .06, z); o.scale.set(w, h, 1); o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix); seed[i] = mark;
      });
      g.setAttribute("aSeed", new T.InstancedBufferAttribute(seed, 1));
      mesh.computeBoundingSphere();
      mesh.boundingSphere.radius += 25;
      worldParent.add(mesh);
    }

    const forest = [];
    for (let i = 0; i < crownPositions.length; i += 5) {
      const [x, , z, raw, cover] = crownPositions.subarray(i, i + 5);
      if (x > 290 || Math.hypot(x - ABYSS_OX, z - ABYSS_OZ) < 175 || Math.hypot(x - AHIYA_OX, z - AHIYA_OZ) < 230) continue;
      if (wet(x, z) > .4 || random() < .19) continue;
      if (x > -450 && x < -205 && Math.abs(z + 54) < 9) continue;
      if (x > -120 && x < -12 && z > -180 && z < 15) continue;
      const bar = maskAt(covers, x, z, 0) / 255;
      if (bar > .29 && random() < .81) continue;
      const h = Math.min(raw, 27) * (bar > .19 ? .43 : .86 + .13 * random());
      const id = h > 10 ? (random() < .70 ? 0 : 3) : h > 6 ? (random() < .51 ? 10 : 6) : 8;
      forest.push([x, unifiedGround(x, z), z, h, h * config.crownRatios[id] * (.71 + cover * .19), id + random() * .995]);
    }
    for (let i = 0; i < 7400; i++) {
      const x = -720 + random() * 444, z = -168 + random() * 344;
      const bar = maskAt(covers, x, z, 0) / 255;
      if (bar < .08 || wet(x, z) > -1.6 || Math.abs(z + 55) < 4.5 || random() > (maskAt(covers, x, z, 1) / 255) * .48) continue;
      const h = .40 + 4.3 * random() ** 1.4;
      forest.push([x, unifiedGround(x, z), z, h, h * 1.38, 8 + random() * 1.98]);
    }
    addTrees(tetons.world, forest);

    const grove = [];
    for (let i = 0; i < 4400; i++) {
      const lx = -2050 + random() * 2370, lz = -1970 + random() * 2200, wx = RIDGE_OX - lx, wz = RIDGE_OZ - lz;
      if (wx < 312) continue;
      const ly = ridgeGround(lx, lz);
      if (ly > 700 || (lx > 58 && lx < 98 && lz > -102 && lz < 44)) continue;
      const grade = Math.abs(ridgeGround(lx + 6, lz) - ly) + Math.abs(ridgeGround(lx, lz + 6) - ly);
      if (grade > 6 || random() < .23) continue;
      const h = 4.7 + 20 * random() ** 1.5;
      grove.push([lx, ly, lz, h, h * (.48 + .31 * random()), (random() < .71 ? 0 : 10) + random() * 1.91]);
    }
    addTrees(ridgeAnchor, grove);

    function stones(worldParent, ground, count, bounds, isTeton) {
      const [x0, x1, z0, z1] = bounds;
      const mesh = new T.InstancedMesh(boulderGeo, rockMaterial, count);
      const o = new T.Object3D(), col = new T.Color();
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 6) {
        tries++;
        const x = lerp(x0, x1, random()), z = lerp(z0, z1, random());
        const s = .073 + (random() ** 3.3) * .84;
        if (isTeton && (wet(x, z) > -.5 || (x > -52 && x < -14 && z > -10 && z < 12) || Math.hypot(x - ABYSS_OX, z - ABYSS_OZ) < 170 || Math.hypot(x - AHIYA_OX, z - AHIYA_OZ) < 230)) continue;
        if (!isTeton && x > 67 && x < 83 && z > -32 && z < 5) continue;
        o.position.set(x, ground(x, z) + s * .11, z);
        o.rotation.set(random() * .62, random() * TAU, random() * .82);
        o.scale.set(s * (1.16 + random() * .82), s * (.29 + random() * .55), s * (.81 + random() * .82));
        o.updateMatrix();
        mesh.setMatrixAt(placed, o.matrix);
        col.setScalar(.42 + random() * .69);
        mesh.setColorAt(placed, col);
        placed++;
      }
      mesh.count = placed;
      mesh.computeBoundingSphere();
      worldParent.add(mesh);
    }
    stones(tetons.world, unifiedGround, 850, [-460, -200, -114, 22], true);
    stones(tetons.world, unifiedGround, 1100, [-960, -15, -220, 230], true);
    stones(ridgeAnchor, ridgeGround, 720, [37, 118, -119, 61], false);
    stones(ridgeAnchor, ridgeGround, 950, [-280, 305, -340, 210], false);

    /* Silver Ford & Half Dome Cloud Bridge */
    const fordShader = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      uniforms: { uTime: time, uCobbles: U("cobbles"), uFordSolid: { value: 1 }, uFordZone: { value: 7 } },
      vertexShader: meshVertex,
      fragmentShader: `
        varying vec3 vWorld; varying vec2 vUV; uniform sampler2D uCobbles; uniform float uTime, uFordSolid, uFordZone;
        ${noiseGLSL}
        void main() {
          vec2 p = vWorld.xz;
          float chips = fbm(p * vec2(2.9, 4.2) + 7.3);
          float edge = 1. - smoothstep(.39, .50, abs(vUV.y - .5) + .13 * (chips - .5));
          float ends = smoothstep(.0, .06, vUV.x) * (1. - smoothstep(.94, 1., vUV.x));
          float grit = texture2D(uCobbles, p * .82).r;
          float flow = noise2(vec2(p.x * .93, p.y * 5. - uTime * 2.8));
          float frost = .18 + .19 * grit + .12 * chips + .028 * (uFordZone - 5.);
          float glare = .53 + .22 * pow(flow, 3.) + .05 * grit;
          gl_FragColor = vec4(vec3(paper(clamp(mix(glare, frost, uFordSolid), 0., .97))), edge * ends * (.63 + .35 * uFordSolid));
        }`
    });
    const fordPatch = new T.Mesh(rasterMesh((x, z) => water.at(x, z) + .11, [-360, -279, 50.5, 59.5], 106, 15), fordShader);
    fordPatch.renderOrder = 8;
    tetons.world.add(fordPatch);
    const oxbowRiffle = new T.Mesh(rasterMesh((x, z) => water.at(x, z) + .11, [-585, -470, -182, -132], 64, 28), fordShader);
    oxbowRiffle.renderOrder = 8;
    tetons.world.add(oxbowRiffle);

    const bridgeHeight = (x, z) => lerp(ridgeGround(x, -34), ridgeGround(x, 5.3), clamp((z + 34) / 39.3, 0, 1)) + .065;
    const bridgeMat = new T.ShaderMaterial({
      transparent: true, side: T.DoubleSide, depthWrite: false,
      uniforms: { ...lighting, uRock: U("rock"), uCloudSolid: { value: 1 } },
      vertexShader: meshVertex,
      fragmentShader: `
        varying vec3 vWorld; varying vec2 vUV; uniform sampler2D uRock; uniform float uTime, uCloudSolid;
        ${noiseGLSL}
        void main() {
          float edge = 1. - smoothstep(.33, .50, abs(vUV.x - .5));
          float stone = texture2D(uRock, vWorld.xz * .51).r;
          float billow = fbm(vWorld.xz * .37 + vec2(uTime * .12, 0.));
          float mass = (.046 + .17 * stone) * (.63 + .65 * billow);
          gl_FragColor = vec4(vec3(paper(mix(.51 + .20 * billow, mass, uCloudSolid))), mix(.37, .96, uCloudSolid) * edge);
        }`
    });
    const cloudBridge = new T.Mesh(rasterMesh(bridgeHeight, [70.5, 79.5, -5.3, 34], 18, 87), bridgeMat);
    cloudBridge.renderOrder = 8;
    ridgeAnchor.add(cloudBridge);

    for (const [cx, cz] of [[-246, -54.8], [-518, 94], [-790, -35]]) {
      const cy = unifiedGround(cx, cz), g = new T.Group();
      g.position.set(cx, cy, cz); tetons.world.add(g);
      rock(g, rockMaterial, 0, .19, 0, .55, .37, .45, .5);
      addMesh(g, cylinder, metal, 0, 1.05, 0, .075, .42, .075);
      const r = addMesh(g, ringGeo, metal, 0, 1.45, 0, .30, .30, .30); r.rotation.y = .7;
    }
    for (const [cx, cz] of [[75, 8], [75, -88], [220, -45]]) {
      const cy = ridgeGround(cx, cz), g = new T.Group();
      g.position.set(cx, cy, cz); ridgeAnchor.add(g);
      rock(g, rockMaterial, 0, .19, 0, .55, .37, .45, .5);
      addMesh(g, cylinder, metal, 0, 1.05, 0, .075, .42, .075);
      const r = addMesh(g, ringGeo, metal, 0, 1.45, 0, .30, .30, .30); r.rotation.y = .7;
    }

    const gate = new T.Group();
    gate.position.set(75, ridgeGround(75, -49), -49);
    ridgeAnchor.add(gate);
    for (const side of [-1, 1]) {
      rock(gate, rockMaterial, side * 3.25, 1.58, 0, 1.23, 2.34, 1.4, .4);
      box(gate, iron, side * 2.65, 1.56, 0, .19, 3.38, .19);
    }

    // Survey cairns at the Silver Ford posts for landmarks
    for (const x of [-274, -367]) for (const z of [-60, -50]) {
      const y = unifiedGround(x, z);
      box(tetons.world, dark, x, y + .46, z, .14, .94, .14);
      box(tetons.world, pale, x, y + .87, z, .185, .14, .184);
    }

    /* ---------- Build Abyssal Garden · Whale Fluke Sanctuary inside Unified World (West of Pueblo) ---------- */
    const abyssGroup = new T.Group();
    abyssGroup.position.set(ABYSS_OX, ABYSS_BASE_Y, ABYSS_OZ);
    abyssGroup.scale.set(ABYSS_SCALE, 1.15, ABYSS_SCALE);
    tetons.world.add(abyssGroup);

    const abVertexMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: .06 });
    const abWhale = new T.Mesh(mkAbyssWhaleGeo(), abVertexMat);
    const abShip = new T.Mesh(mkAbyssShipGeo(), abVertexMat);
    const abArch = new T.Mesh(mkAbyssArchGeo(), abVertexMat);
    abyssGroup.add(abWhale, abShip, abArch);

    // Animated Caustic Seabed Blanket over Whale Fluke Sanctuary (matches media_1794893283597_4a288d06.jpg)
    const abCaustGeo = rasterMesh((ax, az) => abSeabedH(ax, az) + .14, [-78, 78, -78, 78], 84, 84);
    const abCaustMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: time },
      vertexShader: `varying vec3 vLocalP; void main() { vLocalP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `
        varying vec3 vLocalP; uniform float uTime;
        float caustP(vec2 p, float t) {
          mat2 m1 = mat2(.80, -.60, .60, .80), m2 = mat2(-.55, .835, -.835, -.55);
          vec2 uv1 = m1 * p * .34 + vec2(t * .16, -t * .11), uv2 = m2 * p * .43 + vec2(-t * .13, t * .19);
          vec2 s1 = sin(uv1 * 3.14159 + cos(uv1.yx * 2.7 + t * .8)), s2 = sin(uv2 * 3.14159 + sin(uv2.yx * 3.1 - t * .7));
          float w = abs(s1.x * s1.y + s2.x * s2.y) * .5;
          return pow(clamp(1. - abs(w - .32) * 3.1, 0., 1.), 3.4) * .85;
        }
        void main() {
          float r = length(vLocalP.xz);
          float fade = 1. - smoothstep(42., 74., r);
          if (fade < .01) discard;
          float c = caustP(vLocalP.xz * .75, uTime * 3.2);
          float ripple = sin(vLocalP.x * 1.45 + vLocalP.z * .65) * .5 + .5;
          vec3 sand = mix(vec3(.08, .38, .46), vec3(.18, .66, .74), ripple * .45);
          vec3 col = sand + vec3(.38, .92, .96) * c * .82;
          gl_FragColor = vec4(col, fade * .86);
        }`
    });
    const abCaustMesh = new T.Mesh(abCaustGeo, abCaustMat);
    abCaustMesh.renderOrder = 3;
    abyssGroup.add(abCaustMesh);

    // Overhead Sunlight Caustic Water Surface Canopy (above driving height!)
    const abSurfMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      uniforms: { uTime: time },
      vertexShader: `varying vec2 vXZ; void main() { vXZ = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `
        varying vec2 vXZ; uniform float uTime;
        void main() {
          float r = length(vXZ);
          float fade = 1. - smoothstep(55., 95., r);
          float w = sin(vXZ.x * .35 + uTime * 2.4) * cos(vXZ.y * .32 - uTime * 1.9);
          vec3 col = mix(vec3(.12, .56, .72), vec3(.58, .94, 1.), smoothstep(.1, .85, w));
          gl_FragColor = vec4(col, fade * .28);
        }`
    });
    const abSurf = new T.Mesh(new T.PlaneGeometry(195, 195), abSurfMat);
    abSurf.rotation.x = -Math.PI / 2;
    abSurf.position.set(0, (ABYSS_SURF_Y - ABYSS_BASE_Y) / 1.15, 0);
    abSurf.renderOrder = 6;
    abyssGroup.add(abSurf);

    // Instanced Violet/Coral Reef Sponges & Branching Corals (as seen in Whale Fluke Sanctuary)
    const abRng = seedRandom(0x4E1B2026);
    const abCoralPalette = [[.36, .16, .78], [.62, .20, .64], [.82, .32, .42], [.18, .54, .68], [.44, .28, .88]];
    const abHotspots = [[-6.8, 9.8], [-5.2, 7.6], [-8.4, 11.4], [5.8, 10.6], [7.6, 12.2], [4.4, 8.8], [18.0, -3.5], [15.2, -6.5], [-12.5, -21.0]];
    const coralMesh = new T.InstancedMesh(mkAbyssCoralGeo(), abVertexMat, 180);
    const spongeMesh = new T.InstancedMesh(mkAbyssSpongeGeo(), abVertexMat, 140);
    const instObj = new T.Object3D(), instCol = new T.Color();
    for (let i = 0; i < 320; i++) {
      let ax, az;
      if (i < 130) {
        const hs = abHotspots[i % abHotspots.length];
        ax = hs[0] + (abRng() - .5) * 9.0; az = hs[1] + (abRng() - .5) * 9.0;
      } else {
        const rr = Math.sqrt(abRng()) * 58.0, aa = abRng() * TAU;
        ax = Math.cos(aa) * rr; az = Math.sin(aa) * rr;
      }
      if (Math.hypot(ax - .4, az - 8.2) < 5.2 || Math.hypot(ax - 7.5, az - 10.5) < 4.4) { ax += 6.0; }
      const ay = abSeabedH(ax, az) - .06, sc = .55 + (abRng() ** 1.4) * 1.40;
      instObj.position.set(ax, ay, az);
      instObj.rotation.set((abRng() - .5) * .24, abRng() * TAU, (abRng() - .5) * .24);
      instObj.scale.setScalar(sc);
      instObj.updateMatrix();
      const pal = abCoralPalette[(abRng() * abCoralPalette.length) | 0];
      instCol.setRGB(pal[0], pal[1], pal[2]);
      if (i < 180) { coralMesh.setMatrixAt(i, instObj.matrix); coralMesh.setColorAt(i, instCol); }
      else { spongeMesh.setMatrixAt(i - 180, instObj.matrix); spongeMesh.setColorAt(i - 180, instCol); }
    }
    coralMesh.instanceMatrix.needsUpdate = spongeMesh.instanceMatrix.needsUpdate = true;
    coralMesh.computeBoundingSphere(); spongeMesh.computeBoundingSphere();
    abyssGroup.add(coralMesh, spongeMesh);

    // Animated Manta Rays & Bioluminescent Jellyfish over the Whale Fluke Sanctuary
    const mantaDefs = [
      { cx: -6, cy: 13.8, cz: -8, rx: 14.5, rz: 12, speed: .15, phase: .4, scale: 1.55 },
      { cx: -13.5, cy: 16.5, cz: -24, rx: 11, rz: 10.5, speed: -.13, phase: 2.3, scale: 1.35 },
      { cx: 14, cy: 11.2, cz: -4, rx: 13, rz: 14, speed: .14, phase: 4.1, scale: 1.45 },
      { cx: 2, cy: 18.2, cz: 4, rx: 18, rz: 15, speed: .11, phase: 1.2, scale: 1.70 },
      { cx: 10, cy: 8.5, cz: -28, rx: 12, rz: 11, speed: -.14, phase: 5.0, scale: 1.40 },
      { cx: 0, cy: 12.0, cz: 10, rx: 15, rz: 12, speed: .12, phase: 3.1, scale: 1.50 }
    ];
    const mantaMesh = new T.InstancedMesh(mkAbyssMantaGeo(), abVertexMat, mantaDefs.length);
    abyssGroup.add(mantaMesh);

    const jellyDefs = Array.from({ length: 22 }, (_, j) => {
      const ax = (j < 12 ? -6 + abRng() * 32 : (abRng() - .5) * 52), az = -8 - abRng() * 32;
      return { bx: ax, by: clamp(abSeabedH(ax, az) + 3.2 + abRng() * 8.5, 2, 18), bz: az, scale: .65 + abRng() * .75, phase: abRng() * TAU };
    });
    const jellyMat = new T.MeshStandardMaterial({ vertexColors: true, emissive: 0x1680ff, emissiveIntensity: .9, transparent: true, opacity: .82, roughness: .2 });
    const jellyMesh = new T.InstancedMesh(mkAbyssJellyGeo(), jellyMat, jellyDefs.length);
    abyssGroup.add(jellyMesh);

    function abyssAnimate(nowSec) {
      for (let i = 0; i < mantaDefs.length; i++) {
        const m = mantaDefs[i], th = nowSec * m.speed + m.phase;
        const x = m.cx + Math.cos(th) * m.rx, z = m.cz + Math.sin(th) * m.rz, y = m.cy + Math.sin(th * 2 + m.phase) * 1.45;
        const vx = -Math.sin(th) * m.rx * m.speed, vz = Math.cos(th) * m.rz * m.speed, vy = Math.cos(th * 2 + m.phase) * 2 * m.speed * 1.45;
        instObj.position.set(x, y, z);
        instObj.rotation.set(-Math.atan2(vy, Math.hypot(vx, vz)), Math.atan2(vx, vz), clamp(-m.speed * 1.65 * Math.cos(th), -.35, .35), "YXZ");
        instObj.scale.setScalar(m.scale);
        instObj.updateMatrix();
        mantaMesh.setMatrixAt(i, instObj.matrix);
      }
      mantaMesh.instanceMatrix.needsUpdate = true;
      for (let j = 0; j < jellyDefs.length; j++) {
        const jl = jellyDefs[j], ph = nowSec * 1.65 + jl.phase;
        instObj.position.set(jl.bx + Math.sin(nowSec * .25 + jl.phase) * .85, jl.by + Math.sin(nowSec * .45 + jl.phase * 1.4) * .95 - Math.cos(ph) * .14, jl.bz + Math.cos(nowSec * .22 + jl.phase) * .85);
        instObj.rotation.set(Math.sin(nowSec * .4 + jl.phase) * .14, jl.phase, 0);
        instObj.scale.set(jl.scale * (1 + Math.sin(ph) * .12), jl.scale * (1 - Math.sin(ph) * .08), jl.scale * (1 + Math.sin(ph) * .12));
        instObj.updateMatrix();
        jellyMesh.setMatrixAt(j, instObj.matrix);
      }
      jellyMesh.instanceMatrix.needsUpdate = true;
    }

    // Find dramatic high summits dynamically in Teton & Half Dome DEMs for instant Base-Jump launch!
    let bestTetonPeak = { x: -180, z: -260, y: unifiedGround(-180, -260) };
    for (let x = -480; x <= 60; x += 28) {
      for (let z = -340; z <= 320; z += 28) {
        const y = unifiedGround(x, z);
        if (y > bestTetonPeak.y && Math.hypot(x + 260, z + 30) > 130) bestTetonPeak = { x, z, y };
      }
    }
    let bestHalfDomeLocal = { x: -260, z: -30, y: ridgeGround(-260, -30) };
    for (let lx = -540; lx <= -160; lx += 20) {
      for (let lz = -220; lz <= 120; lz += 20) {
        const ly = ridgeGround(lx, lz);
        if (ly >= 320 && ly <= 540 && Math.hypot(lx - 75, lz + 15) < Math.hypot(bestHalfDomeLocal.x - 75, bestHalfDomeLocal.z + 15) + 80) {
          if (ly > bestHalfDomeLocal.y || bestHalfDomeLocal.y < 300) bestHalfDomeLocal = { x: lx, z: lz, y: ly };
        }
      }
    }
    const bestHalfDomePeak = {
      x: RIDGE_OX - bestHalfDomeLocal.x,
      z: RIDGE_OZ - bestHalfDomeLocal.z,
      y: RIDGE_OY + bestHalfDomeLocal.y
    };

    if (loaderMsg) loaderMsg.textContent = "Capturing 8×10 Filmstrip Trees, Wagon & Spatial Radio…";
    return {
      world: tetons.world, worldLight: tetons.light,
      coatTextures, rawImages: images, time, glass, sun,
      skyUniforms, waterUniforms, updateSkyBasis, renderReflection,
      unifiedGround, tetonGround: tetonRawGround, ridgeGround,
      water: (x, z) => water.at(x, z), wet,
      fordPatch, bridgeMat, bridgeHeight: (wx, wz) => RIDGE_OY + bridgeHeight(RIDGE_OX - wx, RIDGE_OZ - wz), DECK_Y,
      bestTetonPeak, bestHalfDomePeak, tetonRange, tetonMountainBounds: config.mountainRelief, playableBounds, abyssAnimate, stream
    };
  }

  /* ---------- Core Catalog: 11 Zone Vantages Mapped to Real MONOLITH-3 Landmarks + 14 GPU Looks ---------- */
  const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const LOOKS = [
    { id: "embers", name: "LIGHT ALONE", zone: 0, trail: .88, desc: "Darkness pierced by drifting embers while keeping surface definition." },
    { id: "set", name: "THE SET", zone: 1, trail: .36, desc: "High-definition 320-line phosphor monitor with slow sync sweep." },
    { id: "cave", name: "WARM CAVE", zone: 2, trail: .72, desc: "Thermal heat vision blended with crisp stone relief." },
    { id: "silhouette", name: "SILHOUETTE", zone: 3, trail: .22, desc: "Lit warm tissue paper, crisp ink shadows, and vermilion highlights." },
    { id: "woodblock", name: "WOODBLOCK", zone: 4, trail: .15, desc: "Carved indigo, slate, cream, and rust woodcut blocks with surface grain." },
    { id: "silver", name: "SILVER GELATIN", zone: 5, trail: .08, desc: "High-clarity Ansel Adams selenium-toned 8×10 silver print." },
    { id: "card", name: "THE CARD", zone: 6, trail: .10, desc: "Cream archival stock hatched and cross-engraved by light." },
    { id: "spray", name: "SPRAY WALL", zone: 7, trail: .82, desc: "Celluloid mural wall, white paper outlines, and dripping pigment." },
    { id: "watercolour", name: "WATERCOLOUR", zone: 8, trail: .16, desc: "Pencil underdrawing washed with translucent pigment on paper." },
    { id: "cyanotype", name: "CYANOTYPE", zone: 9, trail: .65, desc: "Brushed Prussian blue blueprint exposed to bright highland sun." },
    { id: "glass", name: "GLASS", zone: 10, trail: .76, desc: "X-ray refraction tracing glowing contour edges over deep stone." },
    { id: "risograph", name: "RISOGRAPH", zone: -1, trail: .12, desc: "Misregistered pink, yellow, and cobalt halftone drums on cream." },
    { id: "inkwash", name: "INK WASH", zone: -1, trail: .16, desc: "Sumi-e ink dilutions on fibrous paper with red stone seal." },
    { id: "jerikan", name: "CYAN JERIKAN", zone: -1, trail: .32, desc: "Silver-gelatin stone & burro with selective electric-cyan WiFi water & jerrycans." }
  ];

  const ZONES = [
    { z: 0, region: "tetons", look: 0, refl: .05, name: "Overlook Rim Shadow", swatch: "#080809", x: -45, pz: 1.4, desc: "Let the rim disappear into black." },
    { z: 1, region: "tetons", look: 1, refl: .11, name: "Upper Moraine Timber", swatch: "#15161a", x: -22, pz: -52, desc: "Keep the thinnest separation between trunks." },
    { z: 2, region: "ridge", look: 2, refl: .18, name: "Half Dome Cloud Notch", swatch: "#262328", x: 545, pz: -16, desc: "Separate the notch from its cloud." },
    { z: 3, region: "tetons", look: 3, refl: .27, name: "Bluff Switchback Pines", swatch: "#393734", x: -48, pz: -168, desc: "Hold thread and bark in open shadow." },
    { z: 4, region: "tetons", look: 13, refl: .38, name: "Snake River Overlook", swatch: "#54524a", x: -20, pz: 1.4, desc: "Keep distant conifers distinct from the river." },
    { z: 5, region: "tetons", look: 5, refl: .50, name: "Juniper Sage Bench", swatch: "#76746b", x: -162, pz: -112, desc: "Set the gray card beside the sage." },
    { z: 6, region: "tetons", look: 6, refl: .64, name: "The Silver Ford", swatch: "#96948a", x: -248, pz: -55, desc: "Keep fibers in the raised ferry rope." },
    { z: 7, region: "tetons", look: 7, refl: .74, name: "Cottonwood Oxbow Kiosk", swatch: "#b5b2a6", x: -518, pz: 94, desc: "Give linen shape where it catches light." },
    { z: 8, region: "abyss", look: 8, refl: .83, name: "Abyssal Whale Fluke Sanctuary", swatch: "#cfcbb9", x: -1080, pz: -22, desc: "Hold a trace of spray above the fluke." },
    { z: 9, region: "ridge", look: 9, refl: .90, name: "Half Dome East Apron", swatch: "#e4e3d8", x: 435, pz: 38, desc: "Let the brightest granite soften." },
    { z: 10, region: "tetons", look: 10, refl: .96, name: "Far-Bank Highland Pueblo", swatch: "#f6f4ec", x: -780, pz: -35, desc: "Give one small area to bare paper." }
  ];

  const SONG_EPOCHS = [
    { t0: 0,   t1: 45,  name: "I · Wellhead Awakening",    zone: 4, relayId: "switchback", hint: "Tune Z-IV Cyan Jerikan to bridge Overlook -> Switchback." },
    { t0: 45,  t1: 94,  name: "II · Hooves on Cobble",    zone: 6, relayId: "ford",       hint: "Tune Z-VI Card across the Silver Ford riffles." },
    { t0: 94,  t1: 140, name: "III · Kidase Under Awning", zone: 7, relayId: "oxbow",      hint: "Tune Z-VII Spray Wall through Cottonwood Oxbow." },
    { t0: 140, t1: 186, name: "IV · Tezeta Ferric Drop",   zone: 10, relayId: "pueblo",    hint: "Tune Z-X Glass into the Highland Pueblo Sanctuary." },
    { t0: 186, t1: 235, name: "V · Whale Fluke Tide",      zone: 8, relayId: "abyss",      hint: "Tune Z-VIII Watercolour west into the Abyssal Film Forest." },
    { t0: 235, t1: 290, name: "VI · Cosmic Addis Summit",  zone: 9, relayId: "halfdome",   hint: "Tune Z-IX Cyanotype east across the Yosemite Pass to Half Dome." }
  ];

  const MODES = [
    { id: "jerikan", label: "DONKEY WATER", sub: "Cyan Jerikan Sci-Fi", desc: "MONOLITH-3 silver-gelatin print transformed inside live WiFi water fields with selective electric-cyan jerrycans, rain & Filmstrip Forest." },
    { id: "threshold", label: "THRESHOLD", sub: "Tonal + Depth Pull", desc: "All 11 Zone shaders populate tonal & depth bands across the Tetons and Half Dome while sharp focus pulls clarity." },
    { id: "shells", label: "DEPTH SHELLS", sub: "Spatial Slides", desc: "Eleven concentric spatial Zone shaders sweep across 3D distance out toward the peaks." },
    { id: "strata", label: "TONAL STRATA", sub: "11-Zone Bands", desc: "Filtered scene luminance routes terrain and granite cliffs into Zone shaders 0–X." }
  ];

  const STOPS = [
    { name: "f/5.6", oct: .36, lock: 0 },
    { name: "f/8", oct: .52, lock: .08 },
    { name: "f/16", oct: .84, lock: .24 },
    { name: "f/32", oct: 1.35, lock: .56 },
    { name: "f/64", oct: 2.2, lock: .88 }
  ];

  const FILTERS = [
    { name: "CLEAR", short: "Clear", rgb: [1, 1, 1], jerikan: 0 },
    { name: "YELLOW #8", short: "Yellow", rgb: [1.14, 1.05, .42], jerikan: 0 },
    { name: "ORANGE #15", short: "Orange", rgb: [1.26, .88, .24], jerikan: 0 },
    { name: "RED #25", short: "Red", rgb: [1.45, .44, .18], jerikan: 0 },
    { name: "GREEN #58", short: "Green", rgb: [.52, 1.32, .56], jerikan: 0 },
    { name: "BLUE JERIKAN #47B", short: "Jerikan #47B", rgb: [1.02, 1.02, 1.18], jerikan: 1 }
  ];

  const LYRICS = [
    [0, "Intro · Warm cassette tape wakes before the rooster."],
    [12, "“Iron lever cracks before the rooster / My hands know the cold of it.”"],
    [28, "“Cyan jerikan balanced on my shoulder blade / Stone steps climbing toward a blue-lit door.”"],
    [45, "“Take this water from my well / Will you carry what I cannot.”"],
    [62, "“Carry the cyan up the ridge with me / Hooves on cobble and the tape is turning.”"],
    [94, "“Kidase hums beneath the kiosk awning / Static blooms across the dial.”"],
    [118, "“My father dubbed his Tezeta onto ferric / Every slosh a metronome.”"],
    [152, "“Carry the cyan up the ridge with me / Brass comes back and the crates are spinning.”"],
    [186, "“Rope creaks · Wind holds its breath · The drums step out · And the basin fills.”"],
    [220, "“Cosmic Addis Arkestra — carry WiFi water up to the Highland Pueblo.”"]
  ];

  const STORAGE_KEY = "donkey-water/night-post/3d-plates/1";
  const urlParams = new URLSearchParams(location.search);
  const urlMode = urlParams.get("mode");
  const initModeIdx = urlMode && MODES.some(m => m.id === urlMode) ? MODES.findIndex(m => m.id === urlMode) : 0;
  const rawCircuitParam = urlParams.get("circuit");
  const initCircuitParam = rawCircuitParam === "ahiya" ? "ahiya" : rawCircuitParam === "west" ? "west" : "";
  const skipIntroParam = urlParams.get("demo") === "ahiya" || urlParams.get("skipIntro") === "1" || urlParams.get("trailer") === "1" || urlParams.get("musicvideo") === "1" || urlParams.get("machinima") === "1";

  /* ---------- WebAudio: 3D Spatial Donkey Panner + Air Lowpass + Beat Detector ---------- */
  const audio = (() => {
    let ctx = null, master = null, enabled = false, analyser = null, freqData = null, tapeConnected = false;
    let panner = null, airFilter = null, spatialGain = null, directGain = null, recDest = null, musicOut = null, synthOut = null;
    let spatialMode = true, distMeters = 5.0, falloffDb = 0, prevBass = 0, beatEnv = 0;
    const bands12 = new Float32Array(12);
    const clocks = [{ period: 1.0, acc: 0, ratio: 1.0, pan: -.45 }, { period: 1.37, acc: .35, ratio: 1.25, pan: 0 }, { period: 1.73, acc: .8, ratio: 1.5, pan: .45 }];
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = .5; master.connect(synthOut || ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return true;
    }
    function connectTape(el) {
      if (tapeConnected || !el || !ensure()) return;
      try {
        const src = ctx.createMediaElementSource(el);
        analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = .72;
        freqData = new Uint8Array(analyser.frequencyBinCount);
        airFilter = ctx.createBiquadFilter(); airFilter.type = "lowpass"; airFilter.frequency.value = 18000; airFilter.Q.value = .65;
        panner = ctx.createPanner();
        panner.panningModel = "HRTF"; panner.distanceModel = "inverse";
        panner.refDistance = 7.5; panner.maxDistance = 420; panner.rolloffFactor = 1.35;
        spatialGain = ctx.createGain(); spatialGain.gain.value = spatialMode ? 1.0 : 0.0;
        directGain = ctx.createGain(); directGain.gain.value = spatialMode ? 0.0 : .85;
        src.connect(analyser);
        analyser.connect(airFilter); airFilter.connect(panner); panner.connect(spatialGain); spatialGain.connect(musicOut || ctx.destination);
        analyser.connect(directGain); directGain.connect(musicOut || ctx.destination);
        if (recDest) { spatialGain.connect(recDest); directGain.connect(recDest); }
        tapeConnected = true;
      } catch {}
    }
    function getRecordStream(el) {
      if (!ensure()) return null;
      if (el) connectTape(el);
      if (!recDest && ctx.createMediaStreamDestination) {
        recDest = ctx.createMediaStreamDestination();
        if (master) master.connect(recDest);
        if (spatialGain) spatialGain.connect(recDest);
        if (directGain) directGain.connect(recDest);
      }
      return recDest ? recDest.stream : null;
    }
    function setSpatialMode(on) {
      spatialMode = !!on;
      if (ctx && spatialGain && directGain) {
        const t = ctx.currentTime;
        spatialGain.gain.setTargetAtTime(spatialMode ? 1.0 : 0.0, t, .05);
        directGain.gain.setTargetAtTime(spatialMode ? 0.0 : .85, t, .05);
      }
      return spatialMode;
    }
    function updateSpatial(camPos, camFwd, donkeyPos) {
      distMeters = Math.hypot(donkeyPos.x - camPos.x, donkeyPos.y + 1.3 - camPos.y, donkeyPos.z - camPos.z);
      if (spatialMode) {
        const gainLinear = 7.5 / (7.5 + 1.35 * Math.max(0, distMeters - 7.5));
        falloffDb = -Math.round(clamp(-20 * Math.log10(Math.max(.005, gainLinear)), 0, 44));
      } else {
        falloffDb = 0;
      }
      if (!ctx || !panner) return;
      const t = ctx.currentTime;
      const px = donkeyPos.x, py = donkeyPos.y + 1.35, pz = donkeyPos.z;
      if (panner.positionX) {
        panner.positionX.setTargetAtTime(px, t, .03);
        panner.positionY.setTargetAtTime(py, t, .03);
        panner.positionZ.setTargetAtTime(pz, t, .03);
      } else panner.setPosition(px, py, pz);
      const L = ctx.listener;
      if (L) {
        if (L.positionX) {
          L.positionX.setTargetAtTime(camPos.x, t, .03);
          L.positionY.setTargetAtTime(camPos.y, t, .03);
          L.positionZ.setTargetAtTime(camPos.z, t, .03);
          L.forwardX.setTargetAtTime(camFwd.x, t, .03);
          L.forwardY.setTargetAtTime(camFwd.y, t, .03);
          L.forwardZ.setTargetAtTime(camFwd.z, t, .03);
          L.upX.setValueAtTime(0, t); L.upY.setValueAtTime(1, t); L.upZ.setValueAtTime(0, t);
        } else {
          L.setPosition(camPos.x, camPos.y, camPos.z);
          L.setOrientation(camFwd.x, camFwd.y, camFwd.z, 0, 1, 0);
        }
      }
      if (airFilter) {
        const cutoff = spatialMode ? lerp(18000, 680, smooth(6, 175, distMeters)) : 18000;
        airFilter.frequency.setTargetAtTime(cutoff, t, .06);
      }
    }
    function sampleTape(dt = .016, nowSec = 0, isPlaying = false) {
      let b = 0, mid = 0, hi = 0;
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        for (let i = 0; i < 8; i++) b += freqData[i];
        for (let i = 8; i < 28; i++) mid += freqData[i];
        for (let i = 28; i < 64; i++) hi += freqData[i];
        b /= 8 * 255; mid /= 20 * 255; hi /= 36 * 255;
        for (let k = 0; k < 12; k++) {
          let sum = 0, start = k * 4, end = start + 4;
          for (let j = start; j < end; j++) sum += freqData[j];
          bands12[k] = sum / (4 * 255);
        }
      }
      if (isPlaying && b < .02) {
        // Fallback 116 BPM 6/8 Addis rhythm envelope when WebAudio buffer is unstarted/headless
        const beatPh = fract(nowSec * (116 / 60));
        const kick = Math.exp(-beatPh * 5.2);
        const off = Math.exp(-fract(beatPh + .5) * 6.5) * .65;
        b = clamp(kick * .72 + off * .35, 0, 1);
        mid = .25 + .45 * Math.exp(-fract(nowSec * (116 / 60) * 1.5) * 4.5);
        hi = .18 + .4 * Math.exp(-fract(nowSec * (116 / 60) * 3.0) * 5.0);
        for (let k = 0; k < 12; k++) {
          const w = k < 4 ? b : k < 8 ? mid : hi;
          bands12[k] = clamp(w * (.65 + .35 * Math.sin(nowSec * 9.5 + k * .9)), .06, .96);
        }
      }
      const flux = Math.max(0, b - prevBass);
      prevBass = lerp(prevBass, b, clamp(dt * 8, 0, 1));
      if (flux > .06 || b > .68) beatEnv = Math.min(1.0, Math.max(beatEnv, b * 1.15));
      beatEnv = Math.max(0, beatEnv - dt * 2.6);
      const atten = spatialMode ? clamp(7.5 / (7.5 + 1.35 * Math.max(0, distMeters - 7.5)), .12, 1.0) : 1.0;
      return { bass: b, mid, high: hi, beatPulse: clamp(beatEnv, 0, 1), spatialBeat: clamp(beatEnv * (.35 + .65 * atten), 0, 1), bands12, distMeters, falloffDb };
    }
    function tone() {
      // Legacy continuous/synth oscillators removed: all ambience/foley comes from HighlandSoundscape + song playback.
      return;
    }
    return {
      toggle() { enabled = !enabled; if (enabled) ensure(); return enabled; },
      context() { return ensure() ? ctx : null; },
      route(musicIn, synthIn) {           // the Ahiya field mixer takes the tape and the tones onto its own buses
        musicOut = musicIn; synthOut = synthIn;
        if (master) { master.disconnect(); master.connect(synthOut); if (recDest) master.connect(recDest); }
        for (const g of [spatialGain, directGain]) if (g) { g.disconnect(); g.connect(musicOut); if (recDest) g.connect(recDest); }
      },
      isOn: () => enabled, connectTape, getRecordStream, sampleTape, setSpatialMode, isSpatial: () => spatialMode, updateSpatial,
      getDistFalloff: () => ({ distMeters, falloffDb }),
      shutter() {},
      pumpClank() {},
      pourSplash() {},
      relayChime() {},
      forestChime() {},
      glideWhoosh() {},
      playEightSecondTail() {},
      playHarmonyRehearsal() {},
      step() {},
      tick() {}
    };
  })();

  /* ---------- Renderer & Post-Processing Pipeline ---------- */
  const canvas = $("view");
  const fieldLayoutQuery = matchMedia("(max-width: 860px), (orientation: portrait) and (max-width: 980px), (pointer: coarse)");
  const forceFieldLayout = urlParams.get("mobile") === "1";
  const useFieldLayout = () => forceFieldLayout || fieldLayoutQuery.matches;
  document.body.classList.toggle("field-ui", useFieldLayout());
  $("loader-retry").addEventListener("click", () => location.reload());
  function showWorldFault(message, error) {
    if (error) console.error("THRESHOLD MONOLITH-3:", error);
    const loader = $("world-loader");
    loader.classList.remove("fade-out");
    loader.hidden = false;
    $("world-loader-msg").textContent = message;
    loader.querySelector(".loader-bar").hidden = true;
    $("loader-actions").hidden = false;
    $("loader-retry").focus();
  }
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  } catch (error) {
    showWorldFault("The 3D view could not start. Retry or return to the index.", error);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = T.NoToneMapping;
  let contextLost = false;
  canvas.addEventListener("webglcontextlost", () => {
    contextLost = true;
    showWorldFault("The 3D view paused. Retry or return to the index.");
  });

  const NEAR = 0.35, FAR = 48000;
  const camera = new T.PerspectiveCamera(47, 1, NEAR, FAR);
  camera.rotation.order = "YXZ";
  camera.up.set(0, 1, 0);

  function applyLevelFPSCamera(x, y, z, yaw, pitch) {
    camera.up.set(0, 1, 0);
    camera.position.set(x, y, z);
    camera.rotation.order = "YXZ";
    camera.rotation.set(clamp(pitch, -.85, .85), yaw, 0);
    camera.updateMatrixWorld();
  }
  function applyLevelChaseCamera(pos, target) {
    camera.up.set(0, 1, 0);
    camera.position.copy(pos);
    camera.rotation.order = "YXZ";
    camera.lookAt(target);
    camera.rotation.z = 0;
    camera.updateMatrixWorld();
  }

  /* Film-strip Textures */
  const filmCanvas = document.createElement("canvas");
  filmCanvas.width = 256; filmCanvas.height = 512;
  const fctx = filmCanvas.getContext("2d");
  fctx.fillStyle = "#161513"; fctx.fillRect(0, 0, 256, 512);
  for (let row = 0; row < 16; row++) {
    const y = row * 32 + 6;
    fctx.fillStyle = "#efe9d8"; fctx.fillRect(10, y, 16, 18); fctx.fillRect(230, y, 16, 18);
  }
  for (let fr = 0; fr < 4; fr++) {
    const y = fr * 128 + 12, g = fctx.createLinearGradient(42, y, 214, y + 104);
    g.addColorStop(0, fr % 2 ? "#0d0d0d" : "#d8d4c8"); g.addColorStop(.5, "#747169"); g.addColorStop(1, fr % 2 ? "#e9e5da" : "#181817");
    fctx.fillStyle = g; fctx.fillRect(42, y, 172, 104);
  }
  const filmTex = new T.CanvasTexture(filmCanvas);
  filmTex.wrapS = filmTex.wrapT = T.RepeatWrapping;

  const forestFilmTex = (() => {
    const fc = document.createElement("canvas"); fc.width = 256; fc.height = 512;
    const fx = fc.getContext("2d");
    fx.fillStyle = "#0e1218"; fx.fillRect(0, 0, 256, 512);
    for (let row = 0; row < 16; row++) {
      const y = row * 32 + 6;
      fx.fillStyle = row % 2 ? "#dcefff" : "#0058e8";
      fx.fillRect(10, y, 17, 18); fx.fillRect(229, y, 17, 18);
    }
    for (let fr = 0; fr < 4; fr++) {
      const y = fr * 128 + 12, g = fx.createLinearGradient(40, y, 216, y + 104);
      g.addColorStop(0, "#0b1a36"); g.addColorStop(.5, fr % 2 ? "#1e66cc" : "#d6dce4"); g.addColorStop(1, "#0048cc");
      fx.fillStyle = g; fx.fillRect(40, y, 176, 104);
      fx.strokeStyle = "#0064ff"; fx.lineWidth = 3; fx.strokeRect(42, y + 2, 172, 100);
    }
    const t = new T.CanvasTexture(fc);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    return t;
  })();

  /* Shared Materials (Low-green Cyan so selective Blue Jerikan #47B glows rich electric cyan) */
  const jerikanMat = new T.MeshStandardMaterial({ color: 0x0066e8, emissive: 0x003ba8, emissiveIntensity: .68, roughness: .28, metalness: .06 });
  const jerikanRibMat = new T.MeshStandardMaterial({ color: 0x004ec4, emissive: 0x002d8a, emissiveIntensity: .56, roughness: .34 });
  const whiteCapMat = new T.MeshStandardMaterial({ color: 0xf4f4f0, roughness: .42 });
  const strapMat = new T.MeshStandardMaterial({ color: 0x1e1b17, roughness: .72 });
  const leatherMat = new T.MeshStandardMaterial({ color: 0x5c361c, roughness: .62 });
  const sawWoodMat = new T.MeshStandardMaterial({ color: 0xb9986b, roughness: .74 });
  const brassMat = new T.MeshStandardMaterial({ color: 0xcab070, roughness: .28, metalness: .82 });
  const ropeHitchMat = new T.MeshStandardMaterial({ color: 0xc8b68c, roughness: .9 });
  const antennaMat = new T.MeshStandardMaterial({ color: 0xe6e3d8, roughness: .25, metalness: .85 });
  const beaconCyanMat = new T.MeshStandardMaterial({ color: 0x006eff, emissive: 0x0048dd, emissiveIntensity: 1.35, roughness: .16 });
  const cyanWaterMat = new T.MeshStandardMaterial({ color: 0x006eff, emissive: 0x0052dd, emissiveIntensity: 1.05, roughness: .18, metalness: .08 });

  const jerBodyGeo = (() => {
    const s = new T.Shape(), a = .112, b = .172, r = .028;
    s.moveTo(-a, -b - r); s.lineTo(a, -b - r); s.quadraticCurveTo(a + r, -b - r, a + r, -b);
    s.lineTo(a + r, b); s.quadraticCurveTo(a + r, b + r, a, b + r); s.lineTo(-a, b + r);
    s.quadraticCurveTo(-a - r, b + r, -a - r, b); s.lineTo(-a - r, -b); s.quadraticCurveTo(-a - r, -b - r, -a, -b - r);
    const g = new T.ExtrudeGeometry(s, { depth: .15, bevelEnabled: true, bevelThickness: .018, bevelSize: .014, bevelSegments: 2 });
    g.translate(0, 0, -.075);
    return g;
  })();
  const jerRibGeo = new T.BoxGeometry(.18, .018, .014);
  const jerSeamGeo = new T.BoxGeometry(.252, .36, .012);
  const jerHandleGeo = new T.BoxGeometry(.155, .042, .052);
  const jerSpoutGeo = new T.CylinderGeometry(.028, .036, .06, 12);
  const jerCapGeo = new T.CylinderGeometry(.034, .034, .032, 12);

  function makeJerikan(scale = 1) {
    const g = new T.Group();
    const b = new T.Mesh(jerBodyGeo, jerikanMat); b.position.y = .21; g.add(b);
    const seam = new T.Mesh(jerSeamGeo, jerikanRibMat); seam.position.y = .21; g.add(seam);
    for (const sgn of [-1, 1]) {
      for (const ang of [.54, -.54]) {
        const rb = new T.Mesh(jerRibGeo, jerikanRibMat);
        rb.position.set(0, .205, sgn * .092); rb.rotation.z = ang; g.add(rb);
      }
    }
    const h = new T.Mesh(jerHandleGeo, jerikanMat); h.position.set(-.032, .42, 0); g.add(h);
    const sp = new T.Mesh(jerSpoutGeo, jerikanMat); sp.position.set(.082, .418, 0); sp.rotation.z = -.25; g.add(sp);
    const cp = new T.Mesh(jerCapGeo, whiteCapMat); cp.position.set(.094, .45, 0); cp.rotation.z = -.25; g.add(cp);
    g.scale.setScalar(scale);
    return g;
  }

  const clearJerShellMat = new T.MeshStandardMaterial({ color: 0x3b4856, roughness: .22, metalness: .12, transparent: true, opacity: .44 });
  const clearJerLiquidGeo = new T.BoxGeometry(.22, .32, .145);
  clearJerLiquidGeo.translate(0, .16, 0);

  function makeFillableJerikan(scale = 1, initialFill = 0, showChalk = false) {
    const g = new T.Group();
    const shell = new T.Mesh(jerBodyGeo, clearJerShellMat); shell.position.y = .21; g.add(shell);
    const liqMat = cyanWaterMat.clone();
    const liq = new T.Mesh(clearJerLiquidGeo, liqMat);
    liq.position.set(0, .05, 0);
    g.add(liq);
    if (showChalk) {
      // White chalk line at 20% height (4 L return reserve mark out of 20 L)
      const chalkBand = new T.Mesh(new T.BoxGeometry(.248, .016, .178), whiteCapMat);
      chalkBand.position.set(0, .05 + .32 * .20, 0);
      g.add(chalkBand);
    }
    const h = new T.Mesh(jerHandleGeo, clearJerShellMat); h.position.set(-.032, .42, 0); g.add(h);
    const sp = new T.Mesh(jerSpoutGeo, clearJerShellMat); sp.position.set(.082, .418, 0); sp.rotation.z = -.25; g.add(sp);
    const cp = new T.Mesh(jerCapGeo, whiteCapMat); cp.position.set(.094, .45, 0); cp.rotation.z = -.25; g.add(cp);
    g.scale.setScalar(scale);
    const setFill = v => {
      const f = clamp(v, 0, 1);
      liq.visible = f > .02;
      liq.scale.y = Math.max(.02, f);
      g.userData.fill = f;
    };
    const setDull = dull => {
      if (dull) {
        liqMat.color.setHex(0x243b44); liqMat.emissive.setHex(0x0b161b); liqMat.emissiveIntensity = .25;
      } else {
        liqMat.color.setHex(0x0080ff); liqMat.emissive.setHex(0x0066ff); liqMat.emissiveIntensity = 1.65;
      }
    };
    setFill(initialFill);
    g.userData.setFill = setFill;
    g.userData.setDull = setDull;
    return g;
  }

  /* ---------- Ported 1940s Woody Station Wagon (Clean Collision-Free Cruiser + Open Roof Deck) ---------- */
  function buildWagon() {
    const woodBox = new T.BoxGeometry(1, 1, 1), ball = new T.SphereGeometry(1, 18, 12);
    const coach = new T.MeshStandardMaterial({ color: 0x8e9597, roughness: .42, metalness: .18 });
    const ash = new T.MeshStandardMaterial({ color: 0xc2a67a, roughness: .72 });
    const walnut = new T.MeshStandardMaterial({ color: 0x5c3822, roughness: .78 });
    const deckWood = new T.MeshStandardMaterial({ color: 0x9b805c, roughness: .82 });
    const charcoal = new T.MeshStandardMaterial({ color: 0x262825, roughness: .82 });
    const nickel = new T.MeshStandardMaterial({ color: 0xe6e4dc, roughness: .22, metalness: .86 });
    const rubber = new T.MeshStandardMaterial({ color: 0x1c1c1a, roughness: .92 });
    const sidewall = new T.MeshStandardMaterial({ color: 0x33322d, roughness: .88 });
    const safetyGlass = new T.MeshStandardMaterial({ color: 0x2c3b46, roughness: .14, metalness: .35, transparent: true, opacity: .66 });
    const amber = new T.MeshStandardMaterial({ color: 0xe8bc64, emissive: 0x5a4218, emissiveIntensity: .6, roughness: .2 });
    const redLens = new T.MeshStandardMaterial({ color: 0xc93828, emissive: 0x501008, emissiveIntensity: .5, roughness: .25 });
    const darkTailgate = new T.MeshStandardMaterial({ color: 0x4c3220, roughness: .78 });

    const meshAt = (g, m, grp, x = 0, y = 0, z = 0) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); grp.add(o); return o; };
    const billet = (grp, m, x, y, z, w, h, l) => { const o = meshAt(woodBox, m, grp, x, y, z); o.scale.set(w, h, l); return o; };
    const oval = (grp, m, x, y, z, w, h, l) => { const o = meshAt(ball, m, grp, x, y, z); o.scale.set(w, h, l); return o; };
    const spar = (grp, m, a, b, r1, r2 = r1, sides = 8) => {
      const p = new T.Vector3(...a), q = new T.Vector3(...b), off = q.clone().sub(p);
      const t = meshAt(new T.CylinderGeometry(r2, r1, off.length(), sides, 1), m, grp);
      t.position.copy(p).lerp(q, .5); t.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), off.normalize());
      return t;
    };
    const pipe = (grp, m, pts, rad, seg = 20) => meshAt(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), seg, rad, 7, false), m, grp);
    const loft = (grp, m, profs, sides = 28, segs = 22, flat = 1) => {
      const spine = new T.CatmullRomCurve3(profs.map(([z, y, xr, yr]) => new T.Vector3(xr, yr, z)));
      const levels = new T.CatmullRomCurve3(profs.map(([z, y]) => new T.Vector3(0, y, z)));
      const p = [], uv = [], tri = [];
      for (let j = 0; j <= segs; j++) {
        const t = j / segs, pt = spine.getPoint(t), y = levels.getPoint(t).y;
        for (let i = 0; i <= sides; i++) {
          const th = (i / sides) * TAU, cnt = v => Math.sign(v) * (Math.abs(v) ** flat);
          p.push(cnt(Math.cos(th)) * Math.max(.001, pt.x), y + cnt(Math.sin(th)) * Math.max(.001, pt.y), pt.z);
          uv.push(i / sides, t);
          if (j < segs && i < sides) {
            const a = j * (sides + 1) + i;
            if (profs[0][0] < profs[profs.length - 1][0]) tri.push(a, a + 1, a + sides + 1, a + 1, a + sides + 2, a + sides + 1);
            else tri.push(a, a + sides + 1, a + 1, a + 1, a + sides + 1, a + sides + 2);
          }
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(p, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setIndex(tri); g.computeVertexNormals();
      return meshAt(g, m, grp);
    };
    const roundedCase = (grp, m, x, y, z, w, h, l, r = .06) => {
      const sh = new T.Shape(), a = w * .5 - r, b = h * .5 - r;
      sh.moveTo(-a, -b - r); sh.lineTo(a, -b - r); sh.quadraticCurveTo(a + r, -b - r, a + r, -b);
      sh.lineTo(a + r, b); sh.quadraticCurveTo(a + r, b + r, a, b + r); sh.lineTo(-a, b + r);
      sh.quadraticCurveTo(-a - r, b + r, -a - r, b); sh.lineTo(-a - r, -b); sh.quadraticCurveTo(-a - r, -b - r, -a, -b - r);
      const gm = new T.ExtrudeGeometry(sh, { depth: l, bevelEnabled: false, curveSegments: 4 }); gm.translate(0, 0, -l * .5);
      return meshAt(gm, m, grp, x, y, z);
    };
    const panelSide = (grp, m, side, pts, thk) => {
      const sh = new T.Shape(); pts.forEach(([x, y], i) => i ? sh.lineTo(x, y) : sh.moveTo(x, y)); sh.closePath();
      const g = new T.ExtrudeGeometry(sh, { depth: thk, bevelEnabled: false, curveSegments: 4 });
      g.rotateY(-Math.PI * .5); g.translate(thk * .5, 0, 0);
      return meshAt(g, m, grp, side, 0, 0);
    };
    const makeWheel = (grp, x, y, z, front) => {
      const mount = new T.Group(); mount.position.set(x, y, z); grp.add(mount);
      const spin = new T.Group(); mount.add(spin);
      const tire = meshAt(new T.TorusGeometry(.30, .091, 12, 30), rubber, spin); tire.rotation.y = Math.PI * .5; tire.scale.z = 1.22;
      const dir = Math.sign(x);
      for (const off of [-.047, .047]) {
        const bead = meshAt(new T.TorusGeometry(.303, .051, 10, 28), sidewall, spin, off, 0, 0); bead.rotation.y = Math.PI * .5;
      }
      meshAt(new T.CylinderGeometry(.218, .218, .145, 24), charcoal, spin).rotation.z = Math.PI * .5;
      oval(spin, nickel, dir * .097, 0, 0, .038, .145, .145);
      oval(spin, coach, dir * .124, 0, 0, .019, .084, .084);
      const ring = meshAt(new T.TorusGeometry(.183, .011, 6, 24), nickel, spin, dir * .077, 0, 0); ring.rotation.y = Math.PI * .5;
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * TAU;
        billet(spin, rubber, 0, .387 * Math.cos(ang), .387 * Math.sin(ang), .176, .014, .022).rotation.x = ang;
      }
      return { mount, spin, front, baseY: y };
    };

    const root = new T.Group();
    const inner = new T.Group(); inner.rotation.y = Math.PI; root.add(inner);
    const body = new T.Group(); inner.add(body);

    loft(body, coach, [[-2.61, .72, .08, .07], [-2.5, .77, .72, .24], [-2.1, .83, .93, .38], [-1.47, .87, .98, .43],
      [-.9, .88, .99, .45], [.1, .89, .97, .43], [1.1, .88, .96, .40], [1.99, .81, .94, .36], [2.44, .78, .75, .30], [2.59, .76, .016, .029]], 34, 30, .55);
    const hoodMesh = loft(body, coach, [[-2.6, .91, .045, .026], [-2.46, 1.04, .43, .22], [-2.14, 1.14, .58, .215], [-1.65, 1.22, .62, .214],
      [-1.15, 1.25, .68, .23], [-.79, 1.24, .69, .21]], 28, 22, .68);
    loft(body, charcoal, [[-1.26, 1.35, .72, .048], [-1.04, 1.65, .76, .17], [-.77, 1.75, .83, .32], [-.38, 1.78, .85, .34], [.52, 1.80, .86, .34],
      [1.43, 1.77, .85, .32], [2.04, 1.73, .78, .27], [2.33, 1.59, .70, .15], [2.48, 1.29, .67, .044]], 28, 28, .63);

    for (const sgn of [-1, 1]) {
      const x = sgn * .90;
      panelSide(body, walnut, x + sgn * .031, [[-1.03, .59], [-1.18, 1.28], [-.66, 1.41], [1.97, 1.41], [2.35, 1.10], [2.36, .66]], .037);
      for (const y of [.70, .91, 1.13, 1.365]) billet(body, ash, x + sgn * .018, y, .51, .068, .052, 3.28).rotation.x = -.016;
      const win = [[-1.03, 1.38], [-.64, 1.91], [1.87, 1.90], [2.15, 1.75], [2.35, 1.41]];
      panelSide(body, safetyGlass, x - sgn * .072, win, .035);
      pipe(body, ash, win.concat([win[0]]).map(([z, y]) => [x - sgn * .051, y, z]), .030, 20);
      for (const z of [-.96, .02, 1.08, 2.14]) {
        const y = z === -.96 ? 1.43 : 1.57;
        billet(body, ash, x + sgn * .010, y, z, .070, z === -.96 ? .80 : 1.16, .050).rotation.x = z === -.96 ? -.25 : z === 2.14 ? .30 : .007;
      }
      for (const z of [-.52, .52]) billet(body, nickel, x + sgn * .089, 1.23, z, .034, .038, .165).rotation.x = -.075;
      loft(body, coach, [[-2.58, .68, .019, .035], [-2.40, .75, .211, .224], [-2.06, .78, .276, .32], [-1.66, .77, .285, .30],
        [-1.27, .72, .237, .24], [-.94, .63, .14, .18], [-.57, .57, .03, .054]], 20, 18, .83).position.x = sgn * .73;
      loft(body, coach, [[.55, .57, .013, .028], [.87, .64, .155, .156], [1.27, .73, .271, .274], [1.66, .76, .295, .312],
        [2.12, .71, .254, .237], [2.48, .63, .139, .14], [2.58, .59, .016, .025]], 20, 18, .75).position.x = sgn * .735;
      for (const h of [.52, .58, .64]) { billet(body, nickel, sgn * 1.00, h, -1.74, .029, .022, 1.32); billet(body, nickel, sgn * 1.01, h, 1.71, .028, .021, 1.46); }
      oval(body, nickel, sgn * .66, .88, -2.36, .185, .187, .18);
      oval(body, amber, sgn * .66, .88, -2.48, .129, .131, .073);
      oval(body, redLens, sgn * .79, .65, 2.482, .051, .083, .046);
      oval(body, nickel, sgn * 1.01, 1.43, -.95, .082, .063, .032);
    }
    roundedCase(body, darkTailgate, 0, 1.049, 2.426, 1.61, .600, .135, .145);
    for (const y of [.84, 1.024, 1.205]) billet(body, ash, 0, y, 2.502, 1.43, .044, .052);
    for (const x of [-.735, .735]) billet(body, ash, x, 1.062, 2.50, .050, .44, .064);
    billet(body, nickel, 0, 1.248, 2.512, .218, .049, .038);
    for (const sgn of [-1, 1]) {
      billet(body, safetyGlass, sgn * .382, 1.615, -.946, .743, .405, .033).rotation.x = .59;
      billet(body, safetyGlass, sgn * .376, 1.60, 2.22, .696, .344, .04).rotation.x = -.44;
    }
    billet(body, ash, 0, 1.62, 2.224, .067, .42, .088).rotation.x = -.44;
    billet(body, nickel, 0, 1.59, -1.000, .038, .49, .05).rotation.x = .59;
    for (let i = 0; i < 5; i++) {
      const z = -2.35 + i * .173;
      for (let k = -2; k <= 2; k++) billet(body, nickel, k * .072, 1.35 + i * .025, z, .016, .015, .167);
      billet(body, nickel, 0, .60 + i * .062, -2.567 + i * .008, .99 - i * .031, .035, .050);
    }
    const frontBumper = billet(body, nickel, 0, .467, -2.59, 1.77, .121, .17);
    billet(body, nickel, 0, .446, 2.535, 1.85, .123, .19);
    for (const s of [-1, 1]) {
      billet(body, nickel, s * .58, .495, -2.658, .105, .245, .17);
      billet(body, deckWood, s * .95, 2.37, .44, .090, .118, 3.65);
      for (const z of [-1.06, .20, 1.65]) {
        billet(body, nickel, s * .944, 1.885, z, .035, .84, .062);
        billet(body, deckWood, s * .93, 2.36, z, .091, .367, .065);
      }
      spar(body, charcoal, [s * .946, 2.49, -1.39], [s * .946, 2.49, 2.29], .021);
    }
    for (let i = 0; i < 12; i++) billet(body, i % 3 ? deckWood : ash, (i - 5.5) * .153, 2.265, .43, .145, .065, 3.69);
    for (const x of [-.87, -.40]) spar(body, charcoal, [x, .37, 2.62], [x, 2.29, 2.10], .031, .028);
    for (let i = 0; i < 7; i++) {
      const f = (i + .38) / 7;
      spar(body, nickel, [-.87, lerp(.37, 2.29, f), lerp(2.62, 2.10, f)], [-.40, lerp(.37, 2.29, f), lerp(2.62, 2.10, f)], .023);
    }
    for (const sgn of [-1, 1]) {
      for (const z of [-.95, 1.68]) {
        const jc = makeJerikan(.96);
        jc.position.set(sgn * .72, 2.30, z); jc.rotation.y = sgn * .18;
        body.add(jc);
      }
    }
    spar(body, antennaMat, [0, 2.28, -1.28], [0, 3.45, -1.28], .022, .010, 8);
    const wagonBeacon = meshAt(new T.SphereGeometry(.092, 14, 10), beaconCyanMat, body, 0, 3.48, -1.28);
    const roofStandSpot = new T.Object3D();
    roofStandSpot.position.set(0, 2.30, -.15);
    body.add(roofStandSpot);

    const wheels = [
      makeWheel(inner, -.862, .394, -1.71, true),
      makeWheel(inner, .862, .394, -1.71, true),
      makeWheel(inner, -.882, .394, 1.61, false),
      makeWheel(inner, .882, .394, 1.61, false)
    ];

    return {
      group: root, inner, chassis: body, wheels, beacon: wagonBeacon, roofStandSpot,
      hoodMesh, frontBumper,
      x: -15.5, z: 4.8, y: 155, heading: -Math.PI * .52, speed: 0, steerAngle: 0, pitch: 0, roll: 0,
      get deckY() { return this.y + 2.30; }
    };
  }

  /* ---------- Post-Process Shaders (Full 48 km Float Depth Range + WiFi Field) ---------- */
  const rtScene = new T.WebGLRenderTarget(64, 64, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true });
  rtScene.depthTexture = new T.DepthTexture(64, 64);
  rtScene.depthTexture.format = T.DepthFormat; rtScene.depthTexture.type = T.UnsignedIntType;
  rtScene.depthTexture.minFilter = T.NearestFilter; rtScene.depthTexture.magFilter = T.NearestFilter;

  let rtA = new T.WebGLRenderTarget(64, 64, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: false });
  let rtB = rtA.clone();

  const postScene = new T.Scene();
  const postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postQuad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
  postScene.add(postQuad);

  const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
  const accMat = new T.ShaderMaterial({
    uniforms: { tCur: { value: null }, tPrev: { value: null }, uDamp: { value: .30 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tCur, tPrev; uniform float uDamp; varying vec2 vUv;
      void main(){ vec3 cur = texture2D(tCur, vUv).rgb; vec3 prv = texture2D(tPrev, vUv).rgb;
        gl_FragColor = vec4(max(cur, prv * uDamp), 1.0); }`
  });

  const lookMat = new T.ShaderMaterial({
    uniforms: {
      tScene: { value: rtScene.texture },
      tDepth: { value: rtScene.depthTexture },
      tTrail: { value: rtA.texture },
      tFilm: { value: filmTex },
      uRes: { value: new T.Vector2(800, 600) },
      uT: { value: 0 },
      uNear: { value: NEAR },
      uFar: { value: FAR },
      uFocusDist: { value: 18.0 },
      uDofOctaves: { value: .84 },
      uTilt: { value: 0.0 },
      uStrataLock: { value: .24 },
      uFocusPulse: { value: 0.0 },
      uRouteMode: { value: initModeIdx },
      uSoloLook: { value: -1 },
      uFocusLook: { value: 13 },
      uFilter: { value: new T.Vector3(1.02, 1.02, 1.18) },
      uJerikanFilter: { value: 1.0 },
      uAudioBass: { value: 0.0 },
      uAudioHigh: { value: 0.0 },
      uBeatPulse: { value: 0.0 },
      uLidarStrength: { value: 0.0 },
      uResonantZone: { value: 4 },
      uInAbyss: { value: 0.0 },
      uAbyssCenter: { value: new T.Vector3(ABYSS_OX, ABYSS_BASE_Y, ABYSS_OZ) },
      uInvProjView: { value: new T.Matrix4() },
      uWifi: { value: Array.from({ length: 8 }, () => new T.Vector4(0, 0, 0, 0)) },
      uWifiPing: { value: 0.0 }
    },
    vertexShader: VS,
    fragmentShader: `
      uniform sampler2D tScene, tDepth, tTrail, tFilm;
      uniform vec2 uRes;
      uniform float uT, uNear, uFar, uFocusDist, uDofOctaves, uTilt, uStrataLock, uFocusPulse, uJerikanFilter, uAudioBass, uAudioHigh, uBeatPulse, uLidarStrength, uWifiPing, uInAbyss;
      uniform int uRouteMode, uSoloLook, uFocusLook, uResonantZone;
      uniform vec3 uFilter, uAbyssCenter;
      uniform mat4 uInvProjView;
      uniform vec4 uWifi[8];
      varying vec2 vUv;

      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float lum(vec3 c){ return clamp(dot(c * uFilter, vec3(0.30, 0.59, 0.11)), 0.0, 1.0); }
      float n2(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + vec2(1., 1.)), f.x), f.y);
      }
      float readDist(vec2 uv){
        float zb = texture2D(tDepth, uv).x;
        return (uNear * uFar) / max(0.0001, uFar - zb * (uFar - uNear));
      }
      float drip(vec2 uv){
        float cx = floor(uv.x * uRes.x / 6.0);
        if (h(vec2(cx, 7.0)) < 0.80) return 0.0;
        float len = 0.04 + 0.16 * h(vec2(cx, 3.0)), m = 0.0;
        for (int k = 1; k <= 5; k++) {
          float lk = lum(texture2D(tScene, vec2(uv.x, min(1.0, uv.y + len * float(k) / 5.0))).rgb);
          m = max(m, step(0.58, lk));
        }
        return m;
      }

      vec3 evalLook(int mode, vec2 uv, vec3 raw, vec3 silverBase, vec3 tr, float l, float ed, float vg) {
        vec2 px = uv * uRes;
        vec3 col;
        if (mode == 0) {
          float spk = smoothstep(0.996, 1.0, h(floor(px / 2.6))) * (0.45 + 0.35 * sin(uT * 0.9 + px.x * 0.1));
          vec3 em = mix(raw * 0.35, tr, 0.65) * smoothstep(0.14, 0.85, l);
          col = mix(silverBase * 0.48, em * vec3(1.12, 0.68, 0.34) + spk * vec3(1.0, 0.75, 0.4), 0.72);
        } else if (mode == 1) {
          float rows = 320.0;
          vec2 g = vec2(uv.x, (floor(uv.y * rows) + 0.5) / rows);
          float ls = lum(texture2D(tScene, clamp(g, 0.0, 1.0)).rgb);
          float line = 0.86 + 0.14 * sin(uv.y * rows * 6.2832);
          float sweep = smoothstep(0.05, 0.0, abs(fract(uv.y - uT * 0.04) - 0.5) - 0.45) * 0.04;
          col = mix(silverBase * 0.44, vec3(0.76, 0.92, 1.0) * (pow(ls * 1.25 + 0.04, 0.85) * line + sweep) * vg, 0.72);
        } else if (mode == 2) {
          float th = pow(clamp(l * 1.12, 0.0, 1.0), 0.82);
          vec3 hm = th < 0.28 ? mix(vec3(0.08, 0.02, 0.14), vec3(0.45, 0.05, 0.48), th / 0.28)
                  : th < 0.58 ? mix(vec3(0.45, 0.05, 0.48), vec3(0.92, 0.22, 0.08), (th - 0.28) / 0.30)
                  : mix(vec3(0.92, 0.22, 0.08), vec3(1.0, 0.84, 0.30), (th - 0.58) / 0.42);
          col = mix(hm, silverBase * 0.95, 0.34);
        } else if (mode == 3) {
          vec3 tissue = vec3(0.95, 0.84, 0.64) * (0.78 + 0.22 * vg);
          float cut = 1.0 - smoothstep(0.16, 0.38, l);
          vec3 sil = mix(tissue, vec3(0.11, 0.09, 0.10), cut);
          sil = mix(sil, vec3(0.78, 0.14, 0.09), smoothstep(0.76, 0.92, l) * 0.65);
          col = mix(sil, silverBase, 0.36);
        } else if (mode == 4) {
          float grain = n2(vec2(px.x / 120.0, px.y / 2.4)) * 0.6 + n2(vec2(px.x / 26.0, px.y / 1.4)) * 0.4;
          vec3 indigo = vec3(0.14, 0.21, 0.32), slate = vec3(0.38, 0.48, 0.54), cream = vec3(0.90, 0.86, 0.75), rust = vec3(0.68, 0.35, 0.18);
          float lq = l + (grain - 0.5) * 0.06;
          vec3 wb = lq < 0.16 ? indigo : lq < 0.38 ? slate : lq < 0.72 ? cream : rust;
          if (lq >= 0.16 && lq < 0.38) wb = mix(wb, indigo, step(0.62, fract((px.x + px.y) / 7.0)) * 0.36);
          wb = mix(wb, indigo * 0.65, smoothstep(0.05, 0.15, ed));
          col = mix(wb * (0.92 + 0.10 * grain), silverBase, 0.36) * (0.90 + 0.10 * vg);
        } else if (mode == 5) {
          return silverBase * (0.94 + 0.06 * vg);
        } else if (mode == 6) {
          vec2 gp = px / 5.2;
          float a = fract(gp.x + gp.y), b = fract(gp.x - gp.y);
          float ink = step(a, smoothstep(0.12, 0.80, 1.0 - l) * 0.82);
          ink = max(ink, step(b, smoothstep(0.45, 0.96, 1.0 - l) * 0.72));
          ink = max(ink, smoothstep(0.06, 0.18, ed));
          vec3 crd = mix(vec3(0.93, 0.90, 0.82) * (0.86 + 0.14 * vg), vec3(0.12, 0.11, 0.13), ink * 0.84);
          col = mix(crd, silverBase, 0.38);
        } else if (mode == 7) {
          float wn = n2(px / 95.0) * 0.6 + n2(px / 22.0) * 0.3 + h(floor(px / 2.0)) * 0.1;
          float ml = smoothstep(0.06, 0.85, lum(texture2D(tFilm, uv).rgb));
          vec3 wall = vec3(0.54, 0.51, 0.47) * (0.65 + 0.45 * wn) * (0.72 + 0.45 * ml);
          float dr = drip(uv);
          float edgeHalo = smoothstep(0.04, 0.14, ed);
          vec3 paste = mix(silverBase.rgb, vec3(0.96, 0.94, 0.89), edgeHalo);
          col = mix(mix(wall, paste, smoothstep(0.24, 0.62, l + edgeHalo * 0.45)), vec3(0.14, 0.12, 0.11), dr * 0.28);
          col = mix(col, silverBase, 0.32);
        } else if (mode == 8) {
          float tooth = n2(px / 2.4) * 0.6 + n2(px / 6.5) * 0.4;
          vec3 paper = vec3(0.96, 0.94, 0.89) * (0.94 + 0.08 * tooth);
          vec3 wash = mix(vec3(0.42, 0.58, 0.74), vec3(0.86, 0.70, 0.52), l);
          vec3 wc = mix(paper, paper * wash, (0.35 + 0.55 * (1.0 - l)) * (0.65 + 0.4 * tooth));
          wc = mix(wc, vec3(0.26, 0.28, 0.32), smoothstep(0.04, 0.10, ed) * 0.52);
          col = mix(wc, silverBase, 0.35);
        } else if (mode == 9) {
          float brush = n2(vec2(px.x / 3.0, px.y / 140.0)) * 0.5 + n2(px / 55.0) * 0.5;
          vec2 q = abs(uv - 0.5) * 2.0;
          float coat = smoothstep(0.99, 0.92, max(q.x, q.y) + (n2(px / 24.0) - 0.5) * 0.06);
          float d = smoothstep(0.08, 0.92, silverBase.r + 0.06 * n2(px / 40.0));
          vec3 cyano = mix(vec3(0.07, 0.24, 0.56) * (0.85 + 0.25 * brush), vec3(0.94, 0.97, 1.0), d);
          col = mix(vec3(0.95, 0.94, 0.90), cyano, coat);
        } else if (mode == 10) {
          float distContour = smoothstep(0.88, 0.98, sin(readDist(uv) * 0.65));
          vec3 xcol = vec3(0.82, 0.93, 1.0) * (smoothstep(0.02, 0.12, ed) * 1.25 + distContour * 0.22);
          col = mix(silverBase * 0.52, xcol + mix(raw, tr, 0.55) * 0.36, 0.65);
        } else if (mode == 11) {
          vec3 rs = vec3(0.96, 0.93, 0.85);
          float g1 = length(fract(px / 5.5) - 0.5) * 1.5;
          float g2 = length(fract((mat2(0.966, 0.259, -0.259, 0.966) * px) / 5.5) - 0.5) * 1.5;
          float g3 = length(fract((mat2(0.707, 0.707, -0.707, 0.707) * px) / 5.5) - 0.5) * 1.5;
          rs *= mix(vec3(1.0), vec3(1.0, 0.34, 0.60), step(g1, smoothstep(0.15, 0.75, 1.0 - l) * 0.82));
          rs *= mix(vec3(1.0), vec3(1.0, 0.86, 0.12), step(g2, smoothstep(0.25, 0.85, l) * 0.72));
          rs *= mix(vec3(1.0), vec3(0.14, 0.34, 0.78), step(g3, smoothstep(0.1, 0.55, 1.0 - l) * 0.78));
          rs *= mix(vec3(1.0), vec3(0.10, 0.09, 0.12), smoothstep(0.04, 0.15, ed) * 0.82);
          col = mix(rs, silverBase, 0.36);
        } else if (mode == 12) {
          float fib = n2(vec2(px.x / 85.0, px.y / 2.2)) * 0.5 + n2(vec2(px.x / 3.0, px.y / 68.0)) * 0.5;
          vec3 paper = vec3(0.95, 0.93, 0.87) * (0.94 + 0.08 * fib);
          float dark = 1.0 - l;
          float ink = smoothstep(0.22, 0.44, dark) * 0.25 + smoothstep(0.48, 0.72, dark) * 0.30 + smoothstep(0.76, 0.95, dark) * 0.32;
          vec3 iw = paper * (1.0 - ink * (0.9 + 0.1 * fib));
          vec2 sq = (uv - vec2(0.90, 0.14)) * vec2(uRes.x / uRes.y, 1.0);
          float seal = step(max(abs(sq.x), abs(sq.y)), 0.032) * step(0.28, n2(px / 3.0));
          col = mix(mix(iw, vec3(0.72, 0.10, 0.08), seal), silverBase, 0.36);
        } else {
          return silverBase * (0.95 + 0.05 * vg);
        }
        return col;
      }

      vec3 evalByFloat(float fz, vec2 uv, vec3 raw, vec3 silverBase, vec3 tr, float l, float ed, float vg) {
        float cf = clamp(fz, 0.0, 10.0);
        int i0 = int(floor(cf)), i1 = i0 < 10 ? i0 + 1 : 10;
        vec3 a = evalLook(i0, uv, raw, silverBase, tr, l, ed, vg);
        vec3 b = (i1 == i0) ? a : evalLook(i1, uv, raw, silverBase, tr, l, ed, vg);
        return mix(a, b, smoothstep(0.15, 0.85, fract(cf)));
      }

      void main() {
        vec2 uv = vUv, e = 1.0 / uRes;
        float zb = texture2D(tDepth, uv).x;
        float dist = (uNear * uFar) / max(0.0001, uFar - zb * (uFar - uNear));
        float planeD = uFocusDist * exp((uv.y - 0.5) * uTilt * 2.0);
        float coc = (log2(clamp(dist, uNear, uFar)) - log2(max(planeD, 0.5))) / max(0.14, uDofOctaves);

        // Full 48 km depth precision: sky buffer stays cleared at 1.0, terrain peaks <= 0.999993
        vec4 ndcPos = vec4(uv * 2.0 - 1.0, zb * 2.0 - 1.0, 1.0);
        vec4 wp4 = uInvProjView * ndcPos;
        vec3 wPos = wp4.xyz / max(0.00001, wp4.w);
        float isGeo = step(zb, 0.999997) * step(dist, 2600.0);

        float wifiField = 0.0;
        float wifiEdge = 0.0;
        float wifiWave = 0.0;
        for (int i = 0; i < 8; i++) {
          float rad = uWifi[i].w * (1.0 + 0.015 * uBeatPulse);
          if (rad > 0.5) {
            float dw = length(wPos.xz - uWifi[i].xz);
            float f = smoothstep(rad, rad * 0.14, dw) * isGeo;
            wifiField = max(wifiField, f);
            float bnd = smoothstep(2.0, 0.0, abs(dw - rad)) * isGeo;
            wifiEdge = max(wifiEdge, bnd);
            float ringW = sin(dw * 0.36 - uT * 0.65);
            wifiWave = max(wifiWave, f * smoothstep(0.92, 0.995, ringW) * 0.14);
          }
        }
        wifiField = clamp(wifiField * (1.0 + 0.10 * uWifiPing + 0.04 * uBeatPulse), 0.0, 1.0);

        vec3 raw = texture2D(tScene, uv).rgb;
        float rawL = clamp(dot(raw, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
        float l = lum(raw);
        float maxC = max(raw.r, max(raw.g, raw.b));
        float minC = min(raw.r, min(raw.g, raw.b));
        float chroma = maxC - minC;
        float abyssMask = (1.0 - smoothstep(145.0, 230.0, length(wPos.xz - uAbyssCenter.xz))) * isGeo;
        float colorKeep = clamp(smoothstep(0.08, 0.28, chroma) * 0.92 + abyssMask * 0.68, 0.0, 0.96);

        float rawX = dot(texture2D(tScene, uv + vec2(1.2, 0.0) * e).rgb, vec3(0.30, 0.59, 0.11))
                   - dot(texture2D(tScene, uv - vec2(1.2, 0.0) * e).rgb, vec3(0.30, 0.59, 0.11));
        float rawY = dot(texture2D(tScene, uv + vec2(0.0, 1.2) * e).rgb, vec3(0.30, 0.59, 0.11))
                   - dot(texture2D(tScene, uv - vec2(0.0, 1.2) * e).rgb, vec3(0.30, 0.59, 0.11));
        float ed = length(vec2(rawX, rawY)) * 2.5;
        vec3 silverBase = raw;
        vec3 tr = texture2D(tTrail, uv).rgb;
        float vg = smoothstep(1.36, 0.34, length((uv - 0.5) * vec2(clamp(uRes.x / max(1.0, uRes.y), 0.78, 1.25), 1.0)) * 1.48);

        float zoneEff = clamp(l + wifiField * 0.25, 0.0, 1.0);
        vec3 outCol;
        if (uSoloLook >= 0) {
          outCol = evalLook(uSoloLook, uv, raw, silverBase, tr, zoneEff, ed, vg);
        } else if (uRouteMode == 0) {
          vec3 jk = evalLook(13, uv, raw, silverBase, tr, l, ed, vg);
          vec3 fLook = evalLook(uFocusLook, uv, raw, silverBase, tr, zoneEff, ed, vg);
          float focalBand = 1.0 - smoothstep(0.45, 1.15, abs(coc));
          outCol = mix(jk, fLook, focalBand * 0.35 * (1.0 - colorKeep * 0.65));
          float heroCut = smoothstep(2.4, 6.0, length(wPos.xz - uWifi[0].xz));
          vec3 wifiWorld = mix(evalLook(9, uv, raw, silverBase, tr, zoneEff, ed, vg),
                               evalLook(10, uv, raw, silverBase, tr, zoneEff, ed, vg),
                               smoothstep(0.05, 0.25, ed) + 0.30 * sin(wPos.y * 0.25 + uT));
          outCol = mix(outCol, mix(wifiWorld, vec3(0.04, 0.58, 0.98) * (0.45 + 0.72 * rawL), 0.28), wifiField * 0.72 * heroCut * (1.0 - colorKeep * 0.85));
          float cyanWave = smoothstep(0.16, 0.0, abs(abs(coc) - 0.86)) * (0.06 + 0.16 * uFocusPulse);
          outCol = mix(outCol, vec3(0.06, 0.78, 1.0), clamp(cyanWave * 0.35 + wifiWave * heroCut + wifiEdge * 0.34, 0.0, 0.62));
        } else if (uRouteMode == 1) {
          float zBand = clamp(zoneEff * 10.0 + coc * 2.1 + wifiField * 2.2, 0.0, 10.0);
          vec3 strataCol = evalByFloat(zBand, uv, raw, silverBase, tr, zoneEff, ed, vg);
          vec3 focalCol = evalLook(uFocusLook, uv, raw, silverBase, tr, zoneEff, ed, vg);
          float sharp = 1.0 - smoothstep(0.45, 1.15, abs(coc));
          outCol = mix(strataCol, focalCol, sharp * (1.0 - uStrataLock));
          outCol = mix(outCol, raw, colorKeep * 0.55);
          outCol = mix(outCol, vec3(0.06, 0.80, 1.0), clamp(wifiWave + wifiEdge * 0.34, 0.0, 0.62));
        } else if (uRouteMode == 2) {
          float shellZ = clamp(5.0 + coc * 2.4 + wifiField * 2.0, 0.0, 10.0);
          outCol = evalByFloat(shellZ, uv, raw, silverBase, tr, zoneEff, ed, vg);
          float bound = smoothstep(0.09, 0.0, abs(fract(shellZ + 0.5) - 0.5)) * (0.08 + 0.18 * uFocusPulse);
          outCol = mix(outCol, vec3(0.10, 0.80, 1.0), clamp(bound + wifiWave + wifiEdge * 0.34, 0.0, 0.62));
        } else {
          outCol = evalByFloat(zoneEff * 10.0 + wifiField * 2.4, uv, raw, silverBase, tr, zoneEff, ed, vg);
          outCol = mix(outCol, vec3(0.08, 0.78, 1.0), clamp(wifiWave + wifiEdge * 0.34, 0.0, 0.62));
        }

        if (uInAbyss > 0.02) {
          float abHaze = (isGeo < 0.5) ? 0.92 : smoothstep(28.0, 125.0, dist) * 0.90;
          vec3 abWater = mix(vec3(0.05, 0.34, 0.42), vec3(0.18, 0.74, 0.82), clamp(uv.y * 1.12, 0.0, 1.0));
          outCol = mix(outCol, abWater, abHaze * uInAbyss);
        }

        if (uLidarStrength > 0.02 && isGeo > 0.5) {
          float c1 = 1.0 - smoothstep(0.0, 0.045, abs(fract(wPos.y * 0.5) - 0.5));
          float c5 = 1.0 - smoothstep(0.0, 0.032, abs(fract(wPos.y * 0.1) - 0.5));
          vec2 lpGrid = fract(wPos.xz * 0.25) - 0.5;
          float pts = (1.0 - smoothstep(0.04, 0.13, length(lpGrid))) * (1.0 - smoothstep(140.0, 420.0, dist));
          float dDonkey = length(wPos.xz - uWifi[0].xz);
          float radar = smoothstep(0.94, 0.995, sin(dDonkey * 0.24 - uT * 0.75)) * 0.18;
          float elevBand = 1.0 - smoothstep(0.0, 18.0, abs(wPos.y - (65.0 + float(uResonantZone) * 24.0)));
          vec3 lidarCol = mix(vec3(0.04, 0.78, 1.0), vec3(0.45, 0.96, 1.0), c5);
          float lidarMix = clamp((c1 * 0.24 + c5 * 0.58 + pts * 0.55 + radar * 0.45 + elevBand * 0.22) * uLidarStrength, 0.0, 0.86);
          outCol = mix(outCol * (1.0 - 0.18 * uLidarStrength), lidarCol, lidarMix);
        }

        if (uJerikanFilter > 0.5 || uRouteMode == 0 || uSoloLook == 13) {
          float maxRG = max(raw.r, raw.g);
          float blueDom = (raw.b - maxRG) / max(raw.b, 0.035);
          float cyanMask = smoothstep(0.24, 0.52, blueDom) * smoothstep(0.04, 0.12, raw.b) * (1.0 - abyssMask * 0.45);
          float cyanShade = clamp(0.48 + 0.82 * raw.b - raw.r * 0.15, 0.44, 1.30);
          vec3 cyanGlow = mix(vec3(0.0, 0.50, 0.96), vec3(0.32, 0.92, 1.0), smoothstep(0.16, 0.86, raw.b)) * cyanShade * (0.92 + 0.04 * uBeatPulse);
          outCol = mix(outCol, cyanGlow, cyanMask);
        }

        gl_FragColor = vec4(clamp(outCol, 0.0, 1.0), 1.0);
      }
    `
  });

  /* ---------- Async World Init & Full Expedition Loop ---------- */
  async function boot() {
    const mw = await loadMonolithAssets(renderer);

    const state = {
      ready: true,
      region: "tetons",
      x: -14.8, z: 0.8, y: 157.5,
      yaw: Math.PI * .50,
      pitch: -.05,
      cartYawOffset: 0, cartPitchOffset: 0, chaseZoom: 9.2,
      modeIdx: initModeIdx,
      stopIdx: 2,
      filterIdx: 5,
      tilt: 0,
      focusDist: 18.0,
      soloLook: -1,
      focusLook: 13,
      drivingCart: false,
      wagonCruise: 0,
      donkeyOnRoof: false,
      roofMountT: 0,
      roofJumpStart: new T.Vector3(),
      gliding: false,
      glideOpen: 0,
      glide: { x: -48, y: 162, z: 1.35, heading: -Math.PI * .45, vy: 0, speed: 24, bank: 0, time: 0,
        landing: false, cruising: false, waypoint: null },
      riding: false,
      leadMode: "lead",
      gaitIdx: 0,
      trayTab: null,
      groundGlass: false,
      ppcOn: true,
      focusPulse: 0,
      pumpFlow: .92,
      pumpLeverPhase: 0,
      wifiCharge: 1.0,
      donkeyWater: 1.0,
      waterLiters: 20.0,
      sloshPct: 0,
      sloshSpilling: false,
      chassisIntegrity: 100,
      cameraMode: "third",
      playAs: "imani",
      bigMapOpen: false,
      throwCount: 0,
      worldWaterDeliveredL: 0,
      sprintToggle: false,
      squirtHeld: false,
      squirtBurstTimer: 0,
      squirtActive: false,
      rainInFrustum01: 0,
      wind01: 0.22,
      wellFocus01: 0,
      riverFocus01: 0,
      npcBumpCount: 0,
      carryCanLocalZ: 0.16,
      lastDialogue: null,
      quests: {
        q1_mistletoe: { done: false, drinkSec: 0 },
        q2_elder_relay: { done: false, liters: 0, targetL: 5.0 },
        q3_june_moraine: { done: false, juneDone: false, moraineDone: false }
      },
      donkeyCollapsed: false,
      pourAnim: null,
      danceTimer: 0,
      lidarOn: false,
      lidarStrength: 0,
      songEpochIdx: 0,
      resonantZone: 4,
      zoneSynced: false,
      nextRelayDist: 162,
      nextRelayName: "Switchback",
      nextRelayAzDeg: 0,
      rigDeployed: false,
      filledCans: 6,
      totalCans: 72,
      filmStripFrames: 12,
      antennaElev: 158.0,
      relElev: 92.5,
      signalRadius: 120.0,
      pingTimer: 0,
      signalDbm: -34,
      frameWifiPct: 50,
      litRelays: 1,
      coveragePct: 14,
      unlockedGroves: 3,
      unlockedTrees: 18,
      meteredZone: 4,
      currentZone: 4,
      beatPulse: 0,
      spatialAudio: true,
      audioDistMeters: 5.0,
      audioFalloffDb: 0,
      introActive: !skipIntroParam,
      introPhase: skipIntroParam ? "done" : "title",
      introT: 0,
      introShotIdx: -1,
      bootMs: performance.now(),
      savedModeBeforeIntro: initModeIdx,
      plates: [],
      chaseCamPos: new T.Vector3(-11, 160, 4),
      chaseLookAt: new T.Vector3(-36, 156, 1.35)
    };
    document.body.classList.toggle("intro-active", state.introActive);
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Array.isArray(saved.plates)) state.plates = saved.plates;
    } catch {}

    function regionAt(x, z) {
      if (x > 305) return "ridge";
      if (Math.hypot(x - AHIYA_OX, z - AHIYA_OZ) < 320) return "ahiya";
      if (Math.hypot(x - ABYSS_OX, z - ABYSS_OZ) < 200) return "abyss";
      return "tetons";
    }

    function currentPlaceName() {
      const reg = regionAt(state.x, state.z);
      if (reg === "ahiya") {
        let bestN = "Basalt Pump", bestD = 1e9;
        for (const [id, sx, sz, nm] of [["basalt",-1460,760,"Basalt Pump"],["beacon",-1610,590,"Cross-Beacon Watch"],["hill",-1765,540,"Hill Archive"],["compound",-1680,775,"Daylight Compound"]]) {
          const d = Math.hypot(state.x - sx, state.z - sz);
          if (d < bestD) { bestD = d; bestN = nm; }
        }
        return bestN;
      }
      if (inside(mw.tetonMountainBounds, state.x, state.z)) return mw.tetonRange.name;
      return ZONES[state.currentZone].name;
    }

    function groundAt(x, z) {
      return mw.unifiedGround(x, z);
    }

    function driveSurfaceAt(x, z) {
      const g = mw.unifiedGround(x, z);
      // Yosemite Cloud Bridge (mapped to world coords wx=[540.5, 549.5], wz=[-34, 5.3])
      if (x >= 540.2 && x <= 549.8 && z >= -34.2 && z <= 5.5) return Math.max(g, mw.bridgeHeight(x, z));
      // Snake River Overlook Deck & East Ramp
      if (x >= -48.6 && x <= -24.7 && z >= -2.7 && z <= 5.4) return Math.max(g, mw.DECK_Y);
      if (x > -24.7 && x <= -19.2 && z >= -2.7 && z <= 5.4) {
        const t = (x - (-24.7)) / 5.5;
        return Math.max(g, lerp(mw.DECK_Y, g, smooth(0, 1, t)));
      }
      // Smooth River-Skimming Surface across Snake River channels (Collisions OFF!)
      if (x < 280 && Math.hypot(x - ABYSS_OX, z - ABYSS_OZ) > 165 && mw.wet(x, z) > -0.5) {
        return Math.max(g, mw.water(x, z) - 0.08);
      }
      return g;
    }

    function activeWorld() { return mw.world; }

    function setRegion(next) {
      state.region = next;
      const btn = $("btn-region");
      if (btn) {
        btn.setAttribute("aria-pressed", String(next !== "tetons"));
        btn.textContent = next === "ridge" ? "Shuttle: Abyss/Tetons (R)" : next === "abyss" ? "Shuttle: Half Dome (R)" : "World Shuttle (R)";
      }
    }

    /* Shared Dynamic Actors Group inside the Unified World */
    const actorRoot = new T.Group();
    mw.world.add(actorRoot);
    const hemiFill = new T.HemisphereLight(0xf6f4ee, 0x3b3c39, .55);
    actorRoot.add(hemiFill);

    /* Wagon + Mistletoe + Sawbuck Pack + Scion Pack Speakers + Donkey Glider Wing + Pour Streams */
    const wagon = buildWagon();
    actorRoot.add(wagon.group);
    wagon.x = -23.0; wagon.z = 4.6;
    wagon.y = driveSurfaceAt(wagon.x, wagon.z);
    wagon.heading = -Math.PI * .52;
    wagon.group.position.set(wagon.x, wagon.y, wagon.z);
    wagon.group.rotation.y = wagon.heading;

    const NP_PHYS = window.NightPostPhysics || null;
    const vehPhys = NP_PHYS ? NP_PHYS.createVehicleBody({ x: wagon.x, y: wagon.y, z: wagon.z, heading: wagon.heading }) : null;
    if (vehPhys) vehPhys.syncFrom(wagon.x, wagon.y, wagon.z, wagon.heading, driveSurfaceAt);
    const carrierPhys = NP_PHYS ? NP_PHYS.createCarrierBody({ eyeHeight: 1.68 }) : null;
    const waterSlosh = NP_PHYS ? NP_PHYS.createWaterSlosh() : null;
    const physParticles = NP_PHYS ? NP_PHYS.createPhysicsParticles(T, actorRoot) : null;
    const projPool = NP_PHYS ? NP_PHYS.createProjectilePool(T, actorRoot) : null;
    const worldObstacles = [];
    let smokeClock = 0;

    function applyWagonVisuals() {
      if (!vehPhys) return;
      wagon.x = vehPhys.x;
      wagon.y = vehPhys.y;
      wagon.z = vehPhys.z;
      wagon.heading = vehPhys.heading;
      wagon.speed = vehPhys.speed;
      wagon.steerAngle = vehPhys.steerAngle;
      wagon.pitch = vehPhys.pitch;
      wagon.roll = vehPhys.roll;
      state.chassisIntegrity = Math.round(vehPhys.integrity);

      wagon.group.position.set(wagon.x, wagon.y, wagon.z);
      wagon.group.rotation.set(0, wagon.heading, 0, "YXZ");
      const shake = vehPhys.damageShake > 0 ? (Math.sin(performance.now() * 0.08) * 0.04 * vehPhys.damageShake) : 0;
      wagon.chassis.position.y = vehPhys.heave + shake;
      wagon.chassis.rotation.x = vehPhys.pitch;
      wagon.chassis.rotation.z = vehPhys.roll;

      if (wagon.frontBumper) {
        wagon.frontBumper.position.z = -2.59 + vehPhys.bumperDent;
        wagon.frontBumper.rotation.y = vehPhys.bumperDent * 0.72;
        wagon.frontBumper.rotation.z = -vehPhys.bumperDent * 0.35;
      }
      if (wagon.hoodMesh) {
        wagon.hoodMesh.rotation.x = vehPhys.hoodTilt;
        wagon.hoodMesh.position.y = vehPhys.hoodTilt * 0.12;
      }
      for (let wi = 0; wi < wagon.wheels.length; wi++) {
        const w = wagon.wheels[wi];
        w.mount.position.y = w.baseY + (vehPhys.wheelOffsets[wi] || 0);
        if (w.front) w.mount.rotation.y = wagon.steerAngle;
      }
    }

    function onVehicleImpact(evt) {
      if (physParticles) physParticles.spawnSparks(evt.x, evt.y, evt.z, Math.round(clamp(evt.severity * 0.7, 6, 20)));
      if (waterSlosh) waterSlosh.impulse((Math.random() - 0.5) * evt.severity * 0.35, -evt.severity * 0.28);
      if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playImpact === "function") {
        window.HighlandSoundscape.playImpact(clamp(evt.severity / 25, 0.15, 1));
      }
      if (evt.severity >= 6) {
        toast(`Chassis impact (${evt.type}) · Integrity ${Math.round(evt.integrity)}%`, `Chassis ${Math.round(evt.integrity)}%`);
      }
    }

    function repairWagonAtStation() {
      if (!vehPhys) return false;
      const nearRepair = Math.hypot(well.x - wagon.x, well.z - wagon.z) < 28 ||
        relays.some(r => Math.hypot(r.x - wagon.x, r.z - wagon.z) < 28) ||
        Math.hypot(well.x - state.x, well.z - state.z) < 28 ||
        relays.some(r => Math.hypot(r.x - state.x, r.z - state.z) < 28);
      if (!nearRepair) {
        toast("Drive or walk within 28 m of a relay station or wellhead to repair chassis.", "Move to relay to repair");
        return false;
      }
      vehPhys.repair(100);
      applyWagonVisuals();
      updateHUD();
      toast("Relay workshop restored Cruiser Woody chassis to 100% integrity.", "Chassis repaired 100%");
      return true;
    }
    if ($("btn-repair-wagon")) $("btn-repair-wagon").addEventListener("click", repairWagonAtStation);

    const donkey = window.makeDonkey({
      assetPath: "../donkey/",
      textures: mw.coatTextures,
      shells: useFieldLayout() ? 6 : 11,
      monochrome: true,
      contactShadow: true,
      alwaysHalter: true
    });
    donkey.state.tireless = true;
    actorRoot.add(donkey.group);
    donkey.setCargo([
      { name: "Cyan Jerikan L (20L)", kg: 12, slot: "L" },
      { name: "Cyan Jerikan R (20L)", kg: 12, slot: "R" },
      { name: "Scion WiFi Transceiver", kg: 8, slot: "T" }
    ]);
    for (const c of donkey.pack.children) if (c.isGroup) c.visible = false;

    const donkeyRig = new T.Group();
    donkey.pack.add(donkeyRig);
    const addPackBar = (grp, a, b, r, mat) => {
      const p = new T.Vector3(...a), q = new T.Vector3(...b), d = q.clone().sub(p);
      const m = new T.Mesh(new T.CylinderGeometry(r, r, d.length(), 8), mat);
      m.position.copy(p).lerp(q, .5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
      grp.add(m); return m;
    };
    for (const zTree of [-.14, .22]) {
      addPackBar(donkeyRig, [-.22, 1.06, zTree], [.18, 1.38, zTree], .017, sawWoodMat);
      addPackBar(donkeyRig, [.22, 1.06, zTree], [-.18, 1.38, zTree], .017, sawWoodMat);
    }
    const speakerCones = [], saddleCans = [];
    for (const sgn of [-1, 1]) {
      addPackBar(donkeyRig, [sgn * .21, 1.14, -.21], [sgn * .21, 1.14, .29], .015, sawWoodMat);
      const jc = makeFillableJerikan(1.06, 0, true);
      jc.position.set(sgn * .305, .86, .04); jc.rotation.y = sgn * Math.PI * .5; jc.rotation.z = sgn * .12;
      donkeyRig.add(jc);
      saddleCans.push(jc);
      const cb1 = new T.Mesh(new T.BoxGeometry(.024, .34, .036), leatherMat); cb1.position.set(sgn * .29, 1.04, -.04); cb1.rotation.z = sgn * .12; donkeyRig.add(cb1);
      const cb2 = new T.Mesh(new T.BoxGeometry(.024, .34, .036), leatherMat); cb2.position.set(sgn * .29, 1.04, .12); cb2.rotation.z = sgn * .12; donkeyRig.add(cb2);
      const cn = new T.Mesh(new T.BoxGeometry(.25, .036, .045), leatherMat); cn.position.set(sgn * .32, 1.01, .04); cn.rotation.z = sgn * .12; donkeyRig.add(cn);
      const bk = new T.Mesh(new T.BoxGeometry(.032, .052, .056), brassMat); bk.position.set(sgn * .40, 1.01, .04); donkeyRig.add(bk);
      const hPts = [new T.Vector3(sgn * .31, 1.24, .11), new T.Vector3(sgn * .20, 1.34, .09), new T.Vector3(sgn * .09, 1.30, .06)];
      donkeyRig.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hPts), 10, .013, 6, false), beaconCyanMat));
      // Twin Brass Radio Speaker Horns on Scion Pack
      const horn = new T.Mesh(new T.CylinderGeometry(.078, .032, .11, 12, 1, true), brassMat);
      horn.position.set(sgn * .18, 1.36, -.10); horn.rotation.z = -sgn * .35; horn.rotation.x = .25;
      donkeyRig.add(horn);
      const sRing = new T.Mesh(new T.TorusGeometry(.085, .012, 8, 20), beaconCyanMat.clone());
      sRing.position.set(sgn * .20, 1.38, -.12); sRing.rotation.y = sgn * .45;
      donkeyRig.add(sRing); speakerCones.push(sRing);
    }
    const scionCase = new T.Mesh(new T.BoxGeometry(.24, .14, .34), strapMat); scionCase.position.set(0, 1.25, .04); donkeyRig.add(scionCase);
    const scionCap = new T.Mesh(new T.BoxGeometry(.22, .04, .30), jerikanMat); scionCap.position.set(0, 1.33, .04); donkeyRig.add(scionCap);
    const scionBar = new T.Mesh(new T.BoxGeometry(.18, .026, .04), beaconCyanMat); scionBar.position.set(0, 1.34, -.09); donkeyRig.add(scionBar);
    const hitchPts = [
      new T.Vector3(-.39, .96, -.04), new T.Vector3(-.28, 1.30, -.12), new T.Vector3(0, 1.36, .04),
      new T.Vector3(.28, 1.30, .20), new T.Vector3(.39, .96, .12), new T.Vector3(.28, 1.30, -.12),
      new T.Vector3(0, 1.36, .04), new T.Vector3(-.28, 1.30, .20), new T.Vector3(-.39, .96, -.04)
    ];
    donkeyRig.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hitchPts), 28, .009, 6, false), ropeHitchMat));
    const springCoil = new T.Mesh(new T.CylinderGeometry(.024, .024, .08, 8), brassMat); springCoil.position.set(-.04, 1.38, .08); donkeyRig.add(springCoil);
    const whip = new T.Mesh(new T.CylinderGeometry(.007, .014, .72, 6), antennaMat); whip.position.set(-.04, 1.77, .08); donkeyRig.add(whip);
    const donkeyBeacon = new T.Mesh(new T.SphereGeometry(.058, 12, 10), beaconCyanMat); donkeyBeacon.position.set(-.04, 2.15, .08); donkeyRig.add(donkeyBeacon);

    // Animated Donkey Pouring Streams + Droplets (visible when pouring into cistern depots)
    const pourGroup = new T.Group();
    pourGroup.visible = false;
    actorRoot.add(pourGroup);
    const pourGeoL = new T.BufferGeometry(), pourGeoR = new T.BufferGeometry();
    const pourPtsL = Array.from({ length: 16 }, () => new T.Vector3());
    const pourPtsR = Array.from({ length: 16 }, () => new T.Vector3());
    const pourLineMat = new T.MeshBasicMaterial({ color: 0x0088ff });
    const pourArchGeo = new T.CylinderGeometry(.032, .048, 1, 8);
    let pourMeshL = new T.Mesh(pourArchGeo, cyanWaterMat);
    let pourMeshR = new T.Mesh(pourArchGeo, cyanWaterMat);
    let pourMeshL2 = new T.Mesh(pourArchGeo, cyanWaterMat);
    let pourMeshR2 = new T.Mesh(pourArchGeo, cyanWaterMat);
    pourGroup.add(pourMeshL, pourMeshR, pourMeshL2, pourMeshR2);
    const splashDropGeo = new T.SphereGeometry(.055, 8, 6);
    const splashDrops = Array.from({ length: 18 }, () => {
      const m = new T.Mesh(splashDropGeo, beaconCyanMat);
      pourGroup.add(m); return m;
    });

    /* ---------- Sculpted 18-Cell Arched Electric-Cyan & Sprocket Film Paraglider Wing + Contrails ---------- */
    const donkeyGlider = new T.Group();
    donkeyGlider.position.set(0, 1.25, .04);
    donkeyGlider.visible = false;
    donkeyRig.add(donkeyGlider);
    const sailDarkMat = new T.MeshStandardMaterial({ color: 0x0d549c, emissive: 0x062d5e, emissiveIntensity: .62, roughness: .38, side: T.DoubleSide });
    const canopyCyanMat = new T.MeshStandardMaterial({ color: 0x24b4ff, emissive: 0x0c66db, emissiveIntensity: .88, roughness: .30, side: T.DoubleSide });
    const sailFilmMat = new T.MeshStandardMaterial({ map: forestFilmTex, color: 0x16a2ff, emissive: 0x0c5ed6, emissiveIntensity: .92, roughness: .32, side: T.DoubleSide });
    const seamMat = new T.MeshBasicMaterial({ color: 0x0a111a });
    const riserCordMat = new T.MeshBasicMaterial({ color: 0x5c5344 });
    const wingCellCount = 18, wingSpan = 6.2, halfSpan = wingSpan * .5, maxTheta = 1.08, radSpan = halfSpan / Math.sin(maxTheta);
    const wingPt = (theta, cFrac, lift = 0) => {
      const ch = 1.56 * Math.cos(theta * .68);
      const leadZ = .56 - (1 - Math.cos(theta)) * .68;
      return [Math.sin(theta) * radSpan, 1.02 + Math.cos(theta) * 1.98 + lift, leadZ - cFrac * ch];
    };
    const pushQuad = (arr, uvs, a, b, c, d, u0, u1, v0, v1) => {
      arr.push(...a, ...b, ...c, ...b, ...d, ...c);
      uvs.push(u0, v0, u1, v0, u0, v1, u1, v0, u1, v1, u0, v1);
    };
    for (let c = 0; c < wingCellCount; c++) {
      const t0 = -maxTheta + (c / wingCellCount) * (2 * maxTheta);
      const t1 = -maxTheta + ((c + 1) / wingCellCount) * (2 * maxTheta);
      const tm = (t0 + t1) * .5;
      const puff0 = .14 * Math.cos(t0 * .5), puff1 = .14 * Math.cos(t1 * .5), puffM = .20 * Math.cos(tm * .5);
      const L0 = wingPt(t0, 0, 0), L1 = wingPt(t1, 0, 0), LM = wingPt(tm, 0, .03);
      const C0 = wingPt(t0, .36, puff0), C1 = wingPt(t1, .36, puff1), CM = wingPt(tm, .36, puffM);
      const T0 = wingPt(t0, 1.0, .01), T1 = wingPt(t1, 1.0, .01), TM = wingPt(tm, 1.0, .03);
      const verts = [], uvs = [];
      pushQuad(verts, uvs, L0, LM, C0, CM, 0, .5, 1, .64);
      pushQuad(verts, uvs, LM, L1, CM, C1, .5, 1, 1, .64);
      pushQuad(verts, uvs, C0, CM, T0, TM, 0, .5, .64, 0);
      pushQuad(verts, uvs, CM, C1, TM, T1, .5, 1, .64, 0);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(verts, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
      g.computeVertexNormals();
      const mat = (c >= 7 && c <= 10) ? sailFilmMat : (c % 2 === 0 ? canopyCyanMat : sailDarkMat);
      donkeyGlider.add(new T.Mesh(g, mat));
      addPackBar(donkeyGlider, L0, C0, .0055, seamMat);
      addPackBar(donkeyGlider, C0, T0, .0055, seamMat);
    }
    // Outer end seam
    addPackBar(donkeyGlider, wingPt(maxTheta, 0, 0), wingPt(maxTheta, 1, .01), .0055, seamMat);
    // 16 taut suspension risers fanning from Mistletoe's saddle lugs across the curved canopy
    for (const cIdx of [1, 3, 5, 7, 10, 12, 14, 16]) {
      const th = -maxTheta + ((cIdx + .5) / wingCellCount) * (2 * maxTheta);
      const lug = [cIdx >= 9 ? .28 : -.28, .08, .06];
      addPackBar(donkeyGlider, lug, wingPt(th, .14, .06), .0045, riserCordMat);
      addPackBar(donkeyGlider, lug, wingPt(th, .68, .05), .0045, riserCordMat);
    }
    const wingTipL = new T.Object3D(), wingTipR = new T.Object3D();
    const tipLP = wingPt(-maxTheta, .45, 0), tipRP = wingPt(maxTheta, .45, 0);
    wingTipL.position.set(tipLP[0], tipLP[1], tipLP[2]);
    wingTipR.position.set(tipRP[0], tipRP[1], tipRP[2]);
    donkeyGlider.add(wingTipL, wingTipR);

    // Twin Cyan Wingtip Contrail Ribbons in World Space
    const TRAIL_N = 30;
    const makeContrail = () => {
      const pos = new Float32Array(TRAIL_N * 3);
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      const lineObj = new T.Line(geo, new T.LineBasicMaterial({ color: 0x007aff, transparent: true, opacity: .88 }));
      lineObj.frustumCulled = false; lineObj.visible = false;
      actorRoot.add(lineObj);
      return { line: lineObj, pts: Array.from({ length: TRAIL_N }, () => new T.Vector3()), pos };
    };
    const contrailL = makeContrail(), contrailR = makeContrail();
    const tmpTipL = new T.Vector3(), tmpTipR = new T.Vector3();

    /* ---------- Actual Photographic Filmstrip Atlas (Live 3D Abyssal + MONOLITH-3 Renders & Sprockets) ---------- */
    const filmAtlas = document.createElement("canvas");
    filmAtlas.width = 1024; filmAtlas.height = 2048;
    const faCtx = filmAtlas.getContext("2d");
    faCtx.fillStyle = "#0e1014";
    faCtx.fillRect(0, 0, 1024, 2048);

    function drawFilmFrameCell(slotIdx, imgSource, label) {
      const col = slotIdx % 2, row = Math.floor(slotIdx / 2) % 8;
      const cx = col * 512, cy = row * 256;
      faCtx.fillStyle = "#12151a";
      faCtx.fillRect(cx, cy, 512, 256);
      // Sprocket perforations along left & right rails
      for (let s = 0; s < 8; s++) {
        const py = cy + 12 + s * 30;
        faCtx.fillStyle = "#06080c";
        faCtx.fillRect(cx + 12, py, 26, 18);
        faCtx.fillRect(cx + 474, py, 26, 18);
        faCtx.strokeStyle = "#36b8ff";
        faCtx.lineWidth = 1.5;
        faCtx.strokeRect(cx + 12, py, 26, 18);
        faCtx.strokeRect(cx + 474, py, 26, 18);
      }
      // Edge safety film print
      faCtx.fillStyle = "#68d4ff";
      faCtx.font = "700 11px monospace";
      faCtx.fillText(`${String(slotIdx + 1).padStart(2, "0")}A  ·  ${label}`, cx + 56, cy + 18);
      faCtx.strokeStyle = "#19a8ff";
      faCtx.lineWidth = 2;
      faCtx.strokeRect(cx + 54, cy + 26, 404, 214);
      if (imgSource) faCtx.drawImage(imgSource, cx + 56, cy + 28, 400, 210);
    }

    const actualFilmTex = new T.CanvasTexture(filmAtlas);
    actualFilmTex.wrapS = actualFilmTex.wrapT = T.RepeatWrapping;
    actualFilmTex.anisotropy = Math.min(6, renderer.capabilities.getMaxAnisotropy());
    let nextLiveFilmSlot = 12;
    function splicePlateIntoFilmStrip(srcCanvas, label = "8×10 LIVE PLATE") {
      drawFilmFrameCell(nextLiveFilmSlot, srcCanvas, label);
      nextLiveFilmSlot = 12 + ((nextLiveFilmSlot - 11) % 4);
      state.filmStripFrames = Math.min(16, state.filmStripFrames + 1);
      actualFilmTex.needsUpdate = true;
      sailFilmMat.map = actualFilmTex;
      sailFilmMat.needsUpdate = true;
    }

    // Seed frames 8..11 with archival MONOLITH-3 & coat reference plates right away
    const seedPlates = [
      [mw.rawImages["near-surface"], "GRAND TETON LIDAR"],
      [mw.rawImages["half-ground"], "HALF DOME SURVEY"],
      [mw.rawImages["sky-plate"], "STORM BREAK PLATE"],
      [mw.rawImages["coat-head"], "MISTLETOE 8×10"]
    ];
    seedPlates.forEach(([im, lbl], idx) => drawFilmFrameCell(8 + idx, im, lbl));
    seedPlates.forEach(([im, lbl], idx) => drawFilmFrameCell(idx, im, lbl));
    seedPlates.forEach(([im, lbl], idx) => drawFilmFrameCell(12 + idx, im, "ARCHIVE " + lbl));
    actualFilmTex.needsUpdate = true;

    function captureInitialFilmStripAtlas() {
      const capW = 320, capH = 240;
      const capRT = new T.WebGLRenderTarget(capW, capH, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
      const capCam = new T.PerspectiveCamera(56, capW / capH, 0.35, 24000);
      const pxBuf = new Uint8Array(capW * capH * 4);
      const tmpC = document.createElement("canvas"); tmpC.width = capW; tmpC.height = capH;
      const tctx = tmpC.getContext("2d");
      const imgData = tctx.createImageData(capW, capH);
      const prevTarget = renderer.getRenderTarget();

      const shots = [
        { pos: [-1076, 56.5, -12], look: [-1092, 57.5, -28], label: "WHALE FLUKE SANCTUARY" },
        { pos: [-1092, 72.0, -64], look: [-1110, 68.0, -90], label: "SUNKEN GALLEON RIDGE" },
        { pos: [-1044, 57.5, -24], look: [-1047, 58.0, -49], label: "CORAL CANYON ARCH" },
        { pos: [-1086, 68.0, -18], look: [-1066, 63.0, -56], label: "MANTA RAY GLIDE" },
        { pos: [-34, 159.0, 1.4],  look: [-420, 146.0, -25], label: "SNAKE RIVER OVERLOOK" },
        { pos: [-754, 73.0, -32],  look: [-812, 71.0, -34],  label: "HIGHLAND PUEBLO DOOR" },
        { pos: [520, 165.0, -22],  look: [880, 480.0, 0],    label: "HALF DOME CLOUD NOTCH" },
        { pos: [-19.5, 157.8, 2.2],look: [-24.5, 156.4, 2.2],label: "WOODY WAGON & BURRO" }
      ];

      mw.abyssAnimate(4.2);
      for (let i = 0; i < shots.length; i++) {
        const sh = shots[i];
        capCam.position.set(...sh.pos);
        capCam.up.set(0, 1, 0);
        capCam.lookAt(...sh.look);
        capCam.updateMatrixWorld();
        mw.updateSkyBasis(capCam);
        renderer.setRenderTarget(capRT);
        renderer.render(mw.world, capCam);
        renderer.readRenderTargetPixels(capRT, 0, 0, capW, capH, pxBuf);
        // Vertical flip from WebGL framebuffer to Canvas2D
        for (let y = 0; y < capH; y++) {
          const srcRow = (capH - 1 - y) * capW * 4, dstRow = y * capW * 4;
          for (let x = 0; x < capW * 4; x++) imgData.data[dstRow + x] = pxBuf[srcRow + x];
        }
        tctx.putImageData(imgData, 0, 0);
        drawFilmFrameCell(i, tmpC, sh.label);
        if (i < 4) drawFilmFrameCell(12 + i, tmpC, "ABYSS " + sh.label);
      }
      renderer.setRenderTarget(prevTarget);
      capRT.dispose();
      actualFilmTex.needsUpdate = true;
      sailFilmMat.map = actualFilmTex;
      sailFilmMat.needsUpdate = true;
      mw.updateSkyBasis(camera);
    }

    /* Unified World Props: Overlook Wellhead, Pueblo Plaza, 7 Cistern Depots (72 Fillable Jerrycans), 10 Kelp-Film Forest Groves, Flow Conduits & Summit Launch Decks */
    const worldProps = new T.Group();
    mw.world.add(worldProps);

    const midRockMat = new T.MeshStandardMaterial({ color: 0x6c6b64, roughness: .88 });
    const dryWaterMat = new T.MeshStandardMaterial({ color: 0x2a2926, roughness: .95 });
    const relayRingMat = new T.LineBasicMaterial({ color: 0x0080ff, transparent: true, opacity: .86 });

    // 1) Cast-Iron Wellhead Pump & Cyan Washbasin at Snake River Overlook
    const well = (() => {
      const wx = -22.2, wz = -6.2, wy = groundAt(wx, wz);
      const g = new T.Group(); g.position.set(wx, wy, wz);
      const concrete = new T.MeshStandardMaterial({ color: 0x5d5c57, roughness: .94 });
      const ironMat = new T.MeshStandardMaterial({ color: 0x262626, roughness: .48, metalness: .68 });
      const basinMat = new T.MeshStandardMaterial({ color: 0xbcb9b0, roughness: .65, side: T.DoubleSide });
      const pad = new T.Mesh(new T.BoxGeometry(1.1, .28, .9), concrete); pad.position.set(0, .14, 0); g.add(pad);
      const barrel = new T.Mesh(new T.CylinderGeometry(.13, .16, 1.05, 12), ironMat); barrel.position.set(0, .78, 0); g.add(barrel);
      const cap = new T.Mesh(new T.CylinderGeometry(.17, .17, .12, 12), ironMat); cap.position.set(0, 1.30, 0); g.add(cap);
      const spout = new T.Mesh(new T.CylinderGeometry(.048, .048, .42, 10), ironMat); spout.rotation.z = Math.PI / 2.4; spout.position.set(.22, .68, 0); g.add(spout);
      const leverPivot = new T.Group(); leverPivot.position.set(0, 1.18, 0);
      const leverArm = new T.Mesh(new T.BoxGeometry(.85, .045, .05), ironMat); leverArm.position.set(-.36, .16, 0); leverArm.rotation.z = -.32;
      leverPivot.add(leverArm); g.add(leverPivot);
      const hosePts = [new T.Vector3(.38, .58, 0), new T.Vector3(.75, .20, .35), new T.Vector3(1.15, .08, .85), new T.Vector3(1.55, .14, 1.32), new T.Vector3(1.75, .36, 1.62)];
      g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hosePts), 16, .042, 8, false), whiteCapMat));
      const bx = 1.75, bz = 1.75;
      const basin = new T.Mesh(new T.CylinderGeometry(.68, .50, .36, 20, 1, true), basinMat); basin.position.set(bx, .18, bz); g.add(basin);
      const cyanPool = new T.Mesh(new T.CircleGeometry(.60, 20), cyanWaterMat); cyanPool.rotation.x = -Math.PI / 2; cyanPool.position.set(bx, .24, bz); g.add(cyanPool);
      const stream = new T.Mesh(new T.CylinderGeometry(.032, .048, .55, 10), cyanWaterMat); stream.position.set(bx, .46, bz); g.add(stream);
      const j1 = makeJerikan(1.0); j1.position.set(-.95, 0, .4); j1.rotation.y = .4; g.add(j1);
      const j2 = makeJerikan(1.0); j2.position.set(-.88, 0, -.55); j2.rotation.y = -.5; g.add(j2);
      worldProps.add(g);
      return { x: wx, z: wz, y: wy, leverPivot, stream, pool: cyanPool };
    })();

    /* ---------- 2086 Night Post Production Sets, Calm 16:9 Moving-Picture Cloth & In-World Cinema ---------- */
    const puebloDarkWinMat = new T.MeshStandardMaterial({ color: 0x101214, emissive: 0x001018, emissiveIntensity: .2 });
    const puebloGlowWinMat = new T.MeshStandardMaterial({ color: 0x006eff, emissive: 0x0048dd, emissiveIntensity: 1.35, roughness: .2 });
    const cinemaCanvas = document.createElement("canvas");
    cinemaCanvas.width = 768; cinemaCanvas.height = 432;
    const cinCtx = cinemaCanvas.getContext("2d");
    const cinemaTex = new T.CanvasTexture(cinemaCanvas);
    cinemaTex.colorSpace = T.NoColorSpace;
    const cinemaMat = new T.MeshStandardMaterial({
      map: cinemaTex, emissiveMap: cinemaTex, emissive: 0xdcf4ef, emissiveIntensity: .72,
      roughness: .82, side: T.DoubleSide
    });
    let npScreeningMode = null, npScreenTimer = 0, npLastCinFrame = -1;
    let inWorldVideoMode = null, customClothVideo = null, customClothTex = null, customVideoBlob = "";

    const NP_REEL_META = [
      ["overlook", "OVERLOOK WELLHEAD · 4 L CHALK MARK"],
      ["ford",     "WF–08 · THE WEDDING AT SILVER FORD"],
      ["oxbow",    "COTTONWOOD OXBOW · EIGHT-SECOND TAIL"],
      ["plaza",    "HIGHLAND PUEBLO · REGISTRY & COOLING YARD"],
      ["basalt",   "AHIYA BASALT PUMP · GLOWING PHONES"],
      ["hill",     "HILL ARCHIVE · REC PPC MONITOR"],
      ["compound", "DAYLIGHT COMPOUND · AR–03 REHEARSAL"]
    ];
    const npReelSlides = NP_REEL_META.map(([artKey, caption]) => {
      const img = new Image();
      const src = window.NIGHT_POST_BUNDLE?.art?.[artKey];
      if (src) img.src = src;
      return { img, caption, key: artKey };
    });

    function drawCoverImg(c, img, gx, gy, gw, gh, tNorm) {
      if (!img || !img.complete || !(img.naturalWidth || img.width)) return false;
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const zoom = 1.04 + 0.04 * Math.sin(tNorm * Math.PI);
      const scale = Math.max(gw / iw, gh / ih) * zoom;
      const dw = iw * scale, dh = ih * scale;
      const dx = gx + (gw - dw) * (0.5 + 0.04 * Math.cos(tNorm * TAU));
      const dy = gy + (gh - dh) * 0.5;
      c.drawImage(img, dx, dy, dw, dh);
      return true;
    }

    function draw2086CinemaFrame(tSec, activeReel) {
      const W = 768, H = 432, c = cinCtx;
      c.fillStyle = "#0e1516";
      c.fillRect(0, 0, W, H);
      // Calm static 35mm sprocket rails on left & right borders
      c.fillStyle = "rgba(242, 237, 226, 0.72)";
      for (let py = 14; py < H - 14; py += 30) {
        c.fillRect(10, py, 14, 17);
        c.fillRect(W - 24, py, 14, 17);
      }
      const gx = 34, gy = 16, gw = W - 68, gh = H - 32;
      c.save();
      c.beginPath(); c.rect(gx, gy, gw, gh); c.clip();
      const hold = 8.5, xfade = 2.4;
      const idx = Math.floor(tSec / hold) % npReelSlides.length;
      const nextIdx = (idx + 1) % npReelSlides.length;
      const localT = tSec % hold;
      const mix = localT > hold - xfade ? (localT - (hold - xfade)) / xfade : 0;
      const cur = npReelSlides[idx], nxt = npReelSlides[nextIdx];
      c.fillStyle = "#122120";
      c.fillRect(gx, gy, gw, gh);
      const drewCur = drawCoverImg(c, cur.img, gx, gy, gw, gh, localT / hold);
      if (!drewCur && mw.rawImages["near-surface"]) {
        drawCoverImg(c, mw.rawImages["near-surface"], gx, gy, gw, gh, localT / hold);
      }
      if (mix > 0.001 && nxt.img.complete && nxt.img.naturalWidth) {
        c.save();
        c.globalAlpha = smooth(0, 1, mix);
        drawCoverImg(c, nxt.img, gx, gy, gw, gh, 0);
        c.restore();
      }
      // Gentle vignette & bottom subtitle bar (no blackout strobe or scratch line)
      const grad = c.createLinearGradient(0, gy + gh - 74, 0, gy + gh);
      grad.addColorStop(0, "rgba(8, 14, 14, 0)");
      grad.addColorStop(1, "rgba(8, 14, 14, 0.88)");
      c.fillStyle = grad;
      c.fillRect(gx, gy + gh - 74, gw, 74);

      const reelTag = activeReel || "WF-08";
      let lyric = "";
      const aEl = $("jerikan-audio");
      if (aEl && (!aEl.paused || aEl.currentTime > 0)) {
        for (const [ts, txt] of LYRICS) if (aEl.currentTime >= ts) lyric = txt;
      }
      c.fillStyle = "#6be8dc";
      c.font = "700 13px ui-monospace, monospace";
      c.fillText(`${reelTag} · ${cur.caption}`, gx + 14, gy + gh - 30);
      c.fillStyle = "#f2ede2";
      c.font = "500 15px Georgia, serif";
      c.fillText(lyric || "Cyan Jerikan Over Cosmic Addis · Field Projection Cloth", gx + 14, gy + gh - 10);
      c.restore();
      cinemaTex.needsUpdate = true;
    }
    draw2086CinemaFrame(0, "WF-08");

    const arch = window.buildWorldArchitecture(T, {
      worldProps, groundAt, driveSurfaceAt, donkey, mw,
      cinemaMat, cyanWaterMat, beaconCyanMat, puebloDarkWinMat, antennaMat,
      makeJerikan, hasNightPostSets: true
    });
    const { puebloWinMeshes, puebloDishes, npSpinFans, inWorldScreens, oxbowSheetFront, oxbowWindBase } = arch;

    // 3) 7 Cistern Relays & 72 Fillable Jerrycans across the Entire Unified World
    function makeTerrainRing(radius, segs, mat, parentGrp) {
      const pts = new Float32Array((segs + 1) * 3);
      const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(pts, 3));
      const line = new T.Line(geo, mat); line.frustumCulled = false; parentGrp.add(line);
      return { line, pts, segs, radius };
    }
    function updateTerrainRing(ring, cx, cz, yOff = .28) {
      const { pts, segs, radius } = ring;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * TAU, x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * radius;
        pts[i * 3] = x; pts[i * 3 + 1] = driveSurfaceAt(x, z) + yOff; pts[i * 3 + 2] = z;
      }
      ring.line.geometry.attributes.position.needsUpdate = true;
    }

    const beaconPillarGeo = new T.CylinderGeometry(.24, .58, 48, 8, 1, true);
    const beaconPillarMat = new T.MeshBasicMaterial({ color: 0x0088ff, transparent: true, opacity: .34, side: T.DoubleSide, depthWrite: false });

    const relayDefs = [
      { id: "wellhead",   name: "Overlook Wellhead",         x: -22.2,  z: -6.2,  cans: 6,  lit: true },
      { id: "switchback", name: "Moraine Switchback Cistern", x: -48,    z: -168,  cans: 8,  lit: false },
      { id: "ford",       name: "Silver Ford Relay",          x: -248,   z: -55,   cans: 10, lit: false },
      { id: "oxbow",      name: "Cottonwood Oxbow Kiosk",     x: -518,   z: 94,    cans: 12, lit: false },
      { id: "pueblo",     name: "Highland Pueblo Plaza",      x: -780,   z: -35,   cans: 20, lit: false },
      { id: "abyss",      name: "Whale Fluke Cistern",        x: -1072,  z: -26,   cans: 8,  lit: false },
      { id: "halfdome",   name: "Half Dome East Apron Relay", x: 435,    z: 38,    cans: 8,  lit: false }
    ];
    const relays = [];
    for (let i = 0; i < relayDefs.length; i++) {
      const d = relayDefs[i], gy = driveSurfaceAt(d.x, d.z);
      const grp = new T.Group(); grp.position.set(d.x, gy, d.z);
      let poolMesh = null, beaconRing = null, arcLine = null, beaconCol = null;
      const cans = [];
      if (i > 0) {
        const plinth = new T.Mesh(new T.CylinderGeometry(4.15, 4.95, 3.2, 24), midRockMat);
        plinth.position.y = -1.56; grp.add(plinth);
        const wall = new T.Mesh(new T.CylinderGeometry(1.75, 1.98, .58, 22, 1, true), midRockMat); wall.position.y = .30; grp.add(wall);
        const base = new T.Mesh(new T.CircleGeometry(1.75, 22), dryWaterMat); base.rotation.x = -Math.PI / 2; base.position.y = .06; grp.add(base);
        poolMesh = new T.Mesh(new T.CircleGeometry(1.66, 22), d.lit ? cyanWaterMat : dryWaterMat);
        poolMesh.rotation.x = -Math.PI / 2; poolMesh.position.y = d.lit ? .44 : .08; grp.add(poolMesh);
        const mast = new T.Mesh(new T.CylinderGeometry(.055, .075, 4.4, 8), antennaMat); mast.position.set(1.8, 2.1, 0); grp.add(mast);
        beaconRing = new T.Mesh(new T.TorusGeometry(.56, .07, 8, 24), d.lit ? beaconCyanMat : dryWaterMat);
        beaconRing.rotation.x = Math.PI / 2; beaconRing.position.set(1.8, 4.3, 0); grp.add(beaconRing);
        beaconCol = new T.Mesh(beaconPillarGeo, beaconPillarMat);
        beaconCol.position.set(0, 24, 0); beaconCol.visible = !d.lit; grp.add(beaconCol);
      }
      // Ring & tiered racks of Fillable Translucent Jerrycans seated cleanly on depot terrace
      for (let c = 0; c < d.cans; c++) {
        const ringIdx = c < 10 ? 0 : 1, ringCount = Math.min(10, d.cans - ringIdx * 10);
        const ang = ((c - ringIdx * 10) / Math.max(1, ringCount)) * TAU + ringIdx * .3;
        const rad = i === 0 ? 2.1 : (ringIdx === 0 ? 2.55 : 3.45);
        const jx = Math.cos(ang) * rad, jz = Math.sin(ang) * rad;
        const jy = i === 0 ? (driveSurfaceAt(d.x + jx, d.z + jz) - gy) : .05;
        const jc = makeFillableJerikan(1.05, d.lit ? 1 : 0);
        jc.position.set(jx, jy, jz); jc.rotation.y = -ang + Math.PI * .5;
        grp.add(jc); cans.push(jc);
      }
      worldProps.add(grp);
      const covRing = makeTerrainRing(d.id === "pueblo" ? 38 : 28, 48, relayRingMat, worldProps);
      updateTerrainRing(covRing, d.x, d.z, .25);
      covRing.line.visible = d.lit;
      if (i > 0) {
        const prev = i === 6 ? relayDefs[0] : relayDefs[i - 1], py = driveSurfaceAt(prev.x, prev.z);
        const curve = new T.CatmullRomCurve3([
          new T.Vector3(prev.x, py + 4.2, prev.z),
          new T.Vector3((prev.x + d.x) * .5, Math.max(py, gy) + 32, (prev.z + d.z) * .5),
          new T.Vector3(d.x, gy + 4.2, d.z)
        ]);
        arcLine = new T.Mesh(new T.TubeGeometry(curve, 24, .11, 6, false), beaconCyanMat);
        arcLine.visible = d.lit; worldProps.add(arcLine);
      }
      relays.push({ ...d, y: gy, group: grp, poolMesh, beaconRing, beaconCol, covRing, arcLine, cans });
    }

    // 4) 10 Kelp-Film Forest Groves with Actual Filmstrip Fronds & Hanging 8x10 Contact Banners
    const forestGroveDefs = [
      { id: 0, region: "tetons", name: "Overlook Rim Film Grove",       x: -34,   z: -26,  minRelAlt: 15,  trees: 4, unlocked: true },
      { id: 1, region: "tetons", name: "Bluff Switchback Kelp Stand",   x: -64,   z: -146, minRelAlt: 42,  trees: 5, unlocked: false },
      { id: 2, region: "tetons", name: "Moraine Bench Ribbon Wood",     x: -150,  z: -84,  minRelAlt: 68,  trees: 5, unlocked: false },
      { id: 3, region: "tetons", name: "Silver Ford Island Canopy",     x: -240,  z: -32,  minRelAlt: 88,  trees: 5, unlocked: false },
      { id: 4, region: "tetons", name: "Cottonwood Oxbow Film Forest",  x: -494,  z: 76,   minRelAlt: 102, trees: 5, unlocked: false },
      { id: 5, region: "tetons", name: "Cathedral Pueblo High Wood",    x: -754,  z: -18,  minRelAlt: 118, trees: 5, unlocked: false },
      { id: 6, region: "abyss",  name: "Whale Fluke Filmstrip Cathedral", x: -1070, z: -18,  minRelAlt: 0,   trees: 7, unlocked: true },
      { id: 7, region: "abyss",  name: "Galleon Arch Kelp Cinema",      x: -1104, z: -48,  minRelAlt: 0,   trees: 7, unlocked: true },
      { id: 8, region: "ridge",  name: "Half Dome Cloud Notch Stand",   x: 560,   z: 12,   minRelAlt: 24,  trees: 5, unlocked: false },
      { id: 9, region: "ridge",  name: "Half Dome East Apron Forest",   x: 435,   z: 22,   minRelAlt: 85,  trees: 5, unlocked: false }
    ];
    const forestGroves = [];
    const filmTreeStipes = [], filmTreeFronds = [], filmBanners = [];
    const stipeProtoGeo = new T.CylinderGeometry(.11, .28, 18.5, 7);
    stipeProtoGeo.translate(0, 9.25, 0);
    const bladeProtoGeo = new T.PlaneGeometry(1.35, 5.4, 1, 6);
    bladeProtoGeo.translate(0, -2.7, 0);
    const frondAwakeMat = new T.MeshStandardMaterial({ map: actualFilmTex, emissiveMap: actualFilmTex, emissive: 0xb8ecff, emissiveIntensity: .56, roughness: .40, side: T.DoubleSide });
    const frondDormantMat = new T.MeshStandardMaterial({ map: filmTex, color: 0x3b3e42, roughness: .75, side: T.DoubleSide });
    const bannerGeo = new T.PlaneGeometry(2.15, 10.4, 1, 5);
    bannerGeo.translate(0, -5.2, 0);

    for (let gIdx = 0; gIdx < forestGroveDefs.length; gIdx++) {
      const def = forestGroveDefs[gIdx], gy = groundAt(def.x, def.z);
      const grp = new T.Group(); grp.position.set(def.x, gy, def.z);
      const meshes = [], tips = [], fronds = [], banners = [];
      for (let t = 0; t < def.trees; t++) {
        const a = (t / def.trees) * TAU + gIdx * .55, r = 2.6 + (t % 2) * 3.8;
        const tx = Math.cos(a) * r, tz = Math.sin(a) * r;
        const localY = groundAt(def.x + tx, def.z + tz) - gy;
        const targetH = def.region === "abyss" ? 1.15 + (t % 3) * .24 : .92 + (t % 3) * .20;
        const treeAnchor = new T.Group();
        treeAnchor.position.set(tx, localY - .15, tz);
        const stipe = new T.Mesh(stipeProtoGeo, strapMat);
        treeAnchor.add(stipe);
        // Spiral photographic filmstrip kelp fronds hanging gracefully off upper trunk
        const fCount = def.region === "abyss" ? 12 : 8;
        for (let f = 0; f < fCount; f++) {
          const frac = .20 + .76 * (f / fCount);
          const az = f * 2.39996 + t * .9;
          const blade = new T.Mesh(bladeProtoGeo, def.unlocked ? frondAwakeMat : frondDormantMat);
          blade.position.set(0, frac * 18.5, 0);
          blade.rotation.set(.95 + (1 - frac) * .35, az, 0, "YXZ");
          treeAnchor.add(blade);
          fronds.push({ mesh: blade, az, basePitch: .95 + (1 - frac) * .35, phase: f * .65 + t });
        }
        // Hanging vertical 8x10 contact-print banner across viewer height
        if (def.region === "abyss" || t % 2 === 0) {
          const ban = new T.Mesh(bannerGeo, def.unlocked ? frondAwakeMat : frondDormantMat);
          ban.position.set(Math.cos(a) * 1.12, 11.4, Math.sin(a) * 1.12);
          ban.rotation.y = a + Math.PI * .35;
          treeAnchor.add(ban);
          banners.push(ban); filmBanners.push(ban);
        }
        treeAnchor.scale.setScalar(def.unlocked ? targetH : .22);
        grp.add(treeAnchor);
        meshes.push({ mesh: treeAnchor, phase: t * 1.1 + gIdx * .7, targetH });
        const orb = new T.Mesh(new T.OctahedronGeometry(.42, 0), def.unlocked ? beaconCyanMat : strapMat);
        orb.position.set(tx, localY + (def.unlocked ? targetH : .22) * 18.5 + .45, tz);
        grp.add(orb); tips.push(orb);
      }
      worldProps.add(grp);
      forestGroves.push({ ...def, y: gy, grow: def.unlocked ? 1.0 : .22, grp, meshes, tips, fronds, banners, awakeMat: frondAwakeMat, dormantMat: frondDormantMat });
    }

    // 5) Song-Zone Flow & Signal Path Conduits (Best Route Up the Ridge & Into Abyssal/Half Dome)
    const FLOW_SEGMENTS = [
      { id: "switchback", epochIdx: 0, zone: 4, pts: [[-22.2, -6.2], [-34, -68], [-48, -168]] },
      { id: "ford",       epochIdx: 1, zone: 6, pts: [[-48, -168], [-150, -108], [-248, -55]] },
      { id: "oxbow",      epochIdx: 2, zone: 7, pts: [[-248, -55], [-380, 12], [-518, 94]] },
      { id: "pueblo",     epochIdx: 3, zone: 10, pts: [[-518, 94], [-660, 42], [-780, -35]] },
      { id: "abyss",      epochIdx: 4, zone: 8, pts: [[-780, -35], [-940, -30], [-1072, -26]] },
      { id: "halfdome",   epochIdx: 5, zone: 9, pts: [[-22.2, -6.2], [115, 8], [260, 22], [435, 38], [545, -16]] }
    ];
    const flowConduits = [], flowChevrons = [];
    const chevGeo = new T.ConeGeometry(.38, .95, 6);
    chevGeo.rotateX(Math.PI / 2);
    for (const seg of FLOW_SEGMENTS) {
      const samplePts = [];
      for (let k = 0; k < seg.pts.length - 1; k++) {
        const [x0, z0] = seg.pts[k], [x1, z1] = seg.pts[k + 1];
        for (let s = 0; s < 14; s++) {
          const u = s / 14, px = lerp(x0, x1, u), pz = lerp(z0, z1, u);
          samplePts.push(new T.Vector3(px, driveSurfaceAt(px, pz) + .22, pz));
        }
      }
      const [lx, lz] = seg.pts[seg.pts.length - 1];
      samplePts.push(new T.Vector3(lx, driveSurfaceAt(lx, lz) + .22, lz));
      const curve = new T.CatmullRomCurve3(samplePts);
      const tubeMat = new T.MeshBasicMaterial({ color: 0x0080ff, transparent: true, opacity: .35 });
      const tube = new T.Mesh(new T.TubeGeometry(curve, 56, .13, 6, false), tubeMat);
      worldProps.add(tube);
      const chevs = [];
      for (let c = 0; c < 5; c++) {
        const cm = new T.Mesh(chevGeo, beaconCyanMat.clone());
        worldProps.add(cm); chevs.push({ mesh: cm, offset: c / 5 });
        flowChevrons.push(cm);
      }
      flowConduits.push({ ...seg, curve, tube, mat: tubeMat, chevs });
    }

    // 6) Deployable 3D Mahogany & Brass 8×10 Field Camera on Tripod (KeyB / #btn-rig)
    const fieldRigGroup = (() => {
      const g = new T.Group(); g.visible = false;
      const mahog = new T.MeshStandardMaterial({ color: 0x6b2f16, roughness: .55 });
      const bellows = new T.MeshStandardMaterial({ color: 0x16181c, roughness: .85 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        addPackBar(g, [Math.cos(a) * .45, 0, Math.sin(a) * .45], [0, 1.15, 0], .024, sawWoodMat);
      }
      const bed = new T.Mesh(new T.BoxGeometry(.44, .06, .58), mahog); bed.position.set(0, 1.18, 0); g.add(bed);
      const rearStd = new T.Mesh(new T.BoxGeometry(.42, .38, .05), mahog); rearStd.position.set(0, 1.38, -.20); g.add(rearStd);
      const frontStd = new T.Mesh(new T.BoxGeometry(.34, .32, .05), mahog); frontStd.position.set(0, 1.36, .18); g.add(frontStd);
      const bel = new T.Mesh(new T.BoxGeometry(.30, .28, .36), bellows); bel.position.set(0, 1.36, -.01); g.add(bel);
      const lens = new T.Mesh(new T.CylinderGeometry(.085, .078, .10, 16), brassMat);
      lens.rotation.x = Math.PI / 2; lens.position.set(0, 1.36, .24); g.add(lens);
      const glassOrb = new T.Mesh(new T.CylinderGeometry(.068, .068, .02, 16), beaconCyanMat);
      glassOrb.rotation.x = Math.PI / 2; glassOrb.position.set(0, 1.36, .295); g.add(glassOrb);
      worldProps.add(g);
      return g;
    })();

    // 7) 4 Summit Base-Jump Launch Decks across Unified World
    const SUMMITS = [
      {
        id: "overlook_jump", region: "tetons", name: "Overlook Cliff Base-Jump (+162 m)",
        x: -48.0, z: 1.35, boostY: 4.5, heading: -Math.PI * .52,
        note: "Leap straight off Adams’s 1942 Overlook rail over the Snake River bend!"
      },
      {
        id: "teton_high_jump", region: "tetons", name: "High Teton Moraine Summit (+" + Math.round(mw.bestTetonPeak.y + 18) + " m)",
        x: mw.bestTetonPeak.x, z: mw.bestTetonPeak.z, boostY: 28,
        heading: Math.atan2(-260 - mw.bestTetonPeak.x, -40 - mw.bestTetonPeak.z),
        note: "High-altitude rim above the entire Jackson Hole Snake River valley."
      },
      {
        id: "halfdome_jump", region: "ridge", name: "Half Dome Granite Summit (+" + Math.round(mw.bestHalfDomePeak.y + 22) + " m)",
        x: mw.bestHalfDomePeak.x, z: mw.bestHalfDomePeak.z, boostY: 26,
        heading: Math.atan2(545 - mw.bestHalfDomePeak.x, -8 - mw.bestHalfDomePeak.z),
        note: "High Sierra granite shoulder gliding over the Half Dome Cloud Bridge."
      },
      {
        id: "abyss_jump", region: "abyss", name: "Abyssal Whale Fluke Rim (+122 m)",
        x: -975, z: -35, boostY: 24,
        heading: Math.atan2(-1085 + 975, 0),
        note: "Soar over the Whale Fluke Sanctuary, sunken galleon, and kelp-film cathedral!"
      }
    ];
    for (const sm of SUMMITS) {
      const sy = driveSurfaceAt(sm.x, sm.z);
      const pad = new T.Group(); pad.position.set(sm.x, sy, sm.z); pad.rotation.y = sm.heading;
      const deck = new T.Mesh(new T.BoxGeometry(3.2, .25, 6.2), sawWoodMat); deck.position.set(0, .2, 1.5); deck.rotation.x = -.14; pad.add(deck);
      for (const sx of [-1.45, 1.45]) {
        const b = new T.Mesh(new T.CylinderGeometry(.05, .05, 1.8, 8), antennaMat); b.position.set(sx, 1.0, 4.2); pad.add(b);
        const orb = new T.Mesh(new T.SphereGeometry(.14, 10, 8), beaconCyanMat); orb.position.set(sx, 1.95, 4.2); pad.add(orb);
      }
      worldProps.add(pad);
    }

    /* Live Donkey WiFi Rings + Expanding 3D Wavefronts + Lead Rope */
    const donkeyRings = [
      makeTerrainRing(1.0, 48, new T.LineBasicMaterial({ color: 0x0088ff, transparent: true, opacity: .90 }), actorRoot),
      makeTerrainRing(1.0, 56, new T.LineBasicMaterial({ color: 0x0066ff, transparent: true, opacity: .72 }), actorRoot),
      makeTerrainRing(1.0, 64, new T.LineBasicMaterial({ color: 0x0048ee, transparent: true, opacity: .52 }), actorRoot)
    ];
    const waveArcs = [];
    const waveRingPts = [];
    for (let s = 0; s < 64; s++) { const a = (s / 64) * TAU; waveRingPts.push(Math.cos(a), 0, Math.sin(a)); }
    const waveRingGeo = new T.BufferGeometry();
    waveRingGeo.setAttribute("position", new T.Float32BufferAttribute(waveRingPts, 3));
    for (let i = 0; i < 4; i++) {
      const m = new T.LineLoop(waveRingGeo, new T.LineBasicMaterial({ color: 0x0088ff, transparent: true, opacity: .82 }));
      actorRoot.add(m); waveArcs.push({ mesh: m, phase: i / 4 });
    }

    const ropePts = new Float32Array(13 * 3);
    const ropeGeo = new T.BufferGeometry(); ropeGeo.setAttribute("position", new T.BufferAttribute(ropePts, 3));
    const leadRope = new T.Line(ropeGeo, new T.LineBasicMaterial({ color: 0xcbb182, transparent: true, opacity: .85 }));
    leadRope.frustumCulled = false; actorRoot.add(leadRope);

    /* ---------- WiFi-Bounded Cyan Water Rain (Falls ONLY Where WiFi Donkey Water Reaches!) ---------- */
    const RAIN_N = 420;
    const rainPos = new Float32Array(RAIN_N * 6);
    const rainX = new Float32Array(RAIN_N), rainY = new Float32Array(RAIN_N), rainZ = new Float32Array(RAIN_N), rainSpd = new Float32Array(RAIN_N);
    const rainGeo = new T.BufferGeometry(); rainGeo.setAttribute("position", new T.BufferAttribute(rainPos, 3));
    const rainMesh = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0x006eff, transparent: true, opacity: .88 }));
    rainMesh.frustumCulled = false;
    actorRoot.add(rainMesh);

    const activeEmitters = [];
    function sampleWifiEmitters() {
      activeEmitters.length = 0;
      activeEmitters.push({ x: donkey.state.x, z: donkey.state.z, y: donkey.group.position.y + 2.2, r: state.signalRadius });
      for (const r of relays) if (r.lit) activeEmitters.push({ x: r.x, z: r.z, y: r.y + 2.5, r: r.id === "pueblo" ? 38 : 28 });
      for (const g of forestGroves) if (g.unlocked) activeEmitters.push({ x: g.x, z: g.z, y: g.y + 8.0, r: 26 * g.grow });
      return activeEmitters;
    }
    function inWifiReach(x, z, emitters) {
      for (let i = 0; i < emitters.length; i++) {
        const em = emitters[i];
        const dx = x - em.x, dz = z - em.z;
        if (dx * dx + dz * dz <= em.r * em.r * .94) return true;
      }
      return false;
    }
    function respawnRaindrop(i, emitters) {
      const localEms = emitters.filter((em, idx) => idx === 0 || Math.hypot(em.x - donkey.state.x, em.z - donkey.state.z) < 420);
      const useDonkey = localEms.length <= 1 || Math.random() < .72;
      const em = useDonkey ? localEms[0] : localEms[1 + Math.floor(Math.random() * (localEms.length - 1))];
      const ang = Math.random() * TAU, rad = Math.sqrt(Math.random()) * em.r * .90;
      const rx = em.x + Math.cos(ang) * rad, rz = em.z + Math.sin(ang) * rad;
      const surf = driveSurfaceAt(rx, rz);
      rainX[i] = rx; rainZ[i] = rz;
      rainY[i] = Math.max(surf, em.y) + 5 + Math.random() * 26;
      rainSpd[i] = 12 + Math.random() * 7;
    }
    function initRain() {
      const em = sampleWifiEmitters();
      for (let i = 0; i < RAIN_N; i++) {
        respawnRaindrop(i, em);
        const surf = driveSurfaceAt(rainX[i], rainZ[i]);
        rainY[i] = surf + Math.random() * Math.max(12, rainY[i] - surf);
      }
    }

    donkey.place(-26.0, -1.2, -Math.PI * .45, (x, z) => driveSurfaceAt(x, z));
    donkey.update(.016, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, (x, z) => driveSurfaceAt(x, z));
    donkey.state.onStep = (leg, gait) => { audio.step(leg, gait); if (DEMO && field && field.ready && leg && leg.pos) field.hoof(leg.pos, gait, Math.hypot(leg.pos.x + 1630, leg.pos.z - 665) < 300 && nearSet(leg.pos.x, leg.pos.z) < 6); };
    state.y = driveSurfaceAt(state.x, state.z) + 1.68;
    const cast = window.makeExpeditionCast ? window.makeExpeditionCast(T, {
      parent: actorRoot, surfaceAt: driveSurfaceAt, hasAhiya: true
    }) : null;
    const worldBridge = (window.Mesh2MotionWorldBridge && cast && Array.isArray(cast.list))
      ? window.Mesh2MotionWorldBridge.createWorldCastDriver(T, {
          clipsBaseUrl: "../motion-pipeline/mesh2motion/clips",
          preload: ["idle", "idle-talking", "walk-happy", "walk-carry", "walk-backwards", "jog", "dance-arm-pump", "greeting"],
          defaultBlend: 0.84,
          defaultFade: 0.25
        })
      : null;
    if (worldBridge && cast && Array.isArray(cast.list)) {
      cast.list.forEach((ch, idx) => {
        const cid = (ch.state && ch.state.id) || `cast_${idx}`;
        const isCarrier = cid === "imani" || (ch.state && ch.state.role === "carrier");
        worldBridge.registerActor(cid, ch, {
          defaultClip: isCarrier ? "idle" : "idle-talking",
          blend: 0.84,
          phaseOffset: (idx * 0.71) % 3.1
        });
      });
    }

    /* ---------- Playable 3rd/1st-Person Character, Throw, Jump, Ragdoll Tumble & Big Interactive Map ---------- */
    const PLAYABLE_CAST_MAP = {
      imani: ["imani"],
      june: ["june"],
      makeda: ["makeda"],
      elder: ["ferry_bekele", "queue_4", "convoy_elder_1", "compound_partner"],
      hanna: ["ppc_op_female", "nell", "etta"]
    };
    const PLAYABLE_NAMES = { imani: "Imani", june: "June", makeda: "Makeda", elder: "Elder Bekele", hanna: "Hanna" };
    let activeAvatar = null;
    let activeAvatarSavedPos = null;
    let throwAnimTimer = 0;

    function resolvePlayableAvatar(roleKey) {
      if (!cast || !Array.isArray(cast.list) || !cast.list.length) return null;
      const ids = PLAYABLE_CAST_MAP[roleKey] || [roleKey];
      for (const want of ids) {
        const found = cast.list.find(c => c && c.state && c.state.id === want);
        if (found) return found;
      }
      return cast.list[0];
    }

    function setPlayAs(roleKey, silent = false) {
      if (!PLAYABLE_CAST_MAP[roleKey]) roleKey = "imani";
      // Restore previous avatar if it wasn't imani
      if (activeAvatar && activeAvatarSavedPos && state.playAs !== roleKey) {
        activeAvatar.group.visible = true;
        activeAvatar.group.rotation.x = 0;
        activeAvatar.group.rotation.z = 0;
        activeAvatar.group.position.set(activeAvatarSavedPos.x, activeAvatarSavedPos.y, activeAvatarSavedPos.z);
        if (activeAvatar.state) {
          activeAvatar.state.x = activeAvatarSavedPos.x;
          activeAvatar.state.y = activeAvatarSavedPos.y;
          activeAvatar.state.z = activeAvatarSavedPos.z;
          activeAvatar.state.playerControlled = false;
        }
      }
      state.playAs = roleKey;
      activeAvatar = resolvePlayableAvatar(roleKey);
      if (activeAvatar) {
        activeAvatarSavedPos = {
          x: activeAvatar.group.position.x,
          y: activeAvatar.group.position.y,
          z: activeAvatar.group.position.z
        };
        if (activeAvatar.state) activeAvatar.state.playerControlled = true;
      }
      if ($("sel-play-as")) $("sel-play-as").value = roleKey;
      if (!silent) toast(`Playing as ${PLAYABLE_NAMES[roleKey] || roleKey} (${state.cameraMode === "third" ? "3rd-Person" : "1st-Person"})`);
      return activeAvatar;
    }
    setPlayAs("imani", true);

    function setCameraMode(mode, silent = false) {
      state.cameraMode = mode === "first" ? "first" : "third";
      const btn = $("btn-cam-mode");
      if (btn) {
        btn.textContent = state.cameraMode === "third" ? "CAM: 3RD" : "CAM: 1ST";
        btn.classList.toggle("active", state.cameraMode === "third");
        btn.setAttribute("aria-pressed", String(state.cameraMode === "third"));
      }
      if (state.cameraMode === "third") {
        const backX = state.x + Math.sin(state.yaw) * 4.4;
        const backZ = state.z + Math.cos(state.yaw) * 4.4;
        state.chaseCamPos.set(backX, Math.max(driveSurfaceAt(backX, backZ) + 0.9, state.y + 0.7), backZ);
        state.chaseLookAt.set(state.x, state.y - 0.15, state.z);
      }
      if (!silent) toast(`Camera: ${state.cameraMode === "third" ? "3rd-Person Follow" : "1st-Person View"}`);
    }
    function toggleCameraMode() {
      setCameraMode(state.cameraMode === "third" ? "first" : "third");
    }

    function jumpPlayer() {
      if (state.drivingCart || state.gliding || state.riding) return false;
      if (!carrierPhys) return false;
      const ok = carrierPhys.jump(DEMO ? 5.4 : 9.8);                    // the demo is a person with a can: a hop, not a leap
      if (ok && window.HighlandSoundscape && typeof window.HighlandSoundscape.playFootstep === "function") {
        window.HighlandSoundscape.playFootstep("rock", state.waterLiters || 0);
      }
      return ok;
    }

    function triggerPlayerTumble(intensity = 0.8) {
      if (!carrierPhys || state.drivingCart || state.gliding) return false;
      const dirX = -Math.sin(state.yaw);
      const dirZ = -Math.cos(state.yaw);
      carrierPhys.triggerTumble(dirX, dirZ, 7.2 * clamp(intensity, 0.5, 1.5), 1.35);
      if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playRagdollThud === "function") {
        window.HighlandSoundscape.playRagdollThud(clamp(intensity, 0.3, 1.0));
      }
      toast("Tumbling downhill — recovering footing...");
      return true;
    }

    function onCarrierPhysicsEvent(evt) {
      if (!evt) return;
      if (evt.type === "hard_land" || evt.type === "tumble") {
        if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playRagdollThud === "function") {
          window.HighlandSoundscape.playRagdollThud(evt.intensity || 0.75);
        }
        toast("Hard cliff impact — ragdoll tumble!");
      } else if (evt.type === "land") {
        if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playFootstep === "function") {
          window.HighlandSoundscape.playFootstep("dirt", state.waterLiters || 0);
        }
      }
    }

    function onProjectileBounce(evt) {
      if (!evt) return;
      if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playImpact === "function") {
        window.HighlandSoundscape.playImpact(evt.intensity);
      }
      if (physParticles && evt.kind === "jerrycan") {
        physParticles.spawnSpill(evt.x, evt.y + 0.15, evt.z, 0, 0, 5);
      }
      // If a thrown jerrycan lands right beside an unlit cistern, splash-ignite it!
      if (evt.kind === "jerrycan" && evt.bounces === 1) {
        for (const r of relays) {
          if (!r.lit && Math.hypot(r.x - evt.x, r.z - evt.z) < 7.5) {
            finishRelayIgnition(r);
            break;
          }
        }
      }
    }

    function throwObject(kindOverride) {
      if (!projPool) return null;
      const aimYaw = state.drivingCart ? (wagon.heading + Math.PI) : state.yaw;
      const aimPitch = clamp(state.pitch || 0, -0.45, 0.65);
      const fwdX = -Math.sin(aimYaw) * Math.cos(aimPitch);
      const fwdZ = -Math.cos(aimYaw) * Math.cos(aimPitch);
      const fwdY = Math.sin(aimPitch);
      const speed = 16.8;
      const spawnX = (state.drivingCart ? wagon.x : state.x) + fwdX * 0.9;
      const spawnY = (state.drivingCart ? wagon.y + 2.2 : state.y - 0.15) + 0.25;
      const spawnZ = (state.drivingCart ? wagon.z : state.z) + fwdZ * 0.9;
      const item = projPool.launch({
        kind: kindOverride,
        x: spawnX, y: spawnY, z: spawnZ,
        vx: fwdX * speed + (state.vx || 0) * 0.35,
        vy: Math.max(4.8, 6.2 + fwdY * speed * 0.75),
        vz: fwdZ * speed + (state.vz || 0) * 0.35
      });
      state.throwCount = projPool.totalThrown;
      throwAnimTimer = 0.48;
      if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playThrow === "function") {
        window.HighlandSoundscape.playThrow();
      }
      toast(`Threw ${item && item.kind === "jerrycan" ? "20L Cyan Jerrycan" : "Highland Stone"}!`);
      return item;
    }

    /* --- Full-Screen Interactive Click-to-Travel Topographic Map --- */
    const BIG_MAP_SPAN_X = 760;
    const BIG_MAP_SPAN_Z = 520;
    let bigMapCenter = { x: -24, z: 0 };

    function renderBigMap() {
      const cvs = $("big-map-canvas");
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      const W = cvs.width, H = cvs.height;
      bigMapCenter = { x: state.x, z: state.z };
      const minX = bigMapCenter.x - BIG_MAP_SPAN_X * 0.5;
      const minZ = bigMapCenter.z - BIG_MAP_SPAN_Z * 0.5;
      const toPx = (wx, wz) => [
        ((wx - minX) / BIG_MAP_SPAN_X) * W,
        ((wz - minZ) / BIG_MAP_SPAN_Z) * H
      ];

      // Sample topographic elevation grid
      const cols = 144, rows = 96;
      const cellW = W / cols, cellH = H / rows;
      const grid = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        const wz = minZ + ((r + 0.5) / rows) * BIG_MAP_SPAN_Z;
        for (let c = 0; c < cols; c++) {
          const wx = minX + ((c + 0.5) / cols) * BIG_MAP_SPAN_X;
          grid[r * cols + c] = groundAt(wx, wz);
        }
      }
      for (let r = 0; r < rows; r++) {
        const wz = minZ + ((r + 0.5) / rows) * BIG_MAP_SPAN_Z;
        for (let c = 0; c < cols; c++) {
          const wx = minX + ((c + 0.5) / cols) * BIG_MAP_SPAN_X;
          const idx = r * cols + c;
          const h = grid[idx];
          const hw = c > 0 ? grid[idx - 1] : h;
          const hn = r > 0 ? grid[idx - cols] : h;
          const isWater = mw.wet(wx, wz) > -0.45;
          const contour = Math.abs(h - 10 * Math.round(h / 10)) < 1.15;
          const shade = clamp(46 + (hw - h) * 3.0 + (hn - h) * 1.8 + (h - 140) * 0.16, 18, 128);
          if (isWater) {
            ctx.fillStyle = "rgb(18, 72, 92)";
          } else if (contour) {
            ctx.fillStyle = `rgb(${Math.round(shade * 0.65)}, ${Math.round(shade * 0.92)}, ${Math.round(shade * 1.05)})`;
          } else {
            ctx.fillStyle = `rgb(${Math.round(shade * 0.72)}, ${Math.round(shade * 0.84)}, ${Math.round(shade * 0.88)})`;
          }
          ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
        }
      }

      // Subtle grid lines
      ctx.strokeStyle = "rgba(40, 216, 240, 0.12)";
      ctx.lineWidth = 1;
      for (let gx = 1; gx < 6; gx++) {
        ctx.beginPath(); ctx.moveTo((W * gx) / 6, 0); ctx.lineTo((W * gx) / 6, H); ctx.stroke();
      }
      for (let gy = 1; gy < 4; gy++) {
        ctx.beginPath(); ctx.moveTo(0, (H * gy) / 4); ctx.lineTo(W, (H * gy) / 4); ctx.stroke();
      }

      // Draw all cisterns / relays
      ctx.font = "600 10px Inter, system-ui, sans-serif";
      ctx.textBaseline = "middle";
      for (const r of relays) {
        const [rx, ry] = toPx(r.x, r.z);
        if (rx < -20 || rx > W + 20 || ry < -20 || ry > H + 20) continue;
        ctx.strokeStyle = r.lit ? "#18b4ff" : "#ff9f43";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(rx, ry, r.lit ? 10 : 7, 0, TAU); ctx.stroke();
        ctx.fillStyle = r.lit ? "rgba(24, 180, 255, 0.32)" : "rgba(255, 159, 67, 0.25)";
        ctx.fill();
        ctx.fillStyle = "#f1eee6";
        ctx.fillText(r.name.split(" ")[0], rx + 12, ry);
      }

      // Draw Wagon
      const [wx, wy] = toPx(wagon.x, wagon.z);
      ctx.fillStyle = "#cbb182";
      ctx.fillRect(wx - 5, wy - 5, 10, 10);
      ctx.fillStyle = "#f1eee6";
      ctx.fillText("WAGON", wx + 9, wy);

      // Draw Mistletoe
      const [mx, my] = toPx(donkey.state.x, donkey.state.z);
      ctx.fillStyle = "#f4c462";
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, TAU); ctx.fill();
      ctx.fillStyle = "#ffe5a3";
      ctx.fillText("MISTLETOE", mx + 9, my);

      // Draw Player arrow
      const [px, py] = toPx(state.x, state.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-state.yaw);
      ctx.fillStyle = "#28d8f0";
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function teleportToWorld(wx, wz, label = "Map waypoint") {
      const [cx, cz] = worldBoundsClamp(wx, wz);
      const dist = Math.hypot(cx - state.x, cz - state.z);
      const gy = driveSurfaceAt(cx, cz);
      state.drivingCart = false;
      state.riding = false;
      state.gliding = false;
      state.wagonCruise = 0;
      state.x = cx;
      state.z = cz;
      state.y = gy + 1.68;
      state.vx = 0; state.vz = 0;
      if (carrierPhys) {
        carrierPhys.vx = 0; carrierPhys.vy = 0; carrierPhys.vz = 0;
        carrierPhys.grounded = true;
        carrierPhys.tumbleTimer = 0;
      }
      // Bring Mistletoe safely beside player on ground
      const [dx, dz] = worldBoundsClamp(cx + 2.8, cz + 1.8);
      donkey.place(dx, dz, state.yaw + Math.PI, (x, z) => driveSurfaceAt(x, z));
      if (state.cameraMode === "third") {
        const backX = state.x + Math.sin(state.yaw) * 4.4;
        const backZ = state.z + Math.cos(state.yaw) * 4.4;
        state.chaseCamPos.set(backX, Math.max(driveSurfaceAt(backX, backZ) + 0.9, state.y + 0.7), backZ);
        state.chaseLookAt.set(state.x, gy + 1.38, state.z);
      }
      toast(`Traveled ${Math.round(dist)} m to ${label} (Elev ${Math.round(gy)} m)`);
      updateHUD();
      return { x: cx, y: gy, z: cz, dist: Math.round(dist) };
    }

    function setBigMapOpen(open) {
      const modal = $("big-map-modal");
      if (!modal) return;
      state.bigMapOpen = Boolean(open);
      modal.hidden = !state.bigMapOpen;
      if (state.bigMapOpen) {
        renderBigMap();
        if ($("big-map-readout")) {
          $("big-map-readout").textContent = `POS (${Math.round(state.x)}, ${Math.round(state.z)}) · ELEV ${Math.round(groundAt(state.x, state.z))} m · CLICK ANYWHERE TO TRAVEL`;
        }
      }
    }
    function toggleBigMap() { setBigMapOpen(!state.bigMapOpen); }

    if ($("btn-cam-mode")) $("btn-cam-mode").addEventListener("click", toggleCameraMode);
    if ($("sel-play-as")) $("sel-play-as").addEventListener("change", e => setPlayAs(e.target.value));
    if ($("btn-throw-obj")) $("btn-throw-obj").addEventListener("click", () => throwObject());
    if ($("btn-jump-foot")) $("btn-jump-foot").addEventListener("click", () => jumpPlayer());
    if ($("btn-big-map")) $("btn-big-map").addEventListener("click", toggleBigMap);
    if ($("btn-drive-pill")) $("btn-drive-pill").addEventListener("click", () => toggleCart());
    if ($("btn-pump-pill")) $("btn-pump-pill").addEventListener("click", () => pumpWell());
    if ($("btn-run-toggle")) {
      $("btn-run-toggle").addEventListener("click", () => {
        state.sprintToggle = !state.sprintToggle;
        $("btn-run-toggle").setAttribute("aria-pressed", String(state.sprintToggle));
        $("btn-run-toggle").classList.toggle("active", state.sprintToggle);
        toast(state.sprintToggle ? "Sprint RUN: ON" : "Sprint RUN: OFF");
      });
    }
    function toggleImmersiveMenu() {
      const clean = document.body.classList.toggle("hud-clean");
      const btn = $("btn-menu-toggle");
      if (btn) {
        btn.setAttribute("aria-pressed", String(!clean));
        btn.textContent = clean ? "MENU (TAB)" : "HIDE MENU (TAB)";
      }
      return !clean;
    }
    if ($("btn-menu-toggle")) {
      $("btn-menu-toggle").addEventListener("click", toggleImmersiveMenu);
    }

    const _npcWorldTmp = new T.Vector3();
    const _donkeyWorldTmp = new T.Vector3();
    const _playerWorldTmp = new T.Vector3();
    const NPC_INTERACT_RADIUS = 11.0;

    function getNpcWorldPos(ch, out) {
      if (!ch || !ch.group) return null;
      ch.group.updateMatrixWorld(false);
      return ch.group.getWorldPosition(out);
    }

    function getDonkeyWorldPos(out) {
      if (donkey && donkey.group) {
        donkey.group.updateMatrixWorld(false);
        return donkey.group.getWorldPosition(out);
      }
      return out.set(donkey.state.x, driveSurfaceAt(donkey.state.x, donkey.state.z), donkey.state.z);
    }

    function getNpcDisplayInfo(ch) {
      const cid = String((ch && ch.state && ch.state.id) || "").toLowerCase();
      const job = ch && ch.group && ch.group.userData && ch.group.userData.npcJob;
      const name = (job && job.displayName)
        || (ch && ch.state && (ch.state.displayName || ch.state.name))
        || "Villager";
      const jobTitle = (job && job.jobTitle)
        || (ch && ch.state && ch.state.role)
        || "Night Post Crew";
      const jobStatus = (job && job.currentStatus)
        || "Monitoring the station and cyan water reserves";
      return { cid, name, jobTitle, jobStatus, job };
    }

    function findNearestInteractable(maxDist = NPC_INTERACT_RADIUS) {
      let best = null;
      let bestD = maxDist;
      const px = state.drivingCart ? wagon.x : state.x;
      const pz = state.drivingCart ? wagon.z : state.z;
      if (cast && Array.isArray(cast.list)) {
        for (let i = 0; i < cast.list.length; i++) {
          const ch = cast.list[i];
          if (!ch || !ch.group || !ch.group.visible || ch === activeAvatar) continue;
          const wp = getNpcWorldPos(ch, _npcWorldTmp);
          if (!wp) continue;
          const d = Math.hypot(wp.x - px, wp.z - pz);
          if (d < bestD) {
            bestD = d;
            const info = getNpcDisplayInfo(ch);
            best = {
              kind: "npc",
              npc: ch,
              id: info.cid,
              name: info.name,
              jobTitle: info.jobTitle,
              jobStatus: info.jobStatus,
              dist: d,
              wx: wp.x,
              wy: wp.y,
              wz: wp.z
            };
          }
        }
      }
      const dw = getDonkeyWorldPos(_donkeyWorldTmp);
      const dDonkey = Math.hypot(dw.x - px, dw.z - pz);
      if (dDonkey < bestD) {
        best = {
          kind: "donkey",
          npc: null,
          id: "mistletoe",
          name: "Mistletoe",
          jobTitle: "Expedition Donkey",
          jobStatus: state.donkeyCollapsed
            ? "Dehydrated and collapsed — needs cyan water immediately"
            : `Standing ready with 20L saddle pack (${Math.round(clamp(state.donkeyWater, 0, 1) * 100)}% hydrated)`,
          dist: dDonkey,
          wx: dw.x,
          wy: dw.y,
          wz: dw.z
        };
      }
      return best;
    }

    let _lastCtxSig = "";
    function updateContextualActions() {
      const box = $("ctx-actions");
      const sep = $("ctx-sep");
      if (!box) return;
      const acts = [];
      const distWagon = Math.hypot(wagon.x - state.x, wagon.z - state.z);
      const distWell = Math.hypot(well.x - state.x, well.z - state.z);
      const dw = getDonkeyWorldPos(_donkeyWorldTmp);
      const distDonkey = Math.hypot(dw.x - state.x, dw.z - state.z);
      let nearCistern = null;
      for (let i = 0; i < relays.length; i++) {
        if (Math.hypot(relays[i].x - state.x, relays[i].z - state.z) < 15) {
          nearCistern = relays[i];
          break;
        }
      }
      const nearTarget = findNearestInteractable(NPC_INTERACT_RADIUS);
      const carryingWater = state.waterLiters > 0.1;

      if (nearTarget) {
        const nm = String(nearTarget.name || "CREW").toUpperCase();
        const jt = String(nearTarget.jobTitle || "CREW").toUpperCase();
        acts.push({
          id: "talk",
          label: `[E] TALK TO ${nm} (${jt})`,
          fn: () => openDialogue(nearTarget)
        });
      }
      if (state.drivingCart) {
        acts.push({ id: "park", label: "[C] PARK WAGON", fn: () => toggleCart() });
      } else if (distWagon < 7.5) {
        acts.push({ id: "drive", label: "[C] DRIVE WAGON", fn: () => toggleCart() });
      }
      if (distWell < 14.5) {
        acts.push({ id: "pump", label: "[P] PUMP WATER", fn: () => pumpWell() });
      }
      if (nearCistern) {
        acts.push({ id: "pour", label: "[F] POUR INTO CISTERN", fn: () => triggerPour() });
      }
      if (state.donkeyCollapsed || distDonkey < NPC_INTERACT_RADIUS) {
        acts.push({
          id: "water-burro",
          label: state.donkeyCollapsed ? "[F] GIVE WATER (URGENT)" : "[F] GIVE WATER",
          urgent: state.donkeyCollapsed,
          fn: () => {
            if (state.donkeyCollapsed) giveEmergencyWater();
            else { triggerSquirtBurst(1.1); pumpWell(); }
          }
        });
        if (!state.donkeyCollapsed && distDonkey < 8.0) {
          acts.push({ id: "ride", label: state.riding ? "[V] DISMOUNT" : "[V] RIDE", fn: () => toggleRide() });
        }
      }
      if (nearTarget && nearTarget.kind === "npc" && carryingWater) {
        acts.push({ id: "share", label: "[F] SHARE CYAN WATER", fn: () => triggerSquirtBurst(1.2) });
      }
      if (carryingWater && !state.drivingCart) {
        if (!acts.some(a => a.id === "share" || a.id === "pour")) {
          acts.push({ id: "squirt", label: "[F] SQUIRT WATER", fn: () => triggerSquirtBurst(1.4) });
        }
        acts.push({ id: "throw", label: "[G] THROW CAN", fn: () => throwObject("jerrycan") });
      }

      state.ctxActs = acts;                                                   // the demo deck shows these too
      const sig = acts.map(a => a.id + ":" + a.label + ":" + (a.urgent ? 1 : 0)).join("|");
      if (sig !== _lastCtxSig) {
        _lastCtxSig = sig;
        box.innerHTML = "";
        for (let i = 0; i < acts.length; i++) {
          const a = acts[i];
          const b = document.createElement("button");
          b.type = "button";
          b.className = "ctx-pill" + (a.urgent ? " urgent" : "");
          b.textContent = a.label;
          b.addEventListener("click", a.fn);
          box.appendChild(b);
        }
        if (sep) sep.hidden = acts.length === 0;
      }

      // Minimal corner title & water readout
      const titleEl = $("immersive-title");
      const waterEl = $("immersive-water");
      if (titleEl) {
        const Z = ZONES[state.currentZone] || ZONES[4];
        titleEl.textContent = `NIGHT POST · ZONE ${Z.n || "IV"}`;
      }
      if (waterEl) {
        const wPct = Math.round(clamp(state.donkeyWater, 0, 1) * 100);
        const lit = Math.round(state.waterLiters || 0);
        waterEl.textContent = state.donkeyCollapsed
          ? `${lit}L · MISTLETOE COLLAPSED (${wPct}%)`
          : `${lit}L · MISTLETOE ${wPct}%`;
        waterEl.classList.toggle("low", state.donkeyCollapsed || wPct <= 25);
      }
    }

    /* ---------- Living World: Front/Hip Carry Fix, WiFi Water Squirt Gun, Quests, Speech & NPC Phones ---------- */
    donkey.drinkTimer = 0;
    donkey.playDrink = function (dur = 2.4) {
      const wasDrinking = donkey.drinkTimer > 0.1;
      donkey.drinkTimer = Math.max(donkey.drinkTimer || 0, dur);
      if (typeof donkey.feed === "function") donkey.feed();
      if (typeof donkey.soothe === "function") donkey.soothe();
      if (!wasDrinking && window.HighlandSoundscape && typeof window.HighlandSoundscape.playDrink === "function") {
        window.HighlandSoundscape.playDrink();
      }
    };

    const _speechState = { lastAt: 0, hideTimer: 0 };
    state.activeDialogueTarget = null;
    function closeDialogue() {
      state.activeDialogueTarget = null;
      _speechState.hideTimer = 0;
      const card = $("dialogue-card");
      if (card) card.hidden = true;
      try {
        if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
      } catch (e) {}
    }

    function speakLine(speaker, text, sub = "", pitch = 1.0, rate = 1.02, jobLine = "", interactive = false) {
      state.lastDialogue = { speaker, text, sub, jobLine, interactive, at: Date.now() };
      const card = $("dialogue-card");
      if (card) {
        card.hidden = false;
        if ($("dialogue-speaker")) $("dialogue-speaker").textContent = speaker;
        if ($("dialogue-text")) $("dialogue-text").textContent = text;
        if ($("dialogue-job")) {
          $("dialogue-job").textContent = jobLine || "";
          $("dialogue-job").hidden = !jobLine;
        }
        if ($("dialogue-sub")) $("dialogue-sub").textContent = sub;
        const actRow = $("dialogue-actions");
        if (actRow) actRow.hidden = !interactive;
      }
      _speechState.hideTimer = interactive ? 26.0 : 5.4;
      if (typeof window !== "undefined" && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined") {
        try {
          const nowMs = Date.now();
          if (nowMs - _speechState.lastAt > 250) {
            _speechState.lastAt = nowMs;
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(text);
            utt.pitch = clamp(pitch, 0.7, 1.45);
            utt.rate = clamp(rate, 0.85, 1.2);
            utt.volume = 0.85;
            window.speechSynthesis.speak(utt);
          }
        } catch (e) {}
      }
    }

    function updateQuestUI(celebrate = false) {
      const q = state.quests;
      const doneCount = (q.q1_mistletoe.done ? 1 : 0) + (q.q2_elder_relay.done ? 1 : 0) + (q.q3_june_moraine.done ? 1 : 0);
      if ($("quest-count")) $("quest-count").textContent = `${doneCount}/3`;
      const list = $("quest-list");
      if (list) {
        const items = list.querySelectorAll(".quest-item");
        items.forEach(li => {
          const id = li.getAttribute("data-qid");
          const prog = li.querySelector(".quest-prog");
          if (id === "q1_mistletoe") {
            li.classList.toggle("done", q.q1_mistletoe.done);
            if (prog) prog.textContent = q.q1_mistletoe.done ? "DONE" : `${Math.min(99, Math.round(q.q1_mistletoe.drinkSec * 100))}%`;
          } else if (id === "q2_elder_relay") {
            li.classList.toggle("done", q.q2_elder_relay.done);
            if (prog) prog.textContent = q.q2_elder_relay.done ? "SENT" : `${q.q2_elder_relay.liters.toFixed(1)}/${q.q2_elder_relay.targetL.toFixed(0)}L`;
          } else if (id === "q3_june_moraine") {
            li.classList.toggle("done", q.q3_june_moraine.done);
            const parts = (q.q3_june_moraine.juneDone ? 1 : 0) + (q.q3_june_moraine.moraineDone ? 1 : 0);
            if (prog) prog.textContent = q.q3_june_moraine.done ? "DONE" : `${parts}/2`;
          }
        });
      }
      if (celebrate) {
        const tr = $("quest-tracker");
        if (tr) {
          tr.classList.add("reward-glow");
          setTimeout(() => tr.classList.remove("reward-glow"), 2800);
        }
        if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playQuestComplete === "function") {
          window.HighlandSoundscape.playQuestComplete();
        } else if (audio && typeof audio.relayChime === "function") {
          audio.relayChime(true);
        }
        state.wifiCharge = 1.0;
        state.focusPulse = 1.0;
      }
    }
    updateQuestUI(false);

    // Attach sleek glowing cyan smartphone props to villagers so they visibly watch videos & share ideas
    const npcPhoneGeo = new T.BoxGeometry(0.072, 0.135, 0.012);
    const npcPhoneBodyMat = new T.MeshStandardMaterial({ color: 0x121922, roughness: 0.45, metalness: 0.4 });
    const npcPhoneScreenGeo = new T.PlaneGeometry(0.062, 0.118);
    const npcPhoneScreenMat = new T.MeshBasicMaterial({ color: 0x28d8f0 });
    function ensureNpcSmartphone(ch) {
      if (!ch || !ch.group || !ch.state) return;
      if (ch.group.userData.livingPhoneAttached) return;
      const cid = String(ch.state.id || "").toLowerCase();
      if (cid === "imani") return;
      const phoneGrp = new T.Group();
      phoneGrp.name = "living_cyan_phone";
      const body = new T.Mesh(npcPhoneGeo, npcPhoneBodyMat);
      const scr = new T.Mesh(npcPhoneScreenGeo, npcPhoneScreenMat);
      scr.position.z = 0.007;
      phoneGrp.add(body, scr);
      phoneGrp.position.set(0.14, 1.12, 0.28);
      phoneGrp.rotation.set(-0.52, -0.22, 0.08);
      ch.group.add(phoneGrp);
      ch.group.userData.livingPhoneAttached = true;
      ch.group.userData.livingPhoneGrp = phoneGrp;
    }
    if (cast && Array.isArray(cast.list)) {
      cast.list.forEach(ensureNpcSmartphone);
    }

    // Fix behind-the-back jerrycan carry (e1b2ff52.jpg & 79fdfab7.jpg): detach EVERY jerrycan mesh from ANY bone and seat strictly at right-side hip / forward of thigh!
    const _hipCanQuat = new T.Quaternion();
    const _hipCanEuler = new T.Euler(0, 0, 0, "YXZ");
    function findCarryCanProps(ch) {
      if (!ch || !ch.group) return [];
      if (Array.isArray(ch.group.userData.frontHipCans) && ch.group.userData.frontHipCans.length > 0) {
        return ch.group.userData.frontHipCans;
      }
      const found = [];
      const isCyanCanGroup = (obj) => {
        if (!obj || !obj.isGroup || obj === ch.group || !obj.children || obj.children.length < 4) return false;
        return obj.children.some(m => {
          const mat = m && m.material;
          if (!mat || !mat.color) return false;
          return mat.color.b > 0.65 && mat.color.g > 0.55 && (mat.transparent || mat.emissiveIntensity > 0.2);
        });
      };
      ch.group.traverse(obj => {
        if (isCyanCanGroup(obj)) found.push(obj);
      });
      for (let i = 0; i < found.length; i++) {
        const c = found[i];
        if (c.parent && c.parent !== ch.group) {
          c.parent.remove(c);
          ch.group.add(c);
        }
      }
      if (found.length > 0) {
        ch.group.userData.frontHipCans = found;
        ch.group.userData.frontHipCan = found[0];
      }
      return found;
    }

    const _armRelaxQuat = new T.Quaternion();
    const _armRelaxEuler = new T.Euler(0, 0, 0, "XYZ");
    function slerpBoneEuler(bone, ex, ey, ez, weight) {
      if (!bone) return;
      _armRelaxEuler.set(ex, ey, ez, "XYZ");
      _armRelaxQuat.setFromEuler(_armRelaxEuler);
      bone.quaternion.slerp(_armRelaxQuat, weight);
    }

    // Natural relaxed arms & hands matching c8a89055.png:
    // - Idle: arms hang naturally down at sides, palms facing inward toward thighs, softly curved fingers, zero twisted wrists/elbows.
    // - Walk: gentle natural counter-swing at sides with soft elbow flex and neutral forearm twist.
    // - Carry: left arm relaxed/swinging at side, right arm cleanly holding jerrycan at right hip when waterLiters > 0.
    function applyNaturalRelaxedArmsAndHands(ch, nowSec, speed, isPlayer, carryingCan, squirtActive) {
      if (!ch || !ch.bones) return;
      const b = ch.bones;
      const st = ch.state || {};
      const pose = String(st.pose || "idle");
      if (pose === "pump" || pose === "heaveSaddle20kg" || pose === "childReceive20kg" || pose === "ride" || pose === "driving" || pose === "dance" || pose === "eskista" || pose === "greeting" || pose === "wave") {
        return;
      }
      if (isPlayer && carrierPhys && carrierPhys.tumbleTimer > 0) return;
      const ud = ch.group && ch.group.userData ? ch.group.userData : null;
      if (ud && ud.cheerTimer > 0) return;

      const phaseSeed = (st.phase || 0) + (isPlayer ? 0 : 1.3);
      const breath = Math.sin(nowSec * 1.85 + phaseSeed) * 0.016;
      const isIdle = speed < 0.25;
      const stride = isIdle ? 0 : Math.sin(nowSec * (speed > 2.4 ? 9.2 : 5.6) + phaseSeed) * clamp(speed / 2.2, 0, 1);

      // Clavicles (9 = L, 15 = R): relaxed level shoulders, never shrugged/twisted
      slerpBoneEuler(b[9], 0.0, 0.0, 0.025 + breath * 0.4, isIdle ? 0.80 : 0.55);
      slerpBoneEuler(b[15], 0.0, 0.0, -0.025 - breath * 0.4, isIdle ? 0.80 : 0.55);

      // Left arm (10 = UARM_L, 12 = FARM_L, 13 = FARM_TWIST_L, 14 = HAND_L)
      if (isIdle) {
        slerpBoneEuler(b[10], 0.04 + breath, 0.0, 0.075, 0.86);
        slerpBoneEuler(b[12], -0.14 - breath * 0.5, 0.0, 0.0, 0.86);
        slerpBoneEuler(b[13], 0.0, 0.0, 0.0, 0.90);
        slerpBoneEuler(b[14], 0.05, 0.0, -0.05, 0.88);
      } else {
        const swingL = stride * 0.26;
        const elbowL = -0.18 - Math.max(0, swingL) * 0.22;
        slerpBoneEuler(b[10], swingL, 0.0, 0.08, 0.62);
        slerpBoneEuler(b[12], elbowL, 0.0, 0.0, 0.65);
        slerpBoneEuler(b[13], 0.0, 0.0, 0.0, 0.85);
        slerpBoneEuler(b[14], 0.05, 0.0, -0.04, 0.82);
      }

      // Right arm (16 = UARM_R, 18 = FARM_R, 19 = FARM_TWIST_R, 20 = HAND_R)
      if (squirtActive && isPlayer) {
        slerpBoneEuler(b[16], -0.64, 0.08, -0.10, 0.82);
        slerpBoneEuler(b[18], -0.46, 0.0, 0.0, 0.82);
        slerpBoneEuler(b[19], 0.0, 0.0, 0.0, 0.88);
        slerpBoneEuler(b[20], 0.04, 0.0, 0.04, 0.84);
      } else if (carryingCan) {
        // Clean right-hip jerrycan carry: arm hangs naturally at right hip without twisting elbow or wrist
        slerpBoneEuler(b[16], -0.10 - stride * 0.09, 0.0, -0.11, 0.86);
        slerpBoneEuler(b[18], -0.14, 0.0, 0.0, 0.84);
        slerpBoneEuler(b[19], 0.0, 0.0, 0.0, 0.90);
        slerpBoneEuler(b[20], 0.05, 0.0, 0.05, 0.86);
      } else if (isIdle) {
        slerpBoneEuler(b[16], 0.04 + breath, 0.0, -0.075, 0.86);
        slerpBoneEuler(b[18], -0.14 - breath * 0.5, 0.0, 0.0, 0.86);
        slerpBoneEuler(b[19], 0.0, 0.0, 0.0, 0.90);
        slerpBoneEuler(b[20], 0.05, 0.0, 0.05, 0.88);
      } else {
        const swingR = -stride * 0.26;
        const elbowR = -0.18 - Math.max(0, swingR) * 0.22;
        slerpBoneEuler(b[16], swingR, 0.0, -0.08, 0.62);
        slerpBoneEuler(b[18], elbowR, 0.0, 0.0, 0.65);
        slerpBoneEuler(b[19], 0.0, 0.0, 0.0, 0.85);
        slerpBoneEuler(b[20], 0.05, 0.0, 0.04, 0.82);
      }

      // Softly curved relaxed fingers (if finger bones are attached under B_HAND_L / B_HAND_R)
      if (!ch.__fingerBones) {
        const fL = [], fR = [];
        if (b[14]) b[14].traverse(o => { if (o !== b[14] && o.isBone) fL.push(o); });
        if (b[20]) b[20].traverse(o => { if (o !== b[20] && o.isBone) fR.push(o); });
        ch.__fingerBones = { fL, fR };
      }
      const curlL = 0.22;
      const curlR = carryingCan ? 0.52 : 0.22;
      for (let i = 0; i < ch.__fingerBones.fL.length; i++) {
        slerpBoneEuler(ch.__fingerBones.fL[i], curlL, 0, -0.04, 0.72);
      }
      for (let i = 0; i < ch.__fingerBones.fR.length; i++) {
        slerpBoneEuler(ch.__fingerBones.fR[i], curlR, 0, 0.04, 0.72);
      }
    }

    function enforceFrontHipJerrycanCarry(ch, nowSec, speed, squirtActive) {
      if (!ch || !ch.group) return;
      const cans = findCarryCanProps(ch);
      const isPlayer = (ch === activeAvatar);
      const shouldShow = isPlayer
        ? (state.waterLiters > 0.1 || squirtActive)
        : Boolean(ch.state && ch.state.carryCan);
      const stride = Math.sin(nowSec * (speed > 2.2 ? 9.5 : 5.4)) * Math.min(1, speed / 2.6);
      for (let i = 0; i < cans.length; i++) {
        const can = cans[i];
        // Only show primary hip jerrycan; hide any secondary duplicate mesh so nothing floats behind back
        const showThis = shouldShow && i === 0;
        can.visible = showThis;
        if (!showThis) continue;
        if (can.parent !== ch.group) {
          if (can.parent) can.parent.remove(can);
          ch.group.add(can);
        }
        if (squirtActive && isPlayer) {
          // Cradled forward in front of torso aiming cyan nozzle straight ahead (+Z forward, -X anatomical right)
          can.position.set(-0.18, 1.08 + Math.sin(nowSec * 14) * 0.008, 0.36);
          can.rotation.set(0.38, 0.06, 0.08);
          if (isPlayer) state.carryCanLocalZ = can.position.z;
        } else {
          // Strictly at right side hip / forward of thigh (+Z = +0.16 in character forward space, upright, never behind back!)
          can.position.set(-0.27, 0.84 + Math.abs(stride) * 0.014, 0.16 + stride * 0.035);
          can.rotation.set(0.04 + stride * 0.06, 0.0, 0.04);
          if (isPlayer) state.carryCanLocalZ = can.position.z;
        }
      }
      applyNaturalRelaxedArmsAndHands(ch, nowSec, speed, isPlayer, shouldShow, squirtActive);
    }

    // 3D Pressurized Cyan WiFi Water Squirt Stream Mesh
    const SQUIRT_SEGS = 22;
    const squirtGroup = new T.Group();
    squirtGroup.visible = false;
    const squirtPts = [];
    for (let i = 0; i <= SQUIRT_SEGS; i++) squirtPts.push(new T.Vector3(0, 0, i * 0.4));
    const squirtGeo = new T.BufferGeometry().setFromPoints(squirtPts);
    const squirtMat = new T.LineBasicMaterial({ color: 0x28d8f0, transparent: true, opacity: 0.94 });
    const squirtLine = new T.Line(squirtGeo, squirtMat);
    squirtLine.frustumCulled = false;
    squirtGroup.add(squirtLine);
    // Volumetric cyan water jet beads along parabolic arc for crisp WebGL visibility
    const squirtBeadGeo = new T.SphereGeometry(0.068, 8, 6);
    const squirtBeadMat = new T.MeshBasicMaterial({ color: 0x28d8f0, transparent: true, opacity: 0.88 });
    const squirtCoreMat = new T.MeshBasicMaterial({ color: 0xc8faff, transparent: true, opacity: 0.95 });
    const squirtBeads = [];
    for (let i = 0; i < 16; i++) {
      const m = new T.Mesh(squirtBeadGeo, i % 3 === 0 ? squirtCoreMat : squirtBeadMat);
      m.frustumCulled = false;
      squirtGroup.add(m);
      squirtBeads.push(m);
    }
    actorRoot.add(squirtGroup);

    const _squirtOrigin = new T.Vector3();
    const _squirtDir = new T.Vector3();
    const _squirtPt = new T.Vector3();
    let _squirtAudioOn = false;
    let _squirtHitCooldown = 0;

    function setSquirtAudio(active) {
      if (active === _squirtAudioOn) return;
      _squirtAudioOn = active;
      if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playWaterSquirt === "function") {
        window.HighlandSoundscape.playWaterSquirt(active);
      } else if (active && window.HighlandSoundscape && typeof window.HighlandSoundscape.playWaterSpill === "function") {
        window.HighlandSoundscape.playWaterSpill(0.45);
      }
    }

    function triggerSquirtBurst(dur = 1.8) {
      state.squirtBurstTimer = Math.max(state.squirtBurstTimer, dur);
      if (state.waterLiters < 0.25) {
        state.waterLiters = 8.0; // auto-prime nozzle reserve from pump/pack
      }
    }

    function stepWaterSquirt(dt, nowSec) {
      if (state.squirtBurstTimer > 0) state.squirtBurstTimer = Math.max(0, state.squirtBurstTimer - dt);
      const wantSquirt = (state.squirtHeld || keys.KeyF || state.squirtBurstTimer > 0) && !state.introActive && !state.bigMapOpen;
      state.squirtActive = wantSquirt;
      const sqBtn = $("btn-squirt-pill");
      if (sqBtn) {
        sqBtn.classList.toggle("squirt-live", wantSquirt);
        sqBtn.setAttribute("aria-pressed", String(wantSquirt));
      }
      squirtGroup.visible = wantSquirt;
      setSquirtAudio(wantSquirt);
      if (_squirtHitCooldown > 0) _squirtHitCooldown = Math.max(0, _squirtHitCooldown - dt);
      if (!wantSquirt) return;

      // Origin at front-right nozzle of player/avatar
      const yaw = (activeAvatar && activeAvatar.group && state.cameraMode === "third" && !state.drivingCart)
        ? (activeAvatar.group.rotation.y)
        : (state.yaw + Math.PI);
      const fwdX = Math.sin(yaw), fwdZ = Math.cos(yaw);
      const rightX = -Math.cos(yaw), rightZ = Math.sin(yaw);
      const baseY = state.drivingCart ? (wagon.y + 1.45) : (state.y - 0.56);
      const baseX = state.drivingCart ? wagon.x : state.x;
      const baseZ = state.drivingCart ? wagon.z : state.z;
      _squirtOrigin.set(baseX + fwdX * 0.48 + rightX * 0.22, baseY, baseZ + fwdZ * 0.48 + rightZ * 0.22);
      _squirtDir.set(fwdX, clamp(0.18 + state.pitch * 0.65, -0.3, 0.58), fwdZ).normalize();

      const speed0 = 11.4;
      const grav = 9.2;
      const posArr = squirtGeo.attributes.position.array;
      let hitEndT = 1.05;
      let impactPt = null;
      let hitTarget = null;

      for (let i = 0; i <= SQUIRT_SEGS; i++) {
        const frac = i / SQUIRT_SEGS;
        const t = frac * hitEndT;
        const px = _squirtOrigin.x + _squirtDir.x * speed0 * t;
        const py = _squirtOrigin.y + _squirtDir.y * speed0 * t - 0.5 * grav * t * t;
        const pz = _squirtOrigin.z + _squirtDir.z * speed0 * t;
        const gy = driveSurfaceAt(px, pz);
        const clampedY = Math.max(gy + 0.06, py);
        posArr[i * 3] = px;
        posArr[i * 3 + 1] = clampedY;
        posArr[i * 3 + 2] = pz;

        if (!hitTarget && i >= 2) {
          // 1) Check Mistletoe hit
          if (Math.hypot(px - donkey.state.x, pz - donkey.state.z) < 1.85 && Math.abs(clampedY - (donkey.group.position.y + 0.9)) < 1.4) {
            hitTarget = { kind: "donkey" };
            impactPt = _squirtPt.set(px, clampedY, pz).clone();
            hitEndT = t;
          }
          // 2) Check Villager NPC hit
          if (!hitTarget && cast && Array.isArray(cast.list)) {
            for (let ci = 0; ci < cast.list.length; ci++) {
              const npc = cast.list[ci];
              if (!npc || !npc.group || !npc.group.visible || npc === activeAvatar) continue;
              const distXZ = Math.hypot(px - npc.group.position.x, pz - npc.group.position.z);
              if (distXZ < 1.45 && Math.abs(clampedY - (npc.group.position.y + 1.0)) < 1.35) {
                hitTarget = { kind: "npc", npc };
                impactPt = _squirtPt.set(px, clampedY, pz).clone();
                hitEndT = t;
                break;
              }
            }
          }
          // 3) Check Cistern / Relay Dish hit
          if (!hitTarget && Array.isArray(relays)) {
            for (let ri = 0; ri < relays.length; ri++) {
              const r = relays[ri];
              if (Math.hypot(px - r.x, pz - r.z) < 4.2) {
                hitTarget = { kind: "relay", relay: r };
                impactPt = _squirtPt.set(px, clampedY, pz).clone();
                hitEndT = t;
                break;
              }
            }
          }
        }
        if (!impactPt && py <= gy + 0.06) {
          impactPt = _squirtPt.set(px, gy + 0.06, pz).clone();
        }
      }
      squirtGeo.attributes.position.needsUpdate = true;

      // Animate streaming cyan beads along parabola
      for (let b = 0; b < squirtBeads.length; b++) {
        const u = ((b / squirtBeads.length) + nowSec * 2.8) % 1.0;
        const t = u * hitEndT;
        const bx = _squirtOrigin.x + _squirtDir.x * speed0 * t + Math.sin(nowSec * 19 + b) * 0.025;
        const by = Math.max(driveSurfaceAt(bx, _squirtOrigin.z + _squirtDir.z * speed0 * t) + 0.06,
          _squirtOrigin.y + _squirtDir.y * speed0 * t - 0.5 * grav * t * t);
        const bz = _squirtOrigin.z + _squirtDir.z * speed0 * t + Math.cos(nowSec * 17 + b) * 0.025;
        squirtBeads[b].position.set(bx, by, bz);
        const sc = 0.65 + u * 0.9;
        squirtBeads[b].scale.setScalar(sc);
      }

      if (impactPt && physParticles && typeof physParticles.spawnSpill === "function" && Math.random() < 0.65) {
        physParticles.spawnSpill(impactPt.x, impactPt.y, impactPt.z, 0, 0, 3);
      }

      // Apply live effects of hitting Mistletoe, Villagers, or Cisterns/Relays!
      if (hitTarget) {
        if (hitTarget.kind === "donkey") {
          donkey.playDrink(2.6);
          state.donkeyWater = clamp(state.donkeyWater + dt * 0.45, 0, 1);
          state.donkeyCollapsed = false;
          donkey.state.collapsed = false;
          donkey.state.downWant = false;
          state.quests.q1_mistletoe.drinkSec += dt;
          if (!state.quests.q1_mistletoe.done && state.quests.q1_mistletoe.drinkSec >= 0.85) {
            state.quests.q1_mistletoe.done = true;
            updateQuestUI(true);
            speakLine("MISTLETOE", "Mistletoe drinks deeply from the cool cyan stream and shakes her ears warmly.", "Quest 1 Complete: Hydrate Mistletoe at the overlook!", 0.92, 1.0);
          } else {
            updateQuestUI(false);
            if (_squirtHitCooldown <= 0) {
              _squirtHitCooldown = 2.4;
              toast("Mistletoe lowers her head to drink the cyan WiFi water! Hydration restored.");
            }
          }
        } else if (hitTarget.kind === "npc") {
          const npc = hitTarget.npc;
          const ud = npc.group.userData || (npc.group.userData = {});
          const name = (npc.state && npc.state.name) || "Villager";
          const cid = String((npc.state && npc.state.id) || "").toLowerCase();
          ud.cheerTimer = 3.2;
          ud.talkTimer = 3.6;
          if (npc.state) npc.state.speaking = true;
          state.wifiCharge = clamp(state.wifiCharge + dt * 0.35, 0, 1);
          state.coveragePct = Math.min(100, (state.coveragePct || 34) + Math.round(dt * 12));
          if (cid === "june" && !state.quests.q3_june_moraine.juneDone) {
            state.quests.q3_june_moraine.juneDone = true;
            if (state.quests.q3_june_moraine.moraineDone) state.quests.q3_june_moraine.done = true;
            updateQuestUI(state.quests.q3_june_moraine.done);
          }
          if (_squirtHitCooldown <= 0) {
            _squirtHitCooldown = 2.8;
            const lines = [
              `Thank you! My phone just jumped to full cyan bars — uploading the Addis video now!`,
              `Cool water and live signal! Sharing our night dispatch to the ridge right now!`,
              `Refreshing! The Ahiya Area Network just lit up on my screen!`
            ];
            const line = lines[Math.floor(Math.random() * lines.length)];
            speakLine(name.toUpperCase(), line, `WiFi Boosted + Upload Active (${Math.round(state.wifiCharge * 100)}%)`, 1.08, 1.04);
            if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playWaterDeliver === "function") {
              window.HighlandSoundscape.playWaterDeliver();
            }
          }
        } else if (hitTarget.kind === "relay") {
          const r = hitTarget.relay;
          const addL = dt * 3.8;
          state.worldWaterDeliveredL += addL;
          state.wifiCharge = clamp(state.wifiCharge + dt * 0.4, 0, 1);
          if (!r.lit) {
            r.lit = true;
            state.litRelays = relays.filter(x => x.lit).length;
            if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playWaterDeliver === "function") {
              window.HighlandSoundscape.playWaterDeliver();
            }
          }
          if (Array.isArray(r.cans)) {
            for (const c of r.cans) {
              if (c && c.userData && typeof c.userData.setFill === "function") {
                c.userData.fill = clamp((c.userData.fill || 0) + dt * 0.85, 0, 1);
                c.userData.setFill(c.userData.fill);
              }
            }
          }
          // Quest 2: Boost Elder's relay dish with 5L cyan water
          if (!state.quests.q2_elder_relay.done) {
            state.quests.q2_elder_relay.liters = Math.min(state.quests.q2_elder_relay.targetL, state.quests.q2_elder_relay.liters + addL);
            if (state.quests.q2_elder_relay.liters >= state.quests.q2_elder_relay.targetL) {
              state.quests.q2_elder_relay.done = true;
              updateQuestUI(true);
              speakLine("ELDER BEKELE", "Five liters of living cyan water! The relay dish is locked — Addis video transmission sent!", "Quest 2 Complete: Relay Dish Boosted (5.0 L)!", 0.86, 0.98);
            } else {
              updateQuestUI(false);
            }
          }
          // Quest 3: Moraine Switchback Cistern
          if (r.id === "switchback" && !state.quests.q3_june_moraine.moraineDone) {
            state.quests.q3_june_moraine.moraineDone = true;
            if (state.quests.q3_june_moraine.juneDone) state.quests.q3_june_moraine.done = true;
            updateQuestUI(state.quests.q3_june_moraine.done);
            toast("Moraine Switchback Cistern filled with cyan WiFi water!");
          }
          if (_squirtHitCooldown <= 0) {
            _squirtHitCooldown = 2.6;
            toast(`Pressurized cyan water filling ${r.name} — WiFi broadcast boosted!`);
          }
        }
      }
    }

    // Wire SQUIRT (F) button for hold OR quick click burst
    if ($("btn-squirt-pill")) {
      const sqBtn = $("btn-squirt-pill");
      sqBtn.addEventListener("pointerdown", e => {
        e.preventDefault();
        state.squirtHeld = true;
        triggerSquirtBurst(1.6);
      });
      const releaseSquirt = () => { state.squirtHeld = false; };
      sqBtn.addEventListener("pointerup", releaseSquirt);
      sqBtn.addEventListener("pointerleave", releaseSquirt);
      sqBtn.addEventListener("pointercancel", releaseSquirt);
    }

    /* ---------- Autonomous Multi-Waypoint NPC Jobs & Interactive Dialogue ---------- */
    const NPC_JOB_SPECS = {
      makeda: {
        displayName: "Makeda",
        jobTitle: "Wellhead Pump Operator",
        pitch: 1.12,
        questId: "q1_mistletoe",
        greeting: "I am running the standpipe and keeping the terracotta basin topped off for every carrier on the ridge.",
        questLine: "Quest 1: Keep Mistletoe hydrated at the overlook wellhead and refill her 20L saddle cans.",
        waypoints: [
          { label: "Standpipe Pump", x: () => well.x - 1.15, z: () => well.z + 0.15, lookX: () => well.x, lookZ: () => well.z, dur: 6.5, workPose: "pump", status: () => `Pumping cyan water at the cast-iron standpipe (Well ${npWorld && npWorld.places && npWorld.places.overlook ? npWorld.places.overlook.well : 32}/40 L)` },
          { label: "Terracotta Basin", x: () => well.x + 1.55, z: () => well.z + 2.45, lookX: () => well.x + 1.75, lookZ: () => well.z + 1.75, dur: 5.0, workPose: "idle", carryCan: true, status: () => "Checking well level and refilling terracotta basin jugs" },
          { label: "Jerrycan Pad", x: () => well.x - 1.9, z: () => well.z - 1.6, lookX: () => well.x, lookZ: () => well.z, dur: 4.5, workPose: "idle", carryCan: true, status: () => "Chalk-marking 20L jerrycans on the wellhead pad" }
        ]
      },
      june: {
        displayName: "June",
        jobTitle: "Signal Scout & Relay Runner",
        pitch: 1.24,
        questId: "q3_june_moraine",
        greeting: "Imani! My smartphone bars climb every time fresh cyan water flows through the overlook. Help me light up Moraine Cistern!",
        questLine: "Quest 3: Splash cyan water on June's phone and fill Moraine Switchback Cistern.",
        waypoints: [
          { label: "Overlook Screen", x: () => -18.4, z: () => -1.6, lookX: () => -22.2, lookZ: () => -6.2, dur: 5.5, workPose: "idle-talking", phoneOut: true, status: () => `Checking WiFi bars on her smartphone at the overlook (${Math.round(state.coveragePct || 34)}% signal)` },
          { label: "Wellhead Relay", x: () => well.x + 3.0, z: () => well.z - 1.8, lookX: () => well.x, lookZ: () => well.z, dur: 5.0, workPose: "idle", phoneOut: true, status: () => `Logging live WiFi coverage at the wellhead (${Math.round(state.wifiCharge * 100)}% charge)` },
          { label: "Relay Dish Rim", x: () => -15.6, z: () => -7.2, lookX: () => -48, lookZ: () => -168, dur: 5.5, workPose: "idle-talking", phoneOut: true, status: () => "Relaying live signal telemetry toward Moraine Switchback" }
        ]
      },
      ferry_bekele: {
        displayName: "Elder Bekele",
        jobTitle: "Archivist & Projectionist",
        pitch: 0.84,
        questId: "q2_elder_relay",
        greeting: "The outdoor 35mm linen screen and ridge ledger are set. Bring five liters of cyan water to lock the Addis relay.",
        questLine: "Quest 2: Boost Elder Bekele's relay dish with 5.0 L of living cyan water.",
        waypoints: [
          { label: "35mm Cinema Screen", x: () => -18.2, z: () => 4.2, lookX: () => -22.0, lookZ: () => 5.5, dur: 6.0, workPose: "idle", status: () => "Tending the outdoor 35mm linen cinema screen and focus frame" },
          { label: "Ledger Table", x: () => -16.4, z: () => 0.8, lookX: () => well.x, lookZ: () => well.z, dur: 5.5, workPose: "idle-talking", status: () => `Inspecting incoming water deliveries (${state.worldWaterDeliveredL.toFixed(1)} L logged)` },
          { label: "Ridge Dispatch", x: () => -13.4, z: () => -3.6, lookX: () => -248, lookZ: () => -55, dur: 5.0, workPose: "idle", status: () => "Charting ridge dispatch routes across Silver Ford and Oxbow" }
        ]
      },
      ppc_op_female: {
        displayName: "Hanna",
        jobTitle: "Donkey Handler & Mechanic",
        pitch: 1.06,
        questId: "q1_mistletoe",
        greeting: "I am splitting shifts between Mistletoe's sawbuck harness and the Cruiser Woody suspension. Let me know if she needs water.",
        questLine: "Quest 1: Keep Mistletoe hydrated (100%) and the Cruiser Woody chassis road-ready.",
        waypoints: [
          { label: "Mistletoe Harness", x: () => donkey.state.x + 2.0, z: () => donkey.state.z + 1.1, lookX: () => donkey.state.x, lookZ: () => donkey.state.z, dur: 5.5, workPose: "idle", taskFn: (dt) => { if (state.donkeyWater < 0.72) state.donkeyWater = clamp(state.donkeyWater + dt * 0.04, 0, 1); }, status: () => `Checking Mistletoe's sawbuck straps and hydration (${Math.round(clamp(state.donkeyWater, 0, 1) * 100)}%)` },
          { label: "Wagon Engine Bay", x: () => wagon.x + 2.3, z: () => wagon.z - 0.8, lookX: () => wagon.x, lookZ: () => wagon.z, dur: 5.5, workPose: "idle", taskFn: (dt) => { if (vehPhys && vehPhys.integrity < 98) vehPhys.integrity = Math.min(100, vehPhys.integrity + dt * 2.5); }, status: () => `Inspecting and repairing Cruiser Woody chassis (${vehPhys ? Math.round(vehPhys.integrity) : 100}%)` },
          { label: "Wagon Tailgate", x: () => wagon.x - 1.9, z: () => wagon.z + 1.8, lookX: () => wagon.x, lookZ: () => wagon.z, dur: 4.5, workPose: "idle", status: () => "Checking spare jerrycan tie-downs on the cruiser wagon" }
        ]
      },
      rahel: {
        displayName: "Rahel",
        jobTitle: "Route Dispatcher",
        pitch: 1.09,
        questId: "q3_june_moraine",
        greeting: "I am patrolling between the wagon and the trailhead checking cargo weight, wind gusts, and departure windows.",
        questLine: "Quest 3: Coordinate night-route cargo runs to Moraine Cistern and Ahiya.",
        waypoints: [
          { label: "Wagon Cargo Check", x: () => wagon.x + 2.7, z: () => wagon.z + 2.1, lookX: () => wagon.x, lookZ: () => wagon.z, dur: 5.0, workPose: "idle-talking", phoneOut: true, status: () => `Monitoring wagon cargo weight (${state.waterLiters.toFixed(1)} kg) and slosh balance` },
          { label: "Overlook Trailhead", x: () => -27.8, z: () => 3.8, lookX: () => -48, lookZ: () => -168, dur: 5.5, workPose: "idle", phoneOut: true, status: () => `Patrolling trailhead and monitoring ridge wind (${Math.round(state.wind01 * 100)}%)` },
          { label: "North Rim Marker", x: () => -25.8, z: () => -6.8, lookX: () => well.x, lookZ: () => well.z, dur: 5.0, workPose: "idle-talking", phoneOut: true, status: () => "Clearing carrier departure timing at the overlook trailhead" }
        ]
      }
    };

    function initNpcJobs() {
      if (!cast || !Array.isArray(cast.list)) return;
      for (let i = 0; i < cast.list.length; i++) {
        const ch = cast.list[i];
        if (!ch || !ch.group || !ch.state) continue;
        const cid = String(ch.state.id || `cast_${i}`).toLowerCase();
        // the Ahiya demo's people keep their sets (pump, white wall, archive, yard); job routes are for the open game
        if (urlParams.get("demo") === "ahiya" && ch.state.circuit === "ahiya") continue;
        const ud = ch.group.userData || (ch.group.userData = {});
        const spec = NPC_JOB_SPECS[cid];
        if (spec) {
          const wp0 = spec.waypoints[0];
          const x0 = typeof wp0.x === "function" ? wp0.x() : wp0.x;
          const z0 = typeof wp0.z === "function" ? wp0.z() : wp0.z;
          const y0 = driveSurfaceAt(x0, z0);
          ch.group.visible = true;
          ch.group.position.set(x0, y0, z0);
          ch.state.x = x0;
          ch.state.y = y0;
          ch.state.z = z0;
          ch.state.name = spec.displayName;
          ch.state.displayName = spec.displayName;
          ch.state.role = spec.jobTitle;
          ud.npcJob = {
            id: cid,
            displayName: spec.displayName,
            jobTitle: spec.jobTitle,
            spec,
            wpIdx: 0,
            mode: "work",
            timer: 2.2 + (i % 4) * 1.1,
            x: x0,
            z: z0,
            heading: ch.state.heading || 0,
            speed: 0,
            boostTimer: 0,
            currentStatus: `On duty at ${wp0.label} (${spec.jobTitle})`,
            currentStation: wp0.label
          };
        } else if (cid !== "imani") {
          const homeX = ch.state.x || ch.group.position.x;
          const homeZ = ch.state.z || ch.group.position.z;
          const role = ch.state.role || "Station Crew";
          ud.npcJob = {
            id: cid,
            displayName: ch.state.displayName || ch.state.name || "Crew Member",
            jobTitle: role,
            spec: null,
            wpIdx: 0,
            mode: "work",
            timer: 3.5 + (i % 5),
            homeX,
            homeZ,
            x: homeX,
            z: homeZ,
            heading: ch.state.heading || 0,
            speed: 0,
            boostTimer: 0,
            currentStatus: `On duty: ${role}`,
            currentStation: "Station Post"
          };
        }
      }
    }
    initNpcJobs();

    function updateNpcJobs(dt, nowSec) {
      if (!cast || !Array.isArray(cast.list)) return;
      if (machinima && machinima.isActive()) return;
      for (let i = 0; i < cast.list.length; i++) {
        const ch = cast.list[i];
        if (!ch || !ch.group || !ch.state || ch === activeAvatar) continue;
        const ud = ch.group.userData;
        const job = ud && ud.npcJob;
        if (!job || !job.spec) continue;
        if (ud.knockdown && ud.knockdown.active) continue;
        ch.group.visible = true;

        if (job.boostTimer > 0) job.boostTimer = Math.max(0, job.boostTimer - dt);
        const speedMult = job.boostTimer > 0 ? 1.35 : 1.0;

        // Pause autonomous walking while actively conversing with the player
        const isTalking = (ud.talkTimer > 0) || (state.activeDialogueTarget && state.activeDialogueTarget.npc === ch);
        if (isTalking) {
          const aim = Math.atan2(state.x - job.x, state.z - job.z);
          const dh = Math.atan2(Math.sin(aim - job.heading), Math.cos(aim - job.heading));
          job.heading += clamp(dh, -5.0 * dt, 5.0 * dt);
          job.speed = 0;
          const gy = driveSurfaceAt(job.x, job.z);
          ch.group.position.set(job.x, gy, job.z);
          ch.group.rotation.y = job.heading;
          ch.state.x = job.x; ch.state.y = gy; ch.state.z = job.z;
          ch.state.heading = job.heading;
          ch.state.speed = 0;
          ch.state.pose = "talk";
          ch.state.speaking = true;
          continue;
        }

        const wps = job.spec.waypoints;
        const wp = wps[job.wpIdx % wps.length];
        const tx = typeof wp.x === "function" ? wp.x() : wp.x;
        const tz = typeof wp.z === "function" ? wp.z() : wp.z;
        const dx = tx - job.x, dz = tz - job.z;
        const dist = Math.hypot(dx, dz);

        if (job.mode === "walk" || dist > 0.65) {
          job.mode = "walk";
          const walkSpd = 1.38 * speedMult;
          const step = Math.min(dist, walkSpd * dt);
          if (dist > 0.01) {
            job.x += (dx / dist) * step;
            job.z += (dz / dist) * step;
            const aim = Math.atan2(dx, dz);
            const dh = Math.atan2(Math.sin(aim - job.heading), Math.cos(aim - job.heading));
            job.heading += clamp(dh, -4.6 * dt, 4.6 * dt);
          }
          job.speed = dist > 0.25 ? walkSpd : 0;
          job.currentStation = wp.label;
          job.currentStatus = `Walking to ${wp.label} (${job.jobTitle})`;
          ch.state.pose = "walk";
          ch.state.carryCan = Boolean(wp.carryCan);
          if (dist <= 0.55) {
            job.mode = "work";
            job.timer = (wp.dur || 5.0) / speedMult;
            job.speed = 0;
          }
        } else {
          job.speed = 0;
          job.timer -= dt;
          const lx = typeof wp.lookX === "function" ? wp.lookX() : wp.lookX;
          const lz = typeof wp.lookZ === "function" ? wp.lookZ() : wp.lookZ;
          const aim = Math.atan2(lx - job.x, lz - job.z);
          const dh = Math.atan2(Math.sin(aim - job.heading), Math.cos(aim - job.heading));
          job.heading += clamp(dh, -4.2 * dt, 4.2 * dt);
          ch.state.pose = wp.workPose || "idle";
          ch.state.carryCan = Boolean(wp.carryCan);
          job.currentStation = wp.label;
          job.currentStatus = typeof wp.status === "function" ? wp.status() : wp.status;
          if (typeof wp.taskFn === "function") wp.taskFn(dt, nowSec);
          if (wp.workPose === "pump" && well && well.leverPivot) {
            well.leverPivot.rotation.z = Math.sin(nowSec * 3.8) * 0.36;
          }
          if (job.timer <= 0) {
            job.wpIdx = (job.wpIdx + 1) % wps.length;
            job.mode = "walk";
          }
        }

        const gy = driveSurfaceAt(job.x, job.z);
        ch.group.position.set(job.x, gy, job.z);
        ch.group.rotation.y = job.heading;
        ch.state.x = job.x; ch.state.y = gy; ch.state.z = job.z;
        ch.state.heading = job.heading;
        ch.state.speed = job.speed;
      }
    }

    // Talk & Interactive Dialogue (E key / Context Button / Direct 3D Click)
    const NPC_DIALOGUES = {
      june: {
        line: "Imani! My phone signal is flickering. Splash a little cyan water on my screen and help fill Moraine Cistern!",
        quest: "Quest 3: Bring water to June's phone & Moraine Cistern",
        pitch: 1.24
      },
      makeda: {
        line: "The cast-iron standpipe is pulling clear cyan water. Keep the basin full and Mistletoe hydrated!",
        quest: "Quest 1: Hydrate Mistletoe at the overlook wellhead",
        pitch: 1.12
      },
      ferry_bekele: {
        line: "The overlook relay dish needs five liters of fresh cyan water before the Addis video can upload cleanly.",
        quest: "Quest 2: Boost Elder's relay dish with 5L cyan water",
        pitch: 0.84
      },
      ppc_op_female: {
        line: "Telemetry shows strong cyan rain inside the ridge dome. I am checking Mistletoe's straps and the cruiser wagon chassis.",
        quest: "Quest 1: Hydrate Mistletoe & keep the wagon tuned",
        pitch: 1.06
      },
      rahel: {
        line: "Cargo weight and ridge wind look steady. Keep the 20L saddle cans topped off before heading down the trailhead.",
        quest: "Quest 3: Deliver water along the night route to Moraine Cistern",
        pitch: 1.09
      },
      imani: {
        line: "Mistletoe is ready by the pump. Let us carry cyan water up to the cisterns and share the signal.",
        quest: "Active Expedition: Western Basin & Ahiya Highlands",
        pitch: 1.08
      }
    };

    function openDialogue(target) {
      if (DEMO) {                                                          // the demo has its own conversation: tap a person to talk to them
        if (target && target.kind === "npc" && target.npc && typeof demoFocus === "function") demoFocus(target.npc);
        return { speaker: target ? target.name : "", kind: "demo" };
      }
      if (!target) {
        speakLine("NIGHT POST DISPATCH", "Walk near Makeda, June, Elder Bekele, Hanna, Rahel, or Mistletoe and press TALK (E), or click them directly in 3D!", "3 Active World Quests in tracker", 1.0, 1.02, "", false);
        return { speaker: "DISPATCH", kind: "hint" };
      }
      state.activeDialogueTarget = target;
      if (target.kind === "donkey") {
        const dw = getDonkeyWorldPos(_donkeyWorldTmp);
        const aim = Math.atan2(state.x - dw.x, state.z - dw.z);
        donkey.state.heading = aim;
        donkey.group.rotation.y = aim;
        if (typeof donkey.soothe === "function") donkey.soothe();
        if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playDonkeyCall === "function") {
          window.HighlandSoundscape.playDonkeyCall({ x: dw.x, y: dw.y + 1.1, z: dw.z });
        }
        const hPct = Math.round(clamp(state.donkeyWater, 0, 1) * 100);
        const jobLine = `JOB: EXPEDITION DONKEY · ${target.jobStatus}`;
        speakLine(
          "MISTLETOE (EXPEDITION DONKEY)",
          hPct < 60
            ? "Mistletoe lowers her ears and nudges your empty canteen — she needs cool cyan water soon."
            : "Mistletoe nudges your shoulder warmly, ears perked and 20L sawbuck saddle steady.",
          `Hydration ${hPct}% · Quest 1: Hydrate Mistletoe at the overlook`,
          0.90, 1.0, jobLine, true
        );
        return { speaker: "MISTLETOE", kind: "donkey" };
      }

      const npc = target.npc;
      const wp = getNpcWorldPos(npc, _npcWorldTmp) || npc.group.position;
      const aim = Math.atan2(state.x - wp.x, state.z - wp.z);
      npc.group.rotation.y = aim;
      if (npc.state) {
        npc.state.heading = aim;
        npc.state.speaking = true;
      }
      const ud = npc.group.userData || (npc.group.userData = {});
      ud.talkTimer = 8.0;
      const info = getNpcDisplayInfo(npc);
      const spec = NPC_JOB_SPECS[info.cid];
      const entry = NPC_DIALOGUES[info.cid] || {
        line: (spec && spec.greeting) || `${info.name} looks up from duty: "Bring us cyan water and help boost the relay dish to Addis!"`,
        quest: (spec && spec.questLine) || "World Quests: Hydrate Mistletoe · Boost Relay (5L) · June & Moraine",
        pitch: (spec && spec.pitch) || 1.02
      };
      const jobLine = `JOB: ${info.jobTitle.toUpperCase()} · ${info.jobStatus}`;
      speakLine(`${info.name.toUpperCase()} (${info.jobTitle.toUpperCase()})`, entry.line, entry.quest, entry.pitch, 1.02, jobLine, true);
      return { speaker: info.name, id: info.cid, jobTitle: info.jobTitle, kind: "npc" };
    }

    function handleDialogueAction(action) {
      const target = state.activeDialogueTarget;
      if (!target) { closeDialogue(); return; }
      if (action === "close") { closeDialogue(); return; }

      if (target.kind === "donkey") {
        if (action === "job") {
          const hPct = Math.round(clamp(state.donkeyWater, 0, 1) * 100);
          speakLine("MISTLETOE (EXPEDITION DONKEY)",
            `Mistletoe carries the 20L cyan jerrycans and WiFi relay pack across the ridge. Current hydration is ${hPct}%.`,
            "Click GIVE WATER (5L) to hydrate her immediately", 0.90, 1.0,
            `JOB: EXPEDITION DONKEY · Carrying 20L pack (${hPct}% hydrated)`, true);
        } else if (action === "water") {
          donkey.playDrink(2.8);
          state.donkeyWater = 1.0;
          state.donkeyCollapsed = false;
          donkey.state.collapsed = false;
          donkey.state.downWant = false;
          state.waterLiters = Math.max(0, state.waterLiters - 5.0);
          state.quests.q1_mistletoe.drinkSec = Math.max(1.0, state.quests.q1_mistletoe.drinkSec + 1.0);
          if (!state.quests.q1_mistletoe.done) {
            state.quests.q1_mistletoe.done = true;
            updateQuestUI(true);
          }
          speakLine("MISTLETOE (EXPEDITION DONKEY)",
            "Mistletoe drinks deeply from the 5L cyan pour and shakes her ears warmly! Hydration 100%.",
            "Quest 1 Complete: Mistletoe hydrated (100%)", 0.92, 1.0,
            "JOB: EXPEDITION DONKEY · Fully hydrated and energized!", true);
        } else if (action === "quest") {
          const done = state.quests.q1_mistletoe.done;
          updateQuestUI(false);
          speakLine("MISTLETOE (EXPEDITION DONKEY)",
            done ? "Quest 1 is complete! Mistletoe is hydrated and ready to climb to Moraine Switchback."
                 : "Quest 1 Active: Give Mistletoe 5L of cyan water right here at the overlook.",
            done ? "Quest 1: DONE" : "Quest 1: Hydrate Mistletoe at overlook", 0.90, 1.0,
            "JOB: EXPEDITION DONKEY · Ready for ridge dispatch", true);
        }
        return;
      }

      const npc = target.npc;
      const info = getNpcDisplayInfo(npc);
      const ud = npc.group.userData || (npc.group.userData = {});
      ud.talkTimer = 8.0;
      if (npc.state) npc.state.speaking = true;
      const spec = NPC_JOB_SPECS[info.cid];
      const pitch = (spec && spec.pitch) || 1.04;

      if (action === "job") {
        const jobDesc = `Right now I am ${info.jobStatus.charAt(0).toLowerCase() + info.jobStatus.slice(1)}.`;
        speakLine(`${info.name.toUpperCase()} (${info.jobTitle.toUpperCase()})`,
          jobDesc,
          `Active station: ${(info.job && info.job.currentStation) || "Overlook Hub"}`,
          pitch, 1.02, `JOB: ${info.jobTitle.toUpperCase()} · ${info.jobStatus}`, true);
      } else if (action === "water") {
        if (state.waterLiters < 5.0) {
          state.waterLiters = 10.0; // draw from wellhead reserve so interaction always succeeds smoothly
        }
        state.waterLiters = Math.max(0, state.waterLiters - 5.0);
        state.worldWaterDeliveredL += 5.0;
        state.wifiCharge = clamp(state.wifiCharge + 0.25, 0, 1);
        state.coveragePct = Math.min(100, (state.coveragePct || 34) + 12);
        ud.cheerTimer = 3.2;
        if (info.job) info.job.boostTimer = 25.0;
        if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playWaterDeliver === "function") {
          window.HighlandSoundscape.playWaterDeliver();
        }
        let rewardSub = `Job Boosted + WiFi ${Math.round(state.wifiCharge * 100)}%`;
        if (info.cid === "ferry_bekele" && !state.quests.q2_elder_relay.done) {
          state.quests.q2_elder_relay.liters = state.quests.q2_elder_relay.targetL;
          state.quests.q2_elder_relay.done = true;
          updateQuestUI(true);
          rewardSub = "Quest 2 Complete: Elder's Relay Dish Boosted (5.0 L)!";
        } else if (info.cid === "june" && !state.quests.q3_june_moraine.juneDone) {
          state.quests.q3_june_moraine.juneDone = true;
          if (state.quests.q3_june_moraine.moraineDone) state.quests.q3_june_moraine.done = true;
          updateQuestUI(state.quests.q3_june_moraine.done);
          rewardSub = state.quests.q3_june_moraine.done ? "Quest 3 Complete!" : "Quest 3 Progress: June's phone boosted (1/2)!";
        } else if (info.cid === "ppc_op_female") {
          state.donkeyWater = 1.0;
          if (vehPhys) vehPhys.integrity = 100;
          rewardSub = "Mistletoe hydrated (100%) & Wagon chassis tuned (100%)!";
        }
        speakLine(`${info.name.toUpperCase()} (${info.jobTitle.toUpperCase()})`,
          `Thank you for the 5 liters of living cyan water! That boosts my station and jumps our WiFi signal to ${Math.round(state.coveragePct)}%!`,
          rewardSub, pitch, 1.04, `JOB: ${info.jobTitle.toUpperCase()} · Boosted`, true);
      } else if (action === "quest") {
        let qText = (spec && spec.questLine) || "Keep Mistletoe hydrated, boost Elder Bekele's relay with 5L, and reach Moraine Cistern.";
        let qSub = "World Quests Tracker updated";
        if (info.cid === "ferry_bekele") {
          qSub = state.quests.q2_elder_relay.done ? "Quest 2: COMPLETE" : `Quest 2: ${state.quests.q2_elder_relay.liters.toFixed(1)}/5.0 L delivered`;
        } else if (info.cid === "june" || info.cid === "rahel") {
          const parts = (state.quests.q3_june_moraine.juneDone ? 1 : 0) + (state.quests.q3_june_moraine.moraineDone ? 1 : 0);
          qSub = state.quests.q3_june_moraine.done ? "Quest 3: COMPLETE" : `Quest 3: ${parts}/2 steps done`;
        } else {
          qSub = state.quests.q1_mistletoe.done ? "Quest 1: COMPLETE" : "Quest 1: Hydrate Mistletoe at the overlook";
        }
        updateQuestUI(false);
        speakLine(`${info.name.toUpperCase()} (${info.jobTitle.toUpperCase()})`, qText, qSub, pitch, 1.02,
          `JOB: ${info.jobTitle.toUpperCase()} · ${info.jobStatus}`, true);
      }
    }

    if ($("dlg-btn-job")) $("dlg-btn-job").addEventListener("click", () => handleDialogueAction("job"));
    if ($("dlg-btn-water")) $("dlg-btn-water").addEventListener("click", () => handleDialogueAction("water"));
    if ($("dlg-btn-quest")) $("dlg-btn-quest").addEventListener("click", () => handleDialogueAction("quest"));
    if ($("dlg-btn-close")) $("dlg-btn-close").addEventListener("click", () => handleDialogueAction("close"));

    function interactTalk() {
      const target = findNearestInteractable(NPC_INTERACT_RADIUS);
      return openDialogue(target);
    }
    if ($("btn-talk-pill")) $("btn-talk-pill").addEventListener("click", () => interactTalk());

    // NPC Bump / Knockdown Reaction (sprinting player, wagon, or thrown jerrycan)
    const BUMP_LINES = [
      "Watch it!",
      "Careful with the water!",
      "Whoa, steady that jerrycan!",
      "Hey, watch the ridge footing!"
    ];
    function bumpNpc(npc, dirX, dirZ, force) {
      if (!NP_PHYS || typeof NP_PHYS.triggerNpcKnockdown !== "function") return false;
      const ok = NP_PHYS.triggerNpcKnockdown(npc, dirX, dirZ, force);
      if (!ok) return false;
      state.npcBumpCount++;
      const name = (npc.state && npc.state.name) || "Villager";
      const line = BUMP_LINES[state.npcBumpCount % BUMP_LINES.length];
      if (npc.state) npc.state.speaking = true;
      if (npc.group.userData) npc.group.userData.talkTimer = 2.6;
      if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playRagdollThud === "function") {
        window.HighlandSoundscape.playRagdollThud(clamp(force / 9, 0.35, 1.0));
      }
      speakLine(name.toUpperCase(), line, "Stumbled! Recovering balance...", 1.15, 1.12);
      return true;
    }

    // Frustum helpers for Frustum-Aware Rain & Spatial Audio Focus
    const camFrustum = new T.Frustum();
    const camProjScreen = new T.Matrix4();
    const _frustPt = new T.Vector3();
    if ($("big-map-close")) $("big-map-close").addEventListener("click", () => setBigMapOpen(false));
    if ($("big-map-canvas")) {
      const mapEl = $("big-map-canvas");
      mapEl.addEventListener("pointermove", e => {
        const rect = mapEl.getBoundingClientRect();
        const u = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        const v = clamp((e.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
        const wx = bigMapCenter.x + (u - 0.5) * BIG_MAP_SPAN_X;
        const wz = bigMapCenter.z + (v - 0.5) * BIG_MAP_SPAN_Z;
        const elev = groundAt(wx, wz);
        const dist = Math.hypot(wx - state.x, wz - state.z);
        if ($("big-map-readout")) {
          $("big-map-readout").textContent = `TARGET (${Math.round(wx)}, ${Math.round(wz)}) · DIST ${Math.round(dist)} m · ELEV ${Math.round(elev)} m · CLICK TO TRAVEL`;
        }
      });
      mapEl.addEventListener("click", e => {
        const rect = mapEl.getBoundingClientRect();
        const u = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        const v = clamp((e.clientY - rect.top) / Math.max(1, rect.height), 0, 1);
        const wx = bigMapCenter.x + (u - 0.5) * BIG_MAP_SPAN_X;
        const wz = bigMapCenter.z + (v - 0.5) * BIG_MAP_SPAN_Z;
        teleportToWorld(wx, wz, `(${Math.round(wx)}, ${Math.round(wz)})`);
        setBigMapOpen(false);
      });
    }
    let machinima = null;
    captureInitialFilmStripAtlas();

    /* ---------- Step Wedge & HUD ---------- */
    const wedgeEl = $("step-wedge");
    ZONES.forEach(Z => {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "swatch";
      btn.style.background = Z.swatch; btn.style.color = Z.z < 5 ? "#f1eee6" : "#141512";
      btn.textContent = ROMAN[Z.z];
      btn.title = `Zone ${ROMAN[Z.z]} · ${Z.name} (${LOOKS[Z.look].name}) — Click focuses, double-click travels`;
      let clickTimer = null;
      btn.addEventListener("click", ev => {
        if (ev.shiftKey) { teleportZone(Z.z); return; }
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          const d = clamp(Math.hypot(Z.x - camera.position.x, Z.pz - camera.position.z), 1.4, 900);
          state.focusDist = d; state.focusLook = Z.look; state.focusPulse = 1.0; updateHUD();
          toast(`Focus racked to Zone ${ROMAN[Z.z]} · ${Z.name} (${d.toFixed(1)} m)`);
        }, 170);
      });
      btn.addEventListener("dblclick", () => { clearTimeout(clickTimer); teleportZone(Z.z); });
      wedgeEl.appendChild(btn);
    });

    let fieldNotice = "", fieldNoticeUntil = 0;
    function toast(msg, shortMessage = msg) {
      if (state.introActive) return;
      if (useFieldLayout()) {
        fieldNotice = shortMessage;
        fieldNoticeUntil = performance.now() + 3400;
        updateFieldNotice();
        return;
      }
      const t = $("toast"); t.textContent = msg; t.hidden = false;
      clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 3400);
    }
    const formatMMSS = sec => { const s = Math.max(0, Math.floor(sec)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
    const fmtElev = v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}m`;

    function updateFocusKnobVisual() {
      const k = clamp((Math.log(state.focusDist) - Math.log(1.2)) / (Math.log(900) - Math.log(1.2)), 0, 1);
      $("focus-knob").style.setProperty("--ang", lerp(-140, 140, k).toFixed(1) + "deg");
      $("focus-knob").setAttribute("aria-valuenow", state.focusDist.toFixed(1));
    }

    function drawRadioViz(bands12, beatPulse) {
      const cv = $("radio-viz");
      if (!cv) return;
      const g = cv.getContext("2d");
      const w = cv.width, h = cv.height;
      g.clearRect(0, 0, w, h);
      g.fillStyle = "rgba(6, 12, 18, 0.9)";
      g.fillRect(0, 0, w, h);
      const bw = Math.floor((w - 14) / 12);
      for (let i = 0; i < 12; i++) {
        const v = clamp(bands12[i] || .06, .06, 1.0);
        const bh = Math.max(2, Math.round(v * (h - 4)));
        g.fillStyle = i < 4 ? "#1c96c5" : "#4de6dc";
        g.fillRect(2 + i * (bw + 1), h - 2 - bh, bw, bh);
      }
    }

    function activeEpochInfo(curT, nowSec) {
      const t = audioEl.paused && audioEl.currentTime === 0 ? ((nowSec * 11) % 280) : curT;
      let idx = SONG_EPOCHS.findIndex(e => t >= e.t0 && t < e.t1);
      if (idx < 0) idx = 0;
      return { idx, ep: SONG_EPOCHS[idx], trackTime: t };
    }

    function updateDesktopHUD(m, fl, Z) {
      const activeLook = state.soloLook >= 0 ? LOOKS[state.soloLook] : LOOKS[state.focusLook];
      const rTag = state.region === "ridge" ? "YOSEMITE HALF DOME" : state.region === "abyss" ? "ABYSSAL FLUKE SANCTUARY" : "GRAND TETON";
      $("zone-title").textContent = `Zone ${ROMAN[Z.z]} · ${currentPlaceName()}`;
      const flight = state.glide.landing ? "LANDING" : state.donkeyOnRoof ? "WAGON FLIGHT" : "GLIDE";
      const wagonRev = wagon.speed < -.3 || state.wagonCruise < 0;
      const veh = state.gliding ? `${flight} ${Math.round(state.glide.speed)} m/s (${state.glide.vy >= 0 ? "+" : ""}${state.glide.vy.toFixed(1)} vy) · `
                : state.drivingCart ? `CRUISER WAGON${wagonRev ? " REV" : ""} ${Math.abs(wagon.speed).toFixed(1)} m/s · `
                : state.riding ? "RIDING MISTLETOE · " : "";
      $("hud-sub").textContent = `${rTag} · ${veh}${m.label} · FOCUS ${state.focusDist.toFixed(1)} m · ${fl.name}`;
      $("focus-dist-val").textContent = `${state.focusDist.toFixed(1)} m`;
      $("focus-look-val").textContent = state.soloLook >= 0 ? `SOLO · ${activeLook.name}` : `FOCUS · ${activeLook.name}`;
      $("wedge-caption").textContent = `${rTag} · Meter Z-${ROMAN[state.meteredZone]} · WiFi ${state.frameWifiPct}% · Alt ${fmtElev(state.antennaElev)} · Forest ${state.unlockedGroves}/${forestGroves.length}`;
      $("ppc-wifi").textContent = `TX ${state.signalDbm} dBm · FRAME ${state.frameWifiPct}% · ALT ${fmtElev(state.antennaElev)} · FOREST ${state.unlockedGroves}/${forestGroves.length}`;
      if ($("finder-pct")) $("finder-pct").textContent = `IN-FRAME WIFI ${state.frameWifiPct}%`;
      if ($("finder-alt")) $("finder-alt").textContent = `ALT ${fmtElev(state.antennaElev)} · FOREST ${state.unlockedGroves}/${forestGroves.length}`;
      if ($("finder-bar")) $("finder-bar").style.width = `${clamp(state.frameWifiPct, 4, 100)}%`;
      if ($("cam-frame-tag")) $("cam-frame-tag").textContent = `8×10 WIFI SURVEY · ${state.frameWifiPct}% IN FRAME · ALT ${fmtElev(state.antennaElev)}`;

      // Survival Hydration, Jerrycans & Song-Zone Resonance Strip
      const wp = $("water-pill"), wf = $("water-bar-fill"), wv = $("water-val"), ta = $("thirst-alert");
      const wPct = Math.round(state.donkeyWater * 100);
      if (wp && wf && wv) {
        wf.style.width = `${wPct}%`;
        wv.textContent = state.donkeyCollapsed ? "COLLAPSED!" : `${wPct}%`;
        wp.classList.toggle("warn", !state.donkeyCollapsed && state.donkeyWater < .30);
        wp.classList.toggle("dead", state.donkeyCollapsed || state.donkeyWater <= .01);
      }
      if (ta) ta.hidden = !state.donkeyCollapsed && state.donkeyWater >= .22;

      const cp = $("cans-pill");
      if (cp) {
        const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
        const dIdx = ((Math.round((state.nextRelayAzDeg / 45)) % 8) + 8) % 8;
        cp.textContent = state.nextRelayDist < 9999
          ? `CANS ${state.filledCans}/${state.totalCans} · ${state.nextRelayName.split(" ")[0]} ${Math.round(state.nextRelayDist)}m ${dirs[dIdx]}`
          : `CANS ${state.filledCans}/${state.totalCans} · ALL LIT`;
      }
      const pp = $("phys-pill");
      if (pp) {
        const integ = vehPhys ? Math.round(vehPhys.integrity) : state.chassisIntegrity;
        pp.textContent = `WATER LOAD ${state.waterLiters.toFixed(1)} kg | SLOSH ${state.sloshPct}% | CHASSIS ${integ}%`;
        pp.classList.toggle("spilling", Boolean(state.sloshSpilling));
        pp.classList.toggle("damaged", integ < 60);
      }
      const rb = $("btn-repair-wagon");
      if (rb && vehPhys) {
        const nearRepair = Math.hypot(well.x - wagon.x, well.z - wagon.z) < 28 ||
          relays.some(r => Math.hypot(r.x - wagon.x, r.z - wagon.z) < 28) ||
          Math.hypot(well.x - state.x, well.z - state.z) < 28 ||
          relays.some(r => Math.hypot(r.x - state.x, r.z - state.z) < 28);
        rb.hidden = !(vehPhys.integrity < 99.5 && nearRepair);
      }
      const rp = $("res-pill"), ep = SONG_EPOCHS[state.songEpochIdx];
      if (rp && ep) {
        rp.classList.toggle("synced", state.zoneSynced);
        rp.textContent = state.zoneSynced
          ? `RESONANT Z-${ROMAN[state.resonantZone]} SYNCED · BOOST ON`
          : `${ep.name.split("·")[0].trim()} -> Z-${ROMAN[state.resonantZone]} · [T] SYNC`;
      }

      if ($("tape-spatial-btn")) {
        $("tape-spatial-btn").setAttribute("aria-pressed", String(state.spatialAudio));
        $("tape-spatial-btn").textContent = state.spatialAudio ? "3D BURRO TX" : "CABIN";
      }
      if ($("tape-falloff")) {
        $("tape-falloff").textContent = `${state.audioDistMeters.toFixed(1)}m · ${state.audioFalloffDb} dB`;
      }

      const lastCard = $("last-plate-card");
      if (lastCard) {
        if (state.plates.length) {
          const lp = state.plates[state.plates.length - 1];
          lastCard.hidden = false; $("last-plate-img").src = lp.dataUrl;
          $("last-plate-lbl").innerHTML = `<strong>#${lp.id} · ${lp.frameWifiPct ?? 0}% WIFI</strong><span>Z-${lp.roman} · Inspect</span>`;
        } else lastCard.hidden = true;
      }

      $("btn-cart").setAttribute("aria-pressed", String(state.drivingCart));
      $("btn-cart").textContent = state.drivingCart ? "Exit Wagon (C)" : "Drive Wagon (C)";
      $("btn-cart").hidden = state.gliding && state.donkeyOnRoof;
      if ($("btn-reverse")) {
        $("btn-reverse").hidden = !state.drivingCart;
        $("btn-reverse").setAttribute("aria-pressed", String(state.drivingCart && state.wagonCruise < 0));
        $("btn-reverse").textContent = state.wagonCruise < 0 ? "Stop Reverse" : "Reverse";
      }
      if ($("btn-glide")) {
        $("btn-glide").setAttribute("aria-pressed", String(state.gliding));
        $("btn-glide").textContent = `${glideActionLabel()} (J)`;
      }
      $("btn-teton-cruise").hidden = !state.glide.cruising && !canCruiseTetons();
      $("btn-teton-cruise").textContent = state.glide.cruising ? "Stop cruise" : "Fly to Tetons";
      $("btn-ride").setAttribute("aria-pressed", String(state.riding));
      if ($("btn-dance")) $("btn-dance").setAttribute("aria-pressed", String(state.danceTimer > 0));
      if ($("btn-lidar")) $("btn-lidar").setAttribute("aria-pressed", String(state.lidarOn));
      if ($("btn-sync-zone")) $("btn-sync-zone").setAttribute("aria-pressed", String(state.zoneSynced));
      if ($("btn-rig")) $("btn-rig").setAttribute("aria-pressed", String(state.rigDeployed));
      $("btn-jerikan").setAttribute("aria-pressed", String(fl.jerikan === 1));
      $("btn-ppc").setAttribute("aria-pressed", String(state.ppcOn));
      $("ppc-hud").hidden = !state.ppcOn;

      const swans = wedgeEl.querySelectorAll(".swatch"), capSet = new Set(state.plates.map(p => p.zone));
      swans.forEach((b, idx) => {
        b.classList.toggle("active", idx === state.meteredZone);
        b.classList.toggle("captured", capSet.has(idx));
        b.classList.toggle("resonant", idx === state.resonantZone);
      });
      updateFocusKnobVisual();
    }

    function updateHUD() {
      const st = STOPS[state.stopIdx], fl = FILTERS[state.filterIdx];
      if (useFieldLayout()) updateFieldHUD();
      else updateDesktopHUD(MODES[state.modeIdx], fl, ZONES[state.currentZone]);
      renderNpHUD();
      const u = lookMat.uniforms;
      u.uFocusDist.value = state.focusDist; u.uDofOctaves.value = st.oct; u.uTilt.value = state.tilt;
      u.uStrataLock.value = st.lock; u.uRouteMode.value = state.modeIdx; u.uSoloLook.value = state.soloLook;
      u.uFocusLook.value = state.focusLook; u.uFilter.value.set(fl.rgb[0], fl.rgb[1], fl.rgb[2]);
      u.uJerikanFilter.value = fl.jerikan;
      u.uResonantZone.value = state.resonantZone;
      u.uLidarStrength.value = state.lidarStrength;
    }

    /* ---------- 2086 Night Post Pure Engine & Cross-Tab Ledger Bridge ---------- */
    const npBundle = window.NIGHT_POST_BUNDLE;
    const npWorld = npBundle.world;
    const npEngine = npBundle.NightPost(npWorld);
    const NP_STATE_KEY = "donkey-water/night-post/1";
    const NP_STATIONS = {
      overlook:   { x: -14.8,   z: 0.8,   yaw: Math.PI * .50, donkeyX: -26.0, donkeyZ: -1.2, donkeyH: -Math.PI * .45 },
      switchback: { x: -40.0,   z: -157,  yaw: .63 },
      ford:       { x: -236.5,  z: -46.5, yaw: .72 },
      oxbow:      { x: -504.5,  z: 106.5, yaw: .48 },
      plaza:      { x: -772.5,  z: -19.5, yaw: .32 },
      fluke:      { x: -1064.0, z: -18.5, yaw: .56 },
      apron:      { x: 428.0,   z: 43.0,  yaw: -.83 },
      tetons:     { x: mw.tetonRange.x + 9, z: mw.tetonRange.z + 9, yaw: .785 },
      basalt:     { x: -1453.0, z: 769.0, yaw: .66 },
      beacon:     { x: -1603.0, z: 601.0, yaw: .57 },
      hill:       { x: -1765.0, z: 552.5, yaw: .00 },
      compound:   { x: -1679.0, z: 783.5, yaw: .09 }
    };

    let npState = (() => {
      let st = null;
      try {
        const raw = JSON.parse(localStorage.getItem(NP_STATE_KEY) || "null");
        if (raw && npEngine.validate(raw)) st = raw;
      } catch {}
      if (!st) st = npEngine.start();
      if ((initCircuitParam === "ahiya" || initCircuitParam === "west") && st.active !== initCircuitParam) {
        st = npEngine.switchRoute(st, initCircuitParam);
      }
      return st;
    })();
    let npPendingConfirm = "", npDispTab = "ledger";
    const npCarrier = () => npEngine.carrier(npState);
    const npCharter = () => npEngine.charter(npState);

    function saveNpState() {
      try { localStorage.setItem(NP_STATE_KEY, JSON.stringify(npState)); } catch {}
    }

    function closeScreeningCard() {
      npScreeningMode = null;
      if ($("np-screening-card")) $("np-screening-card").hidden = true;
    }

    function placeAtNpStation(stationId) {
      const st = NP_STATIONS[stationId];
      if (!st) return;
      if (state.gliding) landGlide(false);
      if (state.pourAnim) { pourGroup.visible = false; state.pourAnim = null; }
      state.riding = false; state.drivingCart = false; state.wagonCruise = 0; state.donkeyOnRoof = false;
      [state.x, state.z] = worldBoundsClamp(st.x, st.z);
      state.y = driveSurfaceAt(state.x, state.z) + 1.68;
      state.yaw = st.yaw; state.pitch = -.04;
      state.region = regionAt(state.x, state.z);
      const fwdX = -Math.sin(st.yaw), fwdZ = -Math.cos(st.yaw), rgtX = Math.cos(st.yaw), rgtZ = -Math.sin(st.yaw);
      if (stationId === "overlook") {
        wagon.x = -23.0; wagon.z = 4.6; wagon.heading = -Math.PI * .52; wagon.speed = 0;
      } else if (Math.hypot(wagon.x - state.x, wagon.z - state.z) > 120) {
        [wagon.x, wagon.z] = worldBoundsClamp(state.x - rgtX * 5.4 - fwdX * 1.8, state.z - rgtZ * 5.4 - fwdZ * 1.8);
        wagon.heading = st.yaw + Math.PI; wagon.speed = 0;
      }
      wagon.y = driveSurfaceAt(wagon.x, wagon.z);
      if (vehPhys) { vehPhys.syncFrom(wagon.x, wagon.y, wagon.z, wagon.heading, driveSurfaceAt); applyWagonVisuals(); }
      else {
        wagon.group.position.set(wagon.x, wagon.y, wagon.z);
        wagon.group.rotation.set(0, wagon.heading, 0, "YXZ");
      }
      const dx = st.donkeyX ?? (state.x + fwdX * 5.2 + rgtX * 1.85);
      const dz = st.donkeyZ ?? (state.z + fwdZ * 5.2 + rgtZ * 1.85);
      const dh = st.donkeyH ?? (st.yaw - 1.15);
      donkey.place(dx, dz, dh, (x, z) => driveSurfaceAt(x, z));
      applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
    }

    addEventListener("storage", e => {
      if (e.key !== NP_STATE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue);
        if (npEngine.validate(next) && next.rev >= npState.rev) {
          npState = next;
          renderNpHUD();
          if ($("np-dispatch-modal") && !$("np-dispatch-modal").hidden) renderNpDispatch();
        }
      } catch {}
    });

    function moveToStation(stationId) {
      const st = NP_STATIONS[stationId];
      if (!st) return;
      const prevPlace = npCarrier().place;
      const targetPl = npWorld.places[stationId];
      if (targetPl && targetPl.circuit !== npState.active) {
        npState = npEngine.switchRoute(npState, targetPl.circuit);
      }
      if (npState.routes[npState.active].place !== stationId) {
        npState = JSON.parse(JSON.stringify(npState));
        npState.routes[npState.active].place = stationId;
        if (!npState.routes[npState.active].visited.includes(stationId)) npState.routes[npState.active].visited.push(stationId);
        npState.rev++;
        saveNpState();
      }
      if (stationId !== prevPlace || (stationId !== "oxbow" && stationId !== "compound")) {
        closeScreeningCard();
      }
      placeAtNpStation(stationId);
      initRain(); sampleMeter(); updateHUD(); renderFrame(performance.now() * .001);
    }

    function openScreeningCard(mode, cueText) {
      const card = $("np-screening-card");
      if (!card) return;
      npScreeningMode = mode;
      npScreenTimer = .001;
      const isWest = npState.active === "west";
      setText("np-prog-head", isWest ? "COTTONWOOD OXBOW / PROGRAM CARD" : "DAYLIGHT COMPOUND / PROGRAM CARD");
      setText("np-prog-reel", isWest ? "WF–08 / SILVER FORD" : "AR–03 / AHIYA NIGHT");
      setText("np-prog-sheet", isWest ? "Wedding through the fallen shoe" : "Aunt’s live answer with root-bowl backing");
      setText("np-prog-earphone", isWest ? "Tail, eight seconds · family listening" : "Three rehearsal takes · cousin’s entrance");
      setText("np-prog-custody", isWest ? "Etta · return via Cottonwood Oxbow" : "Aunt · household copy on Rahel’s phone");
      setText("np-prog-cue", cueText || npCharter().tailWords[0]);
      card.hidden = false;
    }

    function runNpAction(actionId, confirmed = false) {
      const opts = npEngine.options(npState);
      const chosen = opts.find(o => o.id === actionId);
      if (!chosen) return { ok: false, reason: "Action unavailable at this stop" };
      if (!chosen.enabled) { toast(chosen.reason || "Cannot perform action right now"); return { ok: false, reason: chosen.reason }; }
      if (!confirmed && (actionId === "overdraw" || actionId === "release" || actionId === "handoff")) {
        npPendingConfirm = actionId;
        const bar = $("np-confirm-bar");
        if (bar) {
          setText("np-confirm-msg", actionId === "overdraw"
            ? "Draw below chalk? This closes the well for two handoffs."
            : actionId === "release"
              ? "Give entire 20 L can to yard? Wet-only copies will clear."
              : "Close local shift and replenish rested wells?");
          bar.hidden = false;
          return { ok: false, confirm: true };
        }
      }
      npPendingConfirm = "";
      if ($("np-confirm-bar")) $("np-confirm-bar").hidden = true;
      const res = npEngine.act(npState, actionId);
      npState = res.state;
      saveNpState();

      // Trigger rich 3D/WebAudio feedback per NightPost verb
      const verb = actionId.split(":")[0], arg = actionId.split(":")[1];
      if (verb === "pump" || verb === "overdraw") { state.pumpFlow = 1.0; state.donkeyWater = 1.0; state.donkeyCollapsed = false; audio.pumpClank(); if (DEMO && field && field.ready) field.pumpStrokes(new T.Vector3(-1460, driveSurfaceAt(-1460, 760) + 1.1, 760), verb === "overdraw" ? 7 : 4); }
      else if (verb === "water") { state.donkeyWater = 1.0; state.donkeyCollapsed = false; triggerDance(2.2, true); }
      else if (verb === "screen") { openScreeningCard(npState.active === "west" ? "WF-08" : "AR-03", npCarrier().log.at(-1)?.text); audio.relayChime(true); }
      else if (verb === "listen") {
        openScreeningCard(npState.active === "west" ? "WF-08" : "AR-03", npCharter().tailWords[0]);
        if (npState.active === "west") audio.playEightSecondTail(); else audio.playHarmonyRehearsal();
      }
      else if (verb === "aerial") {
        for (const id of npCarrier().awake) {
          const gIdx = Math.max(0, Number(id.slice(1)) - 1);
          if (forestGroves[gIdx]) unlockForestGrove(forestGroves[gIdx]);
        }
      }
      else if (verb === "go" && arg && NP_STATIONS[arg]) {
        closeScreeningCard();
        placeAtNpStation(arg);
        initRain();
      } else if (verb === "land" && NP_STATIONS[npCarrier().place]) {
        closeScreeningCard();
        moveToStation(npCarrier().place);
      } else if (verb === "takeoff" || verb === "handoff") {
        closeScreeningCard();
      }
      updateHUD();
      if ($("np-dispatch-modal") && !$("np-dispatch-modal").hidden) renderNpDispatch();
      toast(res.text, chosen.label);
      return res;
    }

    function switchNpCircuit(targetKey) {
      const nextKey = targetKey || (npState.active === "west" ? "ahiya" : "west");
      if (nextKey === npState.active) return;
      closeScreeningCard();
      npState = npEngine.switchRoute(npState, nextKey);
      saveNpState();
      const destStop = npCarrier().place;
      if (NP_STATIONS[destStop]) moveToStation(destStop);
      else updateHUD();
      if ($("np-dispatch-modal") && !$("np-dispatch-modal").hidden) renderNpDispatch();
      toast(`Switched to ${npCharter().name} (${npCharter().carrier})`, npCharter().carrier);
    }

    function renderNpHUD() {
      const c = npCarrier(), q = npCharter(), opts = npEngine.options(npState);
      const pl = npWorld.places[c.place] || npWorld.places.overlook;
      const clk = npEngine.clock(c.watch), freeL = npEngine.free(c);
      if ($("np-route-tag")) setText("np-route-tag", `${q.name.toUpperCase()} · ${q.carrier.toUpperCase()} & ${q.animal.toUpperCase()}`);
      if ($("np-watch-clock")) setText("np-watch-clock", `SHIFT ${c.day} · WATCH ${String(c.watch).padStart(2, "0")}/18 · ${clk} · STR ${c.strength}/6`);
      if ($("np-switch-btn")) setText("np-switch-btn", npState.active === "west" ? "Switch: Ahiya (Rahel)" : "Switch: West (Imani)");
      if ($("np-can-readout")) setText("np-can-readout", `${c.liters}/20 L ABOARD (${c.reserve} L CHALK · ${freeL} L FREE)`);
      const wInfo = c.wells[c.place], wDef = npWorld.wells[c.place];
      if ($("np-well-readout")) setText("np-well-readout", wInfo ? `WELL ${wInfo.stock}/${wDef.capacity} L (FLOOR ${wDef.floor} L${wInfo.resting ? " · RESTING" : ""})` : pl.name.toUpperCase());
      if ($("np-can-fill")) {
        $("np-can-fill").style.width = `${clamp((c.liters / 20) * 100, 0, 100)}%`;
        $("np-can-fill").classList.toggle("dull", c.liters <= 0);
      }
      const chipsEl = $("np-cargo-chips");
      if (chipsEl) {
        const chips = [];
        for (const wItem of c.wet) chips.push(`<span class="np-chip">Wet: ${wItem}</span>`);
        for (const pItem of c.phone) chips.push(`<span class="np-chip phone">Phone: ${pItem}</span>`);
        if (c.flags.permit) chips.push(`<span class="np-chip done">Permit</span>`);
        if (c.flags.cooled) chips.push(`<span class="np-chip done">Cooled 9L</span>`);
        if (c.flags.shown) chips.push(`<span class="np-chip done">Screened</span>`);
        if (c.flags.listened) chips.push(`<span class="np-chip done">Listened</span>`);
        if (c.flags.filed) chips.push(`<span class="np-chip done">Filed</span>`);
        if (!chips.length) {
          chips.push(c.liters > 0
            ? `<span class="np-chip empty">${c.liters} L water aboard · ${freeL} L spendable above ${c.reserve} L chalk</span>`
            : `<span class="np-chip empty">Dry saddle can · draw at marked well</span>`);
        }
        chipsEl.innerHTML = chips.join("");
      }
      const actBar = $("np-actions-bar");
      if (actBar && !useFieldLayout()) {
        const prio = opts.filter(o => o.enabled && o.id !== "expose" && !o.id.startsWith("go:"));
        const navs = opts.filter(o => o.id.startsWith("go:") && o.enabled).slice(0, 3);
        const list = [...prio.slice(0, 5), ...navs];
        actBar.innerHTML = list.map((o, idx) =>
          `<button type="button" class="np-act ${idx === 0 && !o.id.startsWith("go:") ? "primary" : ""}" data-np-act="${o.id}" title="${o.detail || o.label}">${o.label}</button>`
        ).join("");
        actBar.querySelectorAll("[data-np-act]").forEach(btn => btn.addEventListener("click", () => runNpAction(btn.dataset.npAct)));
      }
    }

    function renderNpDispatch() {
      const c = npCarrier(), q = npCharter(), pl = npWorld.places[c.place] || npWorld.places.overlook;
      if ($("np-dispatch-modal")) $("np-dispatch-modal").dataset.tab = npDispTab;
      setText("np-disp-title", npDispTab === "video"
        ? "DONKEY WATER SCIFI · Cyan Jerikan Over Cosmic Addis"
        : `${q.name} · ${pl.name} (Shift ${c.day} · ${npEngine.clock(c.watch)})`);
      if ($("np-disp-img") && npBundle.art[pl.image]) $("np-disp-img").src = npBundle.art[pl.image];
      setText("np-disp-caption", pl.caption || pl.name);
      setText("np-disp-look", pl.look || pl.summary);
      document.querySelectorAll("[data-np-tab]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.npTab === npDispTab)));
      const body = $("np-disp-body");
      if (!body) return;
      if (npDispTab === "video") {
        if (!audioEl.paused) audioEl.pause();
        body.innerHTML = `
          <div class="np-video-wrap">
            <iframe
              src="https://www.youtube.com/embed/ZZlDs10FCZk?rel=0&playsinline=1"
              title="DONKEY WATER SCIFI Music Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin"
              allowfullscreen></iframe>
          </div>
          <div class="chip-grid" style="margin-top:8px;">
            <a class="chip" href="../music-video.html" style="text-decoration:none;">Open Full Screening Room &amp; Lyrics</a>
            <a class="chip" href="https://www.youtube.com/watch?v=ZZlDs10FCZk" target="_blank" rel="noopener" style="text-decoration:none;">Watch on YouTube</a>
          </div>`;
        return;
      }
      if (npDispTab === "ledger") {
        const L = c.ledger, sum = c.liters + L.cooling + L.tap + L.screen + L.animal + L.flight;
        body.innerHTML = `
          <p class="tray-note">${npEngine.target(npState)[1]}</p>
          <table class="np-stat-table">
            <thead><tr><th>Drawn</th><th>Aboard</th><th>Cooling</th><th>Public Tap</th><th>Grove</th><th>Animal</th><th>Flight</th></tr></thead>
            <tbody><tr><td>${L.drawn} L</td><td>${c.liters} L</td><td>${L.cooling} L</td><td>${L.tap} L</td><td>${L.screen} L</td><td>${L.animal} L</td><td>${L.flight} L</td></tr></tbody>
          </table>
          <p class="tray-note">Conservation Check: ${L.drawn} L drawn == ${sum} L accounted (${npEngine.validate(npState) ? "VALID" : "MISMATCH"}). Custodian: ${q.keeper} · Record: ${q.record}.</p>
          <div class="chip-grid">
            ${npEngine.options(npState).filter(o => o.enabled).map(o => `<button type="button" class="chip" data-disp-act="${o.id}">${o.label}</button>`).join("")}
            <button type="button" class="chip" id="np-cycle-watch">Advance Watch (+1)</button>
          </div>`;
        body.querySelectorAll("[data-disp-act]").forEach(b => b.addEventListener("click", () => runNpAction(b.dataset.dispAct)));
        if ($("np-cycle-watch")) $("np-cycle-watch").addEventListener("click", () => {
          npState = JSON.parse(JSON.stringify(npState));
          const rc = npState.routes[npState.active];
          rc.watch = (rc.watch + 2) % 18;
          npState.rev++; saveNpState(); updateHUD(); renderNpDispatch();
        });
      } else if (npDispTab === "log") {
        body.innerHTML = c.log.slice().reverse().slice(0, 12).map(e => `
          <div class="np-log-item"><small>Shift ${e.day} · ${npEngine.clock(e.watch)} · ${npWorld.places[e.place]?.name || e.place} · ${e.verb}</small>${e.text}</div>`
        ).join("");
      } else if (npDispTab === "law") {
        body.innerHTML = npWorld.law.map(([t, d]) => `<div class="np-log-item"><small>${t}</small>${d}</div>`).join("");
      } else {
        body.innerHTML = c.plates.length
          ? c.plates.slice().reverse().map(p => `<div class="np-log-item"><small>Zone ${npWorld.zones[p.zone]?.zone || p.zone} · ${npWorld.places[p.place]?.name || p.place}</small>Maker: ${p.maker} · Shift ${p.day}</div>`).join("")
          : `<p class="tray-note">No 8×10 field plates recorded on this circuit yet. Press Space or Expose 8×10.</p>`;
      }
    }

    /* ---------- In-World 3D Cinema Screen Projection & Mode Control ---------- */
    const iwCssEl = $("inworld-css3d"), iwCardEl = $("inworld-yt-card"), iwYtEl = $("inworld-yt-iframe");
    const iwBarEl = $("inworld-video-bar");
    const iwMatDiv = new T.Matrix4(), iwMatViewCss = new T.Matrix4(), iwMatTotal = new T.Matrix4();
    const iwCenter = new T.Vector3(), iwViewPt = new T.Vector3(), iwNormal = new T.Vector3(), iwToCam = new T.Vector3();
    let activeScreenId = "overlook";

    function findTargetCinemaScreen(preferredId) {
      if (preferredId) {
        const exact = inWorldScreens.find(s => s.id === preferredId);
        if (exact) return exact;
      }
      let best = inWorldScreens[0], bestD = 1e9;
      for (const s of inWorldScreens) {
        s.mesh.getWorldPosition(iwCenter);
        const d = Math.hypot(iwCenter.x - state.x, iwCenter.z - state.z);
        if (d < bestD) { bestD = d; best = s; }
      }
      return bestD < 220 ? best : (inWorldScreens.find(s => s.id === npCarrier().place) || inWorldScreens[0]);
    }

    function focusCinemaScreen(scr) {
      if (!scr || !scr.stand) return;
      if (state.gliding) landGlide(false);
      if (state.drivingCart) toggleCart();
      state.wagonCruise = 0; state.riding = false; state.donkeyOnRoof = false;
      const mobOv = useFieldLayout() && scr.id === "overlook";
      [state.x, state.z] = worldBoundsClamp(mobOv ? -17.5 : scr.stand.x, mobOv ? -0.4 : scr.stand.z);
      state.y = driveSurfaceAt(state.x, state.z) + 1.68;
      state.yaw = mobOv ? 1.53 : scr.stand.yaw; state.pitch = -.02;
      state.region = regionAt(state.x, state.z);
      const fwdX = -Math.sin(state.yaw), fwdZ = -Math.cos(state.yaw);
      const rgtX = Math.cos(state.yaw), rgtZ = -Math.sin(state.yaw);
      donkey.place(state.x + fwdX * 4.2 + rgtX * 2.2, state.z + fwdZ * 4.2 + rgtZ * 2.2, state.yaw + .45, (x, z) => driveSurfaceAt(x, z));
      applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
      activeScreenId = scr.id;
      initRain(); sampleMeter(); updateHUD();
    }

    function syncInWorldBarButtons() {
      if ($("iwv-mode-yt")) $("iwv-mode-yt").setAttribute("aria-pressed", String(inWorldVideoMode === "youtube"));
      if ($("iwv-mode-cloth")) $("iwv-mode-cloth").setAttribute("aria-pressed", String(inWorldVideoMode === "cloth" || inWorldVideoMode === "mp4"));
    }

    function toggleInWorldVideo(open, mode = "youtube", screenId = "") {
      const turnOn = open === undefined ? !inWorldVideoMode : Boolean(open);
      if (!turnOn) {
        inWorldVideoMode = null;
        if (iwCssEl) iwCssEl.hidden = true;
        if (iwYtEl) iwYtEl.src = "";
        if (iwBarEl) iwBarEl.hidden = true;
        if (customClothVideo) { customClothVideo.pause(); }
        cinemaMat.map = cinemaTex; cinemaMat.emissiveMap = cinemaTex; cinemaMat.needsUpdate = true;
        syncInWorldBarButtons();
        updateHUD();
        return;
      }
      if ($("np-dispatch-modal")) $("np-dispatch-modal").hidden = true;
      if (state.introActive) finishIntro(true);
      inWorldVideoMode = mode;
      const scr = findTargetCinemaScreen(screenId);
      focusCinemaScreen(scr);
      if (iwBarEl) iwBarEl.hidden = false;
      if (mode === "youtube") {
        if (!audioEl.paused) audioEl.pause();
        if (customClothVideo) customClothVideo.pause();
        cinemaMat.map = cinemaTex; cinemaMat.emissiveMap = cinemaTex; cinemaMat.needsUpdate = true;
        if (iwYtEl && !iwYtEl.src.includes("ZZlDs10FCZk")) {
          iwYtEl.src = "https://www.youtube.com/embed/ZZlDs10FCZk?rel=0&playsinline=1";
        }
        toast(`Projected on ${scr.label} · Move or look around freely (Y to toggle)`, scr.label);
      } else if (mode === "cloth") {
        if (iwCssEl) iwCssEl.hidden = true;
        if (iwYtEl) iwYtEl.src = "";
        if (customClothVideo) customClothVideo.pause();
        cinemaMat.map = cinemaTex; cinemaMat.emissiveMap = cinemaTex; cinemaMat.needsUpdate = true;
        if (audioEl.paused) toggleTape();
        toast(`3D Linen Cloth Reel + C60 Spatial Song at ${scr.label}`, scr.label);
      }
      syncInWorldBarButtons();
      renderFrame(performance.now() * .001);
    }

    function loadCustomClothVideo(file) {
      if (!file) return;
      if (!customClothVideo) {
        customClothVideo = document.createElement("video");
        customClothVideo.playsInline = true; customClothVideo.loop = true; customClothVideo.crossOrigin = "anonymous";
        customClothTex = new T.VideoTexture(customClothVideo);
        customClothTex.colorSpace = T.NoColorSpace;
      }
      if (customVideoBlob) URL.revokeObjectURL(customVideoBlob);
      customVideoBlob = URL.createObjectURL(file);
      customClothVideo.src = customVideoBlob;
      customClothVideo.play().catch(() => {});
      if (!audioEl.paused) audioEl.pause();
      if (iwCssEl) iwCssEl.hidden = true;
      if (iwYtEl) iwYtEl.src = "";
      inWorldVideoMode = "mp4";
      cinemaMat.map = customClothTex; cinemaMat.emissiveMap = customClothTex; cinemaMat.needsUpdate = true;
      const scr = findTargetCinemaScreen();
      focusCinemaScreen(scr);
      if (iwBarEl) iwBarEl.hidden = false;
      syncInWorldBarButtons();
      toast(`Playing ${file.name} on 3D World Cinema Screens`, file.name);
      renderFrame(performance.now() * .001);
    }

    function syncInWorldCss3d() {
      if (!iwCssEl || !iwCardEl) return;
      if (inWorldVideoMode !== "youtube" || state.introActive || ($("np-dispatch-modal") && !$("np-dispatch-modal").hidden)) {
        iwCssEl.hidden = true;
        return;
      }
      const scr = findTargetCinemaScreen(activeScreenId);
      if (!scr) { iwCssEl.hidden = true; return; }
      activeScreenId = scr.id;
      camera.updateMatrixWorld();
      scr.mesh.updateMatrixWorld();
      scr.mesh.getWorldPosition(iwCenter);
      iwViewPt.copy(iwCenter).applyMatrix4(camera.matrixWorldInverse);
      iwNormal.set(0, 0, 1).transformDirection(scr.mesh.matrixWorld);
      iwToCam.subVectors(camera.position, iwCenter).normalize();
      if (iwViewPt.z > -1.0 || iwCenter.distanceTo(camera.position) > 95 || iwNormal.dot(iwToCam) < 0.08) {
        iwCssEl.hidden = true;
        return;
      }
      const cssW = Math.max(2, canvas.clientWidth || innerWidth);
      const cssH = Math.max(2, canvas.clientHeight || innerHeight);
      const fovPx = 0.5 / Math.tan(T.MathUtils.degToRad(camera.fov * 0.5)) * cssH;
      const sW = scr.w / 640, sH = scr.h / 360;
      iwMatDiv.set(sW, 0, 0, -320 * sW, 0, -sH, 0, 180 * sH, 0, 0, 1, 0, 0, 0, 0, 1);
      iwMatViewCss.set(1, 0, 0, cssW * 0.5, 0, -1, 0, cssH * 0.5, 0, 0, 1, fovPx, 0, 0, 0, 1);
      iwMatTotal.multiplyMatrices(iwMatViewCss, camera.matrixWorldInverse).multiply(scr.mesh.matrixWorld).multiply(iwMatDiv);
      const e = iwMatTotal.elements;
      iwCssEl.hidden = false;
      iwCssEl.style.perspective = `${fovPx.toFixed(2)}px`;
      iwCardEl.style.transform = `matrix3d(${e.map(v => (Math.abs(v) < 1e-7 ? 0 : +v.toFixed(6))).join(",")})`;
    }

    if ($("iwv-mode-yt")) $("iwv-mode-yt").addEventListener("click", () => toggleInWorldVideo(true, "youtube", activeScreenId));
    if ($("iwv-mode-cloth")) $("iwv-mode-cloth").addEventListener("click", () => toggleInWorldVideo(true, "cloth", activeScreenId));
    if ($("iwv-file")) $("iwv-file").addEventListener("change", e => loadCustomClothVideo(e.target.files?.[0]));
    if ($("iwv-focus")) $("iwv-focus").addEventListener("click", () => { focusCinemaScreen(findTargetCinemaScreen()); renderFrame(performance.now() * .001); });
    if ($("iwv-close")) $("iwv-close").addEventListener("click", () => toggleInWorldVideo(false));

    function openNpDispatch(open, tab) {
      if (tab === "video") {
        toggleInWorldVideo(true, "youtube");
        return;
      }
      const modal = $("np-dispatch-modal");
      if (!modal) return;
      if (tab) npDispTab = tab;
      modal.hidden = open === undefined ? !modal.hidden : !open;
      if (!modal.hidden) renderNpDispatch();
      else if (npDispTab === "video" && $("np-disp-body")) $("np-disp-body").innerHTML = "";
    }
    if ($("np-dispatch-btn")) $("np-dispatch-btn").addEventListener("click", () => openNpDispatch(true));
    if ($("field-dispatch-btn")) $("field-dispatch-btn").addEventListener("click", () => openNpDispatch(true));
    if ($("intro-video")) $("intro-video").addEventListener("click", () => toggleInWorldVideo(true, "youtube"));
    if ($("tape-video-btn")) $("tape-video-btn").addEventListener("click", () => toggleInWorldVideo(true, "youtube"));
    if ($("field-video-btn")) $("field-video-btn").addEventListener("click", () => toggleInWorldVideo(true, "youtube"));
    if ($("np-disp-close")) $("np-disp-close").addEventListener("click", () => openNpDispatch(false));
    document.querySelectorAll("[data-np-tab]").forEach(btn => btn.addEventListener("click", () => {
      if (btn.dataset.npTab === "video") { toggleInWorldVideo(true, "youtube"); return; }
      npDispTab = btn.dataset.npTab;
      renderNpDispatch();
    }));
    if ($("np-switch-btn")) $("np-switch-btn").addEventListener("click", () => switchNpCircuit());
    if ($("field-switch-btn")) $("field-switch-btn").addEventListener("click", () => switchNpCircuit());
    if ($("np-confirm-yes")) $("np-confirm-yes").addEventListener("click", () => { if (npPendingConfirm) runNpAction(npPendingConfirm, true); });
    if ($("np-confirm-no")) $("np-confirm-no").addEventListener("click", () => { npPendingConfirm = ""; if ($("np-confirm-bar")) $("np-confirm-bar").hidden = true; });
    if ($("np-prog-close")) $("np-prog-close").addEventListener("click", closeScreeningCard);
    saveNpState();

    function renderTray() {
      const tray = $("rack-tray"), tab = state.trayTab;
      if (useFieldLayout()) {
        state.trayTab = null;
        tray.hidden = true;
        return;
      }
      ["mode", "look", "lens", "burro"].forEach(k => $("sp-" + k).setAttribute("aria-pressed", String(tab === k)));
      if (!tab) { tray.hidden = true; return; }
      tray.hidden = false;

      if (tab === "mode") {
        tray.innerHTML = `
          <div class="tray-head"><h2>Focus Pull Mode &amp; Summits</h2><button type="button" class="chip" id="tr-close">Done</button></div>
          <p class="tray-note">${MODES[state.modeIdx].desc}</p>
          <button type="button" class="chip wide" id="md-replay">Replay Cinematic Prologue</button>
          <div class="chip-grid">${MODES.map((m, i) => `<button type="button" class="chip wide" data-mode="${i}" aria-pressed="${state.modeIdx === i}">${m.label} — ${m.sub}</button>`).join("")}</div>
          <div class="sec-label">Summit Base-Jump Launches (J)</div>
          <div class="chip-grid">${SUMMITS.map((s, idx) => `<button type="button" class="chip wide" data-summit="${idx}">${s.name}</button>`).join("")}</div>
          <div class="sec-label">Unified World Zone Vantages</div>
          <div class="chip-grid">${ZONES.map(z => `<button type="button" class="chip" data-tp="${z.z}">Z-${ROMAN[z.z]} ${z.name}</button>`).join("")}</div>`;
        $("md-replay").onclick = () => { state.trayTab = null; renderTray(); startPrologue(); };
        tray.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { state.modeIdx = +b.dataset.mode; state.focusPulse = 1; renderTray(); updateHUD(); });
        tray.querySelectorAll("[data-summit]").forEach(b => b.onclick = () => { launchSummit(+b.dataset.summit); renderTray(); });
        tray.querySelectorAll("[data-tp]").forEach(b => b.onclick = () => teleportZone(+b.dataset.tp));
      } else if (tab === "look") {
        const targetName = state.soloLook >= 0 ? `SOLO FULL: ${LOOKS[state.soloLook].name}` : `AT FOCUS: ${LOOKS[state.focusLook].name}`;
        tray.innerHTML = `
          <div class="tray-head"><h2>Look Rack (14 Shaders)</h2><button type="button" class="chip" id="tr-close">Done</button></div>
          <p class="tray-note">${targetName}</p>
          <button type="button" class="chip wide" id="lk-all" aria-pressed="${state.soloLook < 0}">All Zone Modes Active (Disable Solo)</button>
          <div class="chip-grid">${LOOKS.map((L, idx) => `<button type="button" class="chip" data-solo="${idx}" aria-pressed="${state.soloLook === idx || (state.soloLook < 0 && state.focusLook === idx)}">${L.zone >= 0 ? "Z-" + ROMAN[L.zone] + " · " : ""}${L.name}</button>`).join("")}</div>`;
        $("lk-all").onclick = () => { state.soloLook = -1; renderTray(); updateHUD(); };
        tray.querySelectorAll("[data-solo]").forEach(b => b.onclick = () => {
          const idx = +b.dataset.solo; state.soloLook = state.soloLook === idx ? -1 : idx;
          if (state.soloLook < 0) state.focusLook = idx;
          renderTray(); updateHUD();
        });
      } else if (tab === "lens") {
        tray.innerHTML = `
          <div class="tray-head"><h2>8×10 Optical Standard</h2><button type="button" class="chip" id="tr-close">Done</button></div>
          <div class="sec-label">Aperture Stop</div>
          <div class="chip-grid">${STOPS.map((s, i) => `<button type="button" class="chip" data-stop="${i}" aria-pressed="${state.stopIdx === i}">${s.name}</button>`).join("")}</div>
          <div class="sec-label">Scheimpflug Front Tilt</div>
          <div class="chip-grid">
            <button type="button" class="chip" data-tilt="-0.32" aria-pressed="${state.tilt < -0.1}">Near-Far Tilt (−)</button>
            <button type="button" class="chip" data-tilt="0" aria-pressed="${Math.abs(state.tilt) < 0.05}">Level (0°)</button>
            <button type="button" class="chip" data-tilt="0.32" aria-pressed="${state.tilt > 0.1}">Reverse Tilt (+)</button>
          </div>
          <div class="sec-label">Optical Filter Glass (1–6)</div>
          <div class="chip-grid">${FILTERS.map((f, i) => `<button type="button" class="chip" data-flt="${i}" aria-pressed="${state.filterIdx === i}">${f.short}</button>`).join("")}</div>
          <button type="button" class="chip wide" id="gg-tgl" aria-pressed="${state.groundGlass}">Ground-Glass Dark Cloth (G)</button>`;
        tray.querySelectorAll("[data-stop]").forEach(b => b.onclick = () => { state.stopIdx = +b.dataset.stop; state.focusPulse = .8; renderTray(); updateHUD(); });
        tray.querySelectorAll("[data-tilt]").forEach(b => b.onclick = () => { state.tilt = +b.dataset.tilt; renderTray(); updateHUD(); });
        tray.querySelectorAll("[data-flt]").forEach(b => b.onclick = () => { state.filterIdx = +b.dataset.flt; renderTray(); updateHUD(); });
        $("gg-tgl").onclick = () => { state.groundGlass = !state.groundGlass; document.body.classList.toggle("ground-glass", state.groundGlass); renderTray(); };
      } else if (tab === "burro") {
        const m = donkey.mind, ds = donkey.state;
        const bar = (lbl, v) => `<div class="mind-bar"><span>${lbl}</span><i><em style="width:${Math.round(v * 100)}%"></em></i><b>${Math.round(v * 100)}%</b></div>`;
        tray.innerHTML = `
          <div class="tray-head"><h2>Wagon, Glider &amp; Mistletoe</h2><button type="button" class="chip" id="tr-close">Done</button></div>
          <p class="tray-note">Alt ${fmtElev(state.antennaElev)} · Cans ${state.filledCans}/${state.totalCans} · Forest ${state.unlockedGroves}/${forestGroves.length} · Burro Water ${Math.round(state.donkeyWater * 100)}%.</p>
          <div class="chip-grid">
            <button type="button" class="chip" id="br-cart" aria-pressed="${state.drivingCart}" ${state.gliding && state.donkeyOnRoof ? "hidden" : ""}>${state.drivingCart ? "Exit Wagon (C)" : "Drive Wagon (C)"}</button>
            <button type="button" class="chip" id="br-glide" aria-pressed="${state.gliding}">${glideActionLabel()} (J)</button>
            <button type="button" class="chip" id="br-ride" aria-pressed="${state.riding}">${state.riding ? "Dismount (V)" : "Ride Mistletoe (V)"}</button>
            <button type="button" class="chip" id="br-region">World Shuttle (R)</button>
            <button type="button" class="chip" id="br-pour">Pour / Deliver (F)</button>
            <button type="button" class="chip" id="br-pump">Water / Pump (P)</button>
            <button type="button" class="chip" id="br-dance">Eskista Dance (K)</button>
            <button type="button" class="chip" id="br-lidar">Lidar Flow (L)</button>
          </div>
          <div class="sec-label">Summit Base-Jump Drops</div>
          <div class="chip-grid">${SUMMITS.map((s, idx) => `<button type="button" class="chip wide" data-summit="${idx}">${s.name}</button>`).join("")}</div>
          <div class="sec-label">Hydration, Signal &amp; Burro</div>
          ${bar("Burro Water", state.donkeyWater)}
          ${bar("WiFi Water", state.wifiCharge)}
          ${bar("Jerrycans", state.filledCans / state.totalCans)}
          ${bar("Forest Unlocks", state.unlockedGroves / forestGroves.length)}
          ${bar("Trust", m.trust)}
          ${bar("Energy", ds.stamina)}
          <div class="chip-grid">
            <button type="button" class="chip" id="br-feed">Feed Oats</button>
            <button type="button" class="chip" id="br-soothe">Soothe</button>
            <button type="button" class="chip" id="br-bray">Bray</button>
          </div>`;
        $("br-cart").onclick = () => { toggleCart(); renderTray(); };
        $("br-glide").onclick = () => { toggleGlide(); renderTray(); };
        $("br-ride").onclick = () => { toggleRide(); renderTray(); };
        $("br-region").onclick = () => { toggleRegion(); renderTray(); };
        $("br-pour").onclick = () => { pourWifi(); renderTray(); };
        $("br-pump").onclick = () => { pumpWell(); renderTray(); };
        $("br-dance").onclick = () => { triggerDance(); renderTray(); };
        $("br-lidar").onclick = () => { toggleLidar(); renderTray(); };
        tray.querySelectorAll("[data-summit]").forEach(b => b.onclick = () => { launchSummit(+b.dataset.summit); renderTray(); });
        $("br-feed").onclick = () => { donkey.feed(); toast("Mistletoe munches oats gratefully."); renderTray(); };
        $("br-soothe").onclick = () => { donkey.soothe(); toast("A steady hand on Mistletoe’s shoulder."); renderTray(); };
        $("br-bray").onclick = () => { donkey.bray(); toast("Mistletoe brays across the canyon."); };
      }
      const cls = $("tr-close"); if (cls) cls.onclick = () => { state.trayTab = null; renderTray(); };
    }

    ["mode", "look", "lens", "burro"].forEach(k => $("sp-" + k).addEventListener("click", () => { state.trayTab = state.trayTab === k ? null : k; renderTray(); }));
    $("sp-clocks").addEventListener("click", () => {
      toggleClocks();
    });

    /* Cassette Deck + Spatial Radio Controls */
    const audioEl = $("jerikan-audio");
    function toggleClocks() {
      const on = audio.toggle();
      $("sp-clocks").setAttribute("aria-pressed", String(on));
      toast(on ? "Three Clocks WebAudio engaged." : "Three Clocks muted.", on ? "Clocks on" : "Clocks muted");
      updateHUD();
    }
    function syncTapeUI() {
      const playing = !audioEl.paused && !audioEl.ended;
      $("tape-btn").setAttribute("aria-pressed", String(playing));
      $("tape-btn").textContent = playing ? "Pause Tape" : "Play Tape";
      document.body.classList.toggle("tape-playing", playing);
      updateHUD();
    }
    for (const event of ["play", "pause", "ended", "emptied"]) audioEl.addEventListener(event, syncTapeUI);
    audioEl.addEventListener("error", () => {
      syncTapeUI();
      toast("Tape unavailable. Select Play to retry.", "Tape unavailable. Retry Play.");
    });
    function toggleTape() {
      audio.connectTape(audioEl);
      if (audioEl.paused) {
        if (audioEl.error) audioEl.load();
        audioEl.play().catch(error => {
          if (error.name === "AbortError") return;
          syncTapeUI();
          toast("Tape unavailable. Select Play to retry.", "Tape unavailable. Retry Play.");
        });
      } else {
        audioEl.pause();
      }
    }
    $("tape-btn").addEventListener("click", toggleTape);

    function toggleSpatialAudio() {
      state.spatialAudio = audio.setSpatialMode(!state.spatialAudio);
      updateHUD();
      toast(state.spatialAudio ? "3D Donkey Pack Speaker TX (distance attenuation ON)." : "Cabin Stereo Monitor (direct full volume).",
        state.spatialAudio ? "Burro speakers" : "Cabin stereo");
    }
    if ($("tape-spatial-btn")) $("tape-spatial-btn").addEventListener("click", toggleSpatialAudio);

    function seekTape(sec, play = true) {
      const dur = Number.isFinite(audioEl.duration) ? audioEl.duration : 283;
      audioEl.currentTime = clamp(sec, 0, dur - .2);
      if (play && audioEl.paused) toggleTape();
      updateHUD();
    }
    if ($("tape-scrub")) {
      $("tape-scrub").addEventListener("click", e => {
        const rect = $("tape-scrub").getBoundingClientRect();
        const frac = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
        const dur = Number.isFinite(audioEl.duration) ? audioEl.duration : 283;
        seekTape(frac * dur);
      });
    }

    /* ---------- Expedition Actions: Pouring, Fillable Jerrycans, Eskista Dance, Lidar, Resonance, Rig ---------- */
    function recomputeFilledCans() {
      let sum = 0, total = 0;
      for (const r of relays) {
        total += r.cans.length;
        for (const jc of r.cans) sum += (jc.userData.fill || 0) >= .95 ? 1 : 0;
      }
      state.filledCans = sum;
      state.totalCans = total;
    }

    function finishRelayIgnition(r) {
      if (r.lit) return;
      r.lit = true;
      for (const jc of r.cans) jc.userData.setFill(1);
      recomputeFilledCans();
      if (r.poolMesh) {
        r.poolMesh.material = cyanWaterMat;
        r.poolMesh.position.y = 0.56;
        r.poolMesh.scale.set(1.06, 1.06, 1.06);
      }
      if (r.beaconRing) r.beaconRing.material = beaconCyanMat;
      if (r.beaconCol) r.beaconCol.visible = false;
      // Ignite glowing cyan relay beacon lamp & expanding WiFi ring on delivery
      if (!r.deliveryLamp && r.group) {
        const lampOrb = new T.Mesh(
          new T.SphereGeometry(0.24, 14, 10),
          new T.MeshBasicMaterial({ color: 0x3ef0ff })
        );
        lampOrb.position.set(1.8, 4.35, 0);
        r.group.add(lampOrb);
        const lampLight = new T.PointLight(0x28d8f0, 3.4, 28, 1.6);
        lampLight.position.set(1.8, 4.6, 0);
        r.group.add(lampLight);
        r.deliveryLamp = { orb: lampOrb, light: lampLight };
      }
      if (r.covRing) {
        r.covRing.line.visible = true;
        r.covRingExpandT = 0.01;
      }
      state.worldWaterDeliveredL += (r.cans ? r.cans.length * 20 : 20);
      try {
        localStorage.setItem("nightPostWorldV8", JSON.stringify({
          litRelayIds: relays.filter(x => x.lit).map(x => x.id),
          filledCans: state.filledCans,
          worldWaterDeliveredL: state.worldWaterDeliveredL,
          playAs: state.playAs,
          cameraMode: state.cameraMode,
          updatedAt: Date.now()
        }));
      } catch (_) {}
      if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playWaterDeliver === "function") {
        window.HighlandSoundscape.playWaterDeliver();
      }
      if (r.arcLine) r.arcLine.visible = true;
      state.wifiCharge = 1.0;
      state.donkeyWater = 1.0;
      state.donkeyCollapsed = false;
      donkey.state.collapsed = false; donkey.state.downWant = false; donkey.state.stamina = 1.0;
      state.litRelays = relays.filter(x => x.lit).length;
      state.coveragePct = Math.round((state.litRelays / relays.length) * 100);
      if (r.id === "pueblo") {
        for (const m of puebloWinMeshes) m.material = puebloGlowWinMat;
        for (const d of puebloDishes) d.material = beaconCyanMat;
        audio.relayChime(true);
        toast(`PUEBLO SANCTUARY LIT · ${r.cans.length} Jerrycans filled (${state.filledCans}/${state.totalCans})! Mistletoe dances!`);
      } else {
        audio.relayChime(false);
        toast(`${r.name} filled (${r.cans.length} jerrycans · ${state.filledCans}/${state.totalCans})!`);
      }
      triggerDance(5.2, true);
      updateHUD();
    }

    let interruptedRelay = null;
    function startPourAnim(r) {
      if (!r || r.lit || state.pourAnim) return;
      if (state.donkeyCollapsed || state.donkeyWater <= .05) {
        toast("Mistletoe has no water to pour! Press P to give emergency water first.", "Give Mistletoe water first.");
        return;
      }
      interruptedRelay = null;
      state.pourAnim = {
        relay: r, t: 0, dur: 3.2, lastChime: -1,
        fills: r.cans.map(c => c.userData.fill || 0),
        poolMaterial: r.poolMesh?.material,
        poolY: r.poolMesh?.position.y
      };
      audio.pourSplash(0);
      toast(`Mistletoe bows at ${r.name} — pouring cyan WiFi water & filling ${r.cans.length} jerrycans!`, "Filling jerrycans");
    }

    function stopPour() {
      const pour = state.pourAnim;
      if (!pour) return;
      const r = pour.relay;
      r.cans.forEach((can, index) => can.userData.setFill(pour.fills[index]));
      if (r.poolMesh) {
        r.poolMesh.material = pour.poolMaterial;
        r.poolMesh.position.y = pour.poolY;
      }
      pourGroup.visible = false;
      state.pourAnim = null;
      interruptedRelay = r;
      recomputeFilledCans();
      toast("Pour stopped. Tap Pour to retry.");
      updateHUD();
    }

    function triggerDance(dur = 5.2, silentToast = false) {
      if (state.danceTimer > 0 && !silentToast) {
        state.danceTimer = 0;
        toast("Dance stopped");
        updateHUD();
        return;
      }
      if (state.donkeyCollapsed) { toast("Give Mistletoe water first (P)!"); return; }
      state.danceTimer = dur;
      if (state.danceTimer > 0) {
        donkey.soothe(); donkey.bray();
        audio.relayChime(false);
        if (!silentToast) toast("Mistletoe dances the 6/8 Cosmic Addis Eskista!", "Mistletoe dancing");
      }
      updateHUD();
    }
    if ($("btn-dance")) $("btn-dance").addEventListener("click", () => triggerDance());

    function toggleLidar() {
      state.lidarOn = !state.lidarOn;
      state.lidarStrength = state.lidarOn ? 1.0 : 0.0;
      updateHUD();
      toast(state.lidarOn ? "3D USGS Lidar + Song-Zone Flow Path ON (1m/5m contours & signal guide)." : "Lidar Contours OFF.",
        state.lidarOn ? "Lidar on" : "Lidar off");
    }
    if ($("btn-lidar")) $("btn-lidar").addEventListener("click", toggleLidar);

    function syncResonantZone() {
      const zIdx = state.resonantZone;
      const Z = ZONES[clamp(zIdx, 0, 10)];
      state.meteredZone = zIdx;
      state.focusLook = Z.look;
      state.zoneSynced = true;
      state.focusPulse = 1.0;
      audio.forestChime(zIdx);
      updateHUD();
      toast(`Tuned to Song Epoch ${SONG_EPOCHS[state.songEpochIdx].name} (Zone ${ROMAN[zIdx]}) — Conduit Boost ACTIVE!`, `Synced to Zone ${ROMAN[zIdx]}`);
    }
    if ($("btn-sync-zone")) $("btn-sync-zone").addEventListener("click", syncResonantZone);
    if ($("res-pill")) $("res-pill").addEventListener("click", syncResonantZone);

    function deployRig() {
      state.rigDeployed = !state.rigDeployed;
      fieldRigGroup.visible = state.rigDeployed;
      if (state.rigDeployed) {
        const fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
        const rxOff = Math.cos(state.yaw), rzOff = -Math.sin(state.yaw);
        const rx = state.x + fx * 3.1 + rxOff * 1.45, rz = state.z + fz * 3.1 + rzOff * 1.45;
        fieldRigGroup.position.set(rx, driveSurfaceAt(rx, rz), rz);
        fieldRigGroup.rotation.y = state.yaw + Math.PI - .32;
        toast("8×10 Mahogany & Brass Field Camera set on tripod!", "8×10 rig deployed");
      } else toast("8×10 Field Camera packed.", "8×10 rig packed");
      updateHUD();
    }
    if ($("btn-rig")) $("btn-rig").addEventListener("click", deployRig);

    function unlockForestGrove(g) {
      if (g.unlocked) return;
      g.unlocked = true;
      for (const fr of g.fronds) fr.mesh.material = g.awakeMat;
      for (const b of g.banners) b.material = g.awakeMat;
      for (const tip of g.tips) tip.material = beaconCyanMat;
      state.unlockedGroves = forestGroves.filter(x => x.unlocked).length;
      state.unlockedTrees = forestGroves.reduce((s, x) => s + (x.unlocked ? x.trees : 0), 0);
      audio.forestChime(g.id);
      toast(`SIGNAL +${Math.round(state.relElev)}m UNLOCKED "${g.name}" (${state.unlockedGroves}/${forestGroves.length} Film Forest)!`,
        `Forest unlocked · ${state.unlockedGroves}/${forestGroves.length}`);
      updateHUD();
    }

    function checkForestUnlocks() {
      for (const g of forestGroves) {
        if (g.unlocked) continue;
        const dist = Math.hypot(g.x - donkey.state.x, g.z - donkey.state.z);
        if (state.relElev >= g.minRelAlt && dist <= state.signalRadius * 1.45) unlockForestGrove(g);
      }
    }

    function pingSignal() {
      state.pingTimer = 4.2; state.focusPulse = 1.0;
      audio.relayChime(false); checkForestUnlocks();
      toast(`High-Altitude WiFi Signal Ping! Alt ${fmtElev(state.antennaElev)} · Range ${Math.round(state.signalRadius * 1.25)} m.`,
        `Ping · ${Math.round(state.signalRadius * 1.25)} m range`);
    }

    function findPourTarget() {
      let closest = null, bestD = 14;
      for (const r of relays) {
        if (r.lit) continue;
        const d = Math.min(Math.hypot(r.x - state.x, r.z - state.z), Math.hypot(r.x - donkey.state.x, r.z - donkey.state.z));
        if (d < bestD) { bestD = d; closest = r; }
      }
      return closest;
    }

    function pourWifi() {
      const closest = findPourTarget();
      if (closest) {
        if (state.waterLiters <= 0.5) {
          toast("No water aboard to pour — pump at a wellhead or lit cistern first (P).", "No water aboard");
          return;
        }
        startPourAnim(closest);
      } else if (Math.hypot(well.x - state.x, well.z - state.z) < 16) {
        pumpWell();
        pingSignal();
      } else {
        toast("Move within 14 m of an unlit cistern basin with water aboard to pour.", "Move closer to basin");
        pingSignal();
      }
    }
    $("btn-pour").addEventListener("click", pourWifi);

    function pumpWell() {
      state.pumpFlow = 1.0; state.pumpLeverPhase = .01; state.wifiCharge = 1.0;
      state.donkeyWater = 1.0;
      state.waterLiters = 40.0;
      state.donkeyCollapsed = false;
      donkey.state.collapsed = false; donkey.state.downWant = false; donkey.state.stamina = 1.0;
      if (vehPhys && vehPhys.integrity < 99.5) {
        const nearRepair = Math.hypot(well.x - wagon.x, well.z - wagon.z) < 28 ||
          relays.some(r => Math.hypot(r.x - wagon.x, r.z - wagon.z) < 28);
        if (nearRepair) { vehPhys.repair(100); applyWagonVisuals(); }
      }
      audio.pumpClank(); donkey.feed(); donkey.soothe();
      updateHUD();
      toast("Cyan WiFi Water fills carrier & Mistletoe tanks (40.0 kg load · 100% Hydrated)!", "Refilled 40.0 L · 100%");
      if (state.trayTab === "burro") renderTray();
    }
    $("btn-pump").addEventListener("click", pumpWell);
    if ($("btn-revive-water")) $("btn-revive-water").addEventListener("click", pumpWell);

    function toggleCart() {
      if (state.donkeyCollapsed && !state.drivingCart) { toast("Mistletoe collapsed from thirst — press P to give water first!"); return; }
      if (state.gliding && state.donkeyOnRoof) { toggleGlide(); return; }
      state.riding = false;
      state.wagonCruise = 0;
      if (state.gliding) clearGlide();
      state.drivingCart = !state.drivingCart;
      if (state.drivingCart) {
        state.cartYawOffset = 0; state.cartPitchOffset = 0;
        // Mistletoe stays strictly terrain-grounded beside the wagon (never perched on roof)
        state.donkeyOnRoof = false; state.roofMountT = 0;
        if (vehPhys) vehPhys.syncFrom(wagon.x, wagon.y, wagon.z, wagon.heading, driveSurfaceAt);
        state.chaseCamPos.copy(camera.position);
        state.chaseLookAt.set(wagon.x, wagon.y + 1.8, wagon.z);
        toast("Cruiser Woody (4-Wheel Suspension & Slope Gravity ON) · Mistletoe trots beside you on terrain.", "Driving Cruiser Woody");
      } else {
        if (vehPhys) vehPhys.speed = 0;
        wagon.speed = 0; state.donkeyOnRoof = false;
        const dx = wagon.x + Math.cos(wagon.heading) * 2.8, dz = wagon.z - Math.sin(wagon.heading) * 2.8;
        state.x = dx; state.z = dz; state.y = driveSurfaceAt(dx, dz) + 1.68;
        state.yaw = wagon.heading + Math.PI; state.pitch = -.05;
        donkey.place(wagon.x - Math.cos(wagon.heading) * 2.4, wagon.z + Math.sin(wagon.heading) * 2.4, wagon.heading, (x, z) => driveSurfaceAt(x, z));
        toast("Parked Cruiser Woody — Mistletoe waits beside you.", "Wagon parked");
      }
      syncStickVisual();
      sampleMeter();
      updateHUD();
    }
    $("btn-cart").addEventListener("click", toggleCart);
    if ($("btn-reverse")) $("btn-reverse").addEventListener("click", () => {
      if (!state.drivingCart && canStartMotion()) toggleCart();
      if (!state.drivingCart) return;
      setWagonCruise(state.wagonCruise === -1 ? 0 : -1);
      toast(state.wagonCruise < 0
        ? "Reverse drive engaged — backing up! Click Stop Reverse, Brake (X), or W/S to cancel."
        : "Reverse stopped.");
    });

    function clearGlide() {
      state.gliding = false;
      state.glideOpen = 0;
      Object.assign(state.glide, { landing: false, cruising: false, waypoint: null });
      donkeyGlider.visible = false;
      contrailL.line.visible = false;
      contrailR.line.visible = false;
    }

    function glideActionLabel() {
      if (state.gliding) return state.donkeyOnRoof ? (state.glide.landing ? "Cancel landing" : "Land") : "Fold wing";
      return state.drivingCart ? "Take off" : "Base jump / Glide";
    }

    function canCruiseTetons() {
      const g = state.glide;
      return state.gliding && !g.landing && !state.donkeyCollapsed &&
        Math.hypot(mw.tetonRange.x - g.x, mw.tetonRange.z - g.z) > TETON_ARRIVAL_DISTANCE;
    }

    function toggleTetonCruise() {
      if (!state.gliding) return;
      const g = state.glide;
      if (g.cruising) {
        g.cruising = false;
        toast("Cruise stopped · manual flight");
      } else {
        if (!canCruiseTetons()) return;
        g.cruising = true;
        g.waypoint = mw.tetonRange;
        if (useFieldLayout()) {
          releaseFieldInputs();
          showFieldTool("map");
        }
        toast("Cruising to the Teton Range");
      }
      updateHUD();
    }

    function landGlide(announce = true) {
      const g = state.glide, withWagon = state.donkeyOnRoof;
      g.y = driveSurfaceAt(g.x, g.z);
      g.vy = 0;
      clearGlide();
      state.x = g.x; state.z = g.z; state.y = g.y + (withWagon ? 2.0 : 1.65);
      state.yaw = g.heading + Math.PI; state.pitch = -.05;
      state.drivingCart = withWagon;
      state.wagonCruise = 0;
      state.riding = !withWagon;
      if (withWagon) {
        Object.assign(wagon, { x: g.x, y: g.y, z: g.z, heading: g.heading, speed: 0, pitch: 0, roll: 0, steerAngle: 0 });
        wagon.group.position.set(wagon.x, wagon.y, wagon.z);
        wagon.group.rotation.set(0, wagon.heading, 0, "YXZ");
        state.roofMountT = 1;
        poseRoofRider(0);
      } else {
        donkey.place(g.x, g.z, g.heading, driveSurfaceAt);
      }
      if (announce) {
        toast(withWagon ? "Wagon on the ground · Mistletoe aboard" : "Touchdown · mounted");
        updateHUD();
      }
    }

    function toggleGlide(customLaunch = null) {
      if (state.donkeyCollapsed) { toast("Mistletoe needs water before flying! Press P."); return; }
      if (state.gliding && !customLaunch) {
        if (!state.donkeyOnRoof) { landGlide(); return; }
        state.glide.landing = !state.glide.landing;
        state.glide.cruising = false;
        if (useFieldLayout()) releaseFieldInputs();
        toast(state.glide.landing ? "Landing · steer to choose your spot" : "Landing canceled");
        updateHUD();
        return;
      }
      const withWagon = state.drivingCart || (state.gliding && state.donkeyOnRoof);
      const launch = customLaunch ?? (withWagon ? wagon : donkey.state);
      const { x: gx, z: gz } = launch;
      const groundY = driveSurfaceAt(gx, gz);
      const startY = customLaunch ? groundY + customLaunch.boostY : withWagon ? Math.max(wagon.y, groundY + 1.8) :
        Math.max(donkey.group.position.y + 3.2, groundY + 4.8);
      const hdg = customLaunch?.heading ?? (withWagon ? wagon.heading : state.yaw + Math.PI);
      const rel = startY - groundY;
      clearGlide();
      state.drivingCart = false; state.wagonCruise = 0; state.donkeyOnRoof = withWagon; state.riding = false;
      state.gliding = true; state.cartYawOffset = 0; state.cartPitchOffset = 0;
      Object.assign(state.glide, {
        x: gx, y: startY, z: gz, heading: hdg,
        speed: customLaunch ? 29 : withWagon ? clamp(wagon.speed, 22, 35) : 25,
        vy: withWagon ? 13 : customLaunch ? 3.5 : rel > 10 ? -1.8 : 11.5,
        bank: 0, time: 0
      });
      state.x = gx; state.z = gz;
      if (withWagon) {
        // Summit launches can relocate the craft. Keep the rider on its deck during that move.
        if (customLaunch) state.roofMountT = 1;
        poseGlider(0);
      }
      donkeyGlider.scale.setScalar(0);
      donkeyGlider.visible = true;
      for (const p of contrailL.pts) p.set(gx, startY + 2.5, gz);
      for (const p of contrailR.pts) p.set(gx, startY + 2.5, gz);
      const back = withWagon ? 12 : 8;
      const height = withWagon ? 5.0 : 3.4;
      state.chaseCamPos.set(gx - Math.sin(hdg) * back, startY + height, gz - Math.cos(hdg) * back);
      state.chaseLookAt.set(gx + Math.sin(hdg) * 14, startY + (withWagon ? 3.2 : 1.2), gz + Math.cos(hdg) * 14);
      audio.glideWhoosh();
      const airborne = withWagon ? "Wagon airborne · Mistletoe aboard" : "Wing open";
      toast(customLaunch ? `${customLaunch.name} · ${airborne}` : `${airborne} · W dive · S climb · Shift lift`, airborne);
      updateHUD();
    }
    if ($("btn-glide")) $("btn-glide").addEventListener("click", () => toggleGlide());
    $("btn-teton-cruise").addEventListener("click", toggleTetonCruise);

    function launchSummit(idx) {
      const sm = SUMMITS[clamp(idx, 0, SUMMITS.length - 1)];
      setRegion(sm.region);
      state.currentZone = sm.region === "ridge" ? 9 : sm.region === "abyss" ? 8 : 4;
      toggleGlide(sm);
      initRain();
    }

    function teleportZone(zoneIdx) {
      const Z = ZONES[clamp(zoneIdx, 0, 10)];
      state.riding = false; state.drivingCart = false; state.wagonCruise = 0; state.donkeyOnRoof = false;
      clearGlide();
      setRegion(regionAt(Z.x, Z.pz));
      state.x = Z.x - 4.5; state.z = Z.pz + 4.5;
      state.y = driveSurfaceAt(state.x, state.z) + 1.68;
      state.yaw = Math.atan2(-(Z.x - state.x), -(Z.pz - state.z));
      state.pitch = -.04; state.cartYawOffset = 0; state.cartPitchOffset = 0;
      state.focusDist = 18.0; state.focusLook = Z.look; state.focusPulse = 1.0;
      wagon.x = Z.x + 6.5; wagon.z = Z.pz - 5.5; wagon.y = driveSurfaceAt(wagon.x, wagon.z);
      wagon.heading = state.yaw + Math.PI; wagon.speed = 0;
      if (vehPhys) { vehPhys.syncFrom(wagon.x, wagon.y, wagon.z, wagon.heading, driveSurfaceAt); applyWagonVisuals(); }
      else { wagon.group.position.set(wagon.x, wagon.y, wagon.z); wagon.group.rotation.set(0, wagon.heading, 0, "YXZ"); }
      donkey.place(Z.x - 1.5, Z.pz + 2.5, state.yaw + Math.PI, (x, z) => driveSurfaceAt(x, z));
      applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
      initRain(); updateHUD();
      toast(`Arrived at Zone ${ROMAN[Z.z]} · ${Z.name}`, `Arrived · Zone ${ROMAN[Z.z]}`);
    }

    function toggleRegion() {
      if (state.region === "tetons") teleportZone(8); // Abyssal Whale Fluke Sanctuary
      else if (state.region === "abyss") teleportZone(9); // Yosemite Half Dome
      else teleportZone(4); // Tetons Overlook
    }
    if ($("btn-region")) $("btn-region").addEventListener("click", toggleRegion);

    function toggleRide() {
      if (state.donkeyCollapsed && !state.riding) { toast("Mistletoe collapsed from thirst — press P to give water!"); return; }
      if (state.gliding) { toggleGlide(); return; }
      if (state.drivingCart) { state.drivingCart = false; state.wagonCruise = 0; state.donkeyOnRoof = false; }
      if (!state.riding && Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z) > 12) {
        donkey.place(state.x + 1.8, state.z + 1.8, state.yaw + Math.PI, (x, z) => driveSurfaceAt(x, z));
      }
      state.riding = !state.riding; state.leadMode = "lead"; donkey.state.tethered = false;
      state.cartYawOffset = 0; state.cartPitchOffset = 0;
      if (state.riding) {
        const hdg = donkey.state.heading;
        state.chaseCamPos.set(donkey.state.x - Math.sin(hdg) * 5.4, donkey.group.position.y + 2.4, donkey.state.z - Math.cos(hdg) * 5.4);
        state.chaseLookAt.set(donkey.state.x + Math.sin(hdg) * 8, donkey.group.position.y + 1.35, donkey.state.z + Math.cos(hdg) * 8);
      } else {
        state.x = donkey.state.x - Math.cos(donkey.state.heading) * 1.4;
        state.z = donkey.state.z + Math.sin(donkey.state.heading) * 1.4;
        state.y = driveSurfaceAt(state.x, state.z) + 1.68;
        state.yaw = donkey.state.heading + Math.PI;
        state.pitch = -.05;
        applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
      }
      updateHUD();
      toast(state.riding ? "Mounted Mistletoe (3rd-Person Trail Cam) — WASD ride, J Base-Jump!" : "Dismounted.",
        state.riding ? "Mounted Mistletoe" : "Dismounted");
    }
    $("btn-ride").addEventListener("click", toggleRide);

    $("btn-jerikan").addEventListener("click", () => { state.filterIdx = state.filterIdx === 5 ? 0 : 5; updateHUD(); if (state.trayTab === "lens") renderTray(); });
    $("btn-ppc").addEventListener("click", () => { state.ppcOn = !state.ppcOn; updateHUD(); });
    if ($("last-plate-card")) $("last-plate-card").addEventListener("click", () => openPlateBox());

    const invProjView = new T.Matrix4(), projView = new T.Matrix4();
    function renderFrame(nowSec) {
      const w = renderer.domElement.width, h = renderer.domElement.height;
      // 18-Watch Atmospheric Lighting Curve (18:00 Dusk -> Midnight Indigo -> 06:00 Morning Light)
      const wHour = npCarrier().watch / 18;
      const rawLight = wHour < .25 ? lerp(.82, .42, wHour / .25) : wHour < .68 ? .38 : lerp(.38, 1.0, (wHour - .68) / .32);
      const dayLight = (machinima && machinima.isActive()) ? Math.max(rawLight, .84) : rawLight;
      mw.time.value = 8 + nowSec * .08;
      mw.glass.value = state.filterIdx;
      mw.worldLight.intensity = 2.35 * (state.region === "ahiya" ? dayLight * .78 : dayLight * .95);
      hemiFill.intensity = .55 * dayLight;
      mw.worldLight.position.copy(mw.sun.value).multiplyScalar(100);
      mw.abyssAnimate(nowSec);
      if (!(inWorldVideoMode === "youtube" && activeScreenId === "oxbow")) {
        arch.updateArchitecture(nowSec);
      }
      if (inWorldVideoMode !== "mp4") {
        const cinFrame = Math.floor(nowSec * (npScreeningMode ? 12 : 4));
        if (cinFrame !== npLastCinFrame) {
          npLastCinFrame = cinFrame;
          draw2086CinemaFrame(nowSec, npScreeningMode || (state.region === "ahiya" ? "AHIYA" : npState.active === "ahiya" ? "AR-03" : "WF-08"));
        }
      }

      renderFrame._reflTick = ((renderFrame._reflTick || 0) + 1) % 3;
      if (renderFrame._reflTick === 0 && Math.abs(camera.position.x + 480) < 920 && Math.abs(camera.position.z) < 620) {
        const refY = mw.water(clamp(camera.position.x, -1620, -240), clamp(camera.position.z, -400, 400));
        mw.renderReflection(nowSec, w, h, refY, camera);
      }
      mw.updateSkyBasis(camera);
      mw.waterUniforms.uForward.value.copy(mw.skyUniforms.uSkyForward.value);
      mw.waterUniforms.uRight.value.copy(mw.skyUniforms.uSkyRight.value);
      mw.waterUniforms.uUp.value.copy(mw.skyUniforms.uSkyUp.value);
      mw.waterUniforms.uTan.value = Math.tan(camera.fov * Math.PI / 360);
      mw.waterUniforms.uAspect.value = camera.aspect;

      renderer.setRenderTarget(rtScene);
      renderer.render(activeWorld(), camera);

      const lookInfo = LOOKS[state.soloLook >= 0 ? state.soloLook : state.focusLook];
      accMat.uniforms.tCur.value = rtScene.texture;
      accMat.uniforms.tPrev.value = rtA.texture;
      accMat.uniforms.uDamp.value = state.soloLook >= 0 ? lookInfo.trail : .25;
      postQuad.material = accMat;
      renderer.setRenderTarget(rtB);
      renderer.render(postScene, postCam);
      [rtA, rtB] = [rtB, rtA];

      projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      invProjView.copy(projView).invert();
      lookMat.uniforms.uInvProjView.value.copy(invProjView);
      lookMat.uniforms.uInAbyss.value = smooth(185, 115, Math.hypot(camera.position.x - ABYSS_OX, camera.position.z - ABYSS_OZ));
      lookMat.uniforms.uWifiPing.value = state.pingTimer > 0 ? smooth(0, 1.5, state.pingTimer) : 0;

      const uW = lookMat.uniforms.uWifi.value;
      uW[0].set(donkey.state.x, donkey.group.position.y + 2.2, donkey.state.z, state.signalRadius);
      const nearRelays = relays.filter(r => r.lit).sort((a, b) =>
        Math.hypot(a.x - camera.position.x, a.z - camera.position.z) - Math.hypot(b.x - camera.position.x, b.z - camera.position.z));
      for (let i = 0; i < 5; i++) {
        const r = nearRelays[i];
        if (r) uW[i + 1].set(r.x, r.y + 2.0, r.z, r.id === "pueblo" ? 38.0 : 28.0);
        else uW[i + 1].set(0, 0, 0, 0);
      }
      const nearGroves = forestGroves.filter(g => g.unlocked).sort((a, b) =>
        Math.hypot(a.x - camera.position.x, a.z - camera.position.z) - Math.hypot(b.x - camera.position.x, b.z - camera.position.z));
      for (let k = 0; k < 2; k++) {
        const g = nearGroves[k];
        if (g) uW[6 + k].set(g.x, g.y + 8.0, g.z, 26.0 * g.grow);
        else uW[6 + k].set(0, 0, 0, 0);
      }

      lookMat.uniforms.tTrail.value = rtA.texture;
      lookMat.uniforms.uRes.value.set(w, h);
      postQuad.material = lookMat;
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
      syncInWorldCss3d();
      if (machinima) machinima.afterRender(nowSec);
    }

    function captureBounds(width, height) {
      const aspect = height > width ? 4 / 5 : 5 / 4;
      const margin = useFieldLayout() ? .84 : 1;
      const w = Math.round(Math.min(width, height * aspect) * margin);
      const h = Math.round(Math.min(height, width / aspect) * margin);
      return { x: Math.round((width - w) / 2), y: Math.round((height - h) / 2), w, h };
    }

    const tmpRayDir = new T.Vector3(), tmpSample = new T.Vector3();
    function computeFrameWifiPct() {
      const emitters = sampleWifiEmitters();
      const bounds = captureBounds(canvas.width, canvas.height);
      const spanX = useFieldLayout() ? .92 * bounds.w / Math.max(1, canvas.width) : .68;
      const spanY = useFieldLayout() ? .92 * bounds.h / Math.max(1, canvas.height) : .68;
      let sum = 0, count = 0;
      const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
      for (let gy = 0; gy < 4; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          const ndcX = lerp(-spanX, spanX, gx / 4), ndcY = lerp(-spanY, spanY, gy / 3);
          tmpSample.set(ndcX, ndcY, .5).unproject(camera);
          tmpRayDir.copy(tmpSample).sub(camera.position).normalize();
          let hitX = ox + tmpRayDir.x * 110, hitZ = oz + tmpRayDir.z * 110;
          for (let st = 6; st <= 260; st += 16) {
            const sx = ox + tmpRayDir.x * st, sy = oy + tmpRayDir.y * st, sz = oz + tmpRayDir.z * st;
            if (sy <= driveSurfaceAt(sx, sz) + .35) { hitX = sx; hitZ = sz; break; }
          }
          let cov = 0;
          for (const em of emitters) cov = Math.max(cov, smooth(em.r, em.r * .14, Math.hypot(hitX - em.x, hitZ - em.z)));
          sum += cov; count++;
        }
      }
      return clamp(Math.round((sum / count) * 100), 0, 100);
    }

    function activeForwardVec(motion) {
      if (motion === "walk") return { fx: -Math.sin(state.yaw), fz: -Math.cos(state.yaw) };
      const pose = motion === "drive" ? wagon : motion === "glide" ? state.glide : donkey.state;
      const lookHdg = pose.heading + state.cartYawOffset;
      return { fx: Math.sin(lookHdg), fz: Math.cos(lookHdg) };
    }
    function relativeBearing(dx, dz, fx, fz) {
      const rightM = -dx * fz + dz * fx;
      const aheadM = dx * fx + dz * fz;
      const relRad = Math.atan2(rightM, aheadM);
      return { rightM, aheadM, relRad, relDeg: relRad * 180 / Math.PI };
    }
    function turnCueFromDeg(deg) {
      const cues = ["N Ahead", "NE Right", "E Right", "SE Back-R", "S Behind", "SW Back-L", "W Left", "NW Left"];
      return cues[((Math.round(deg / 45) % 8) + 8) % 8];
    }

    const AHIYA_STOPS = ["basalt", "beacon", "hill", "compound"];
    function nearestAhiyaTarget(x, z) {
      const c = npCarrier();
      let pick = null, bestD = Infinity;
      for (const id of AHIYA_STOPS) {
        const st = NP_STATIONS[id];
        if (!st) continue;
        const d = Math.hypot(st.x - x, st.z - z);
        if (!c.visited.includes(id) && d > 18 && d < bestD) {
          pick = { id, name: npWorld.places[id]?.name || id, x: st.x, z: st.z, lit: false };
          bestD = d;
        }
      }
      if (!pick) {
        for (const id of AHIYA_STOPS) {
          if (id === c.place) continue;
          const st = NP_STATIONS[id];
          if (!st) continue;
          const d = Math.hypot(st.x - x, st.z - z);
          if (d < bestD) {
            pick = { id, name: npWorld.places[id]?.name || id, x: st.x, z: st.z, lit: c.visited.includes(id) };
            bestD = d;
          }
        }
      }
      return { relay: pick, distance: bestD };
    }

    function nearestUnlitRelay(x, z) {
      let relay = null, distance = Infinity;
      for (const candidate of relays) {
        if (candidate.lit) continue;
        const range = Math.hypot(candidate.x - x, candidate.z - z);
        if (range < distance) { relay = candidate; distance = range; }
      }
      return { relay, distance };
    }

    function sampleMeter() {
      const dir = new T.Vector3(); camera.getWorldDirection(dir);
      let hitP = null;
      for (let st = 4; st <= 480; st += 12) {
        const sx = camera.position.x + dir.x * st, sy = camera.position.y + dir.y * st, sz = camera.position.z + dir.z * st;
        if (sy <= driveSurfaceAt(sx, sz) + .25) { hitP = { x: sx, y: sy, z: sz }; break; }
      }
      if (hitP && !state.zoneSynced) {
        const base = state.region === "ridge" ? 148.0 : state.region === "abyss" ? 48.0 : 65.5;
        const elev = clamp((hitP.y - base) / 220, .05, .96);
        const fl = FILTERS[state.filterIdx];
        state.meteredZone = clamp(Math.round(elev * (fl.rgb[0] * .3 + fl.rgb[1] * .59 + fl.rgb[2] * .11) * 10), 0, 10);
      } else if (!state.zoneSynced) state.meteredZone = 8;

      state.region = regionAt(state.x, state.z);
      let bestZ = ZONES[4], bestD = 1e9;
      for (const Z of ZONES) {
        if (Z.region !== state.region) continue;
        const d = Math.hypot(Z.x - state.x, Z.pz - state.z);
        if (d < bestD) { bestD = d; bestZ = Z; }
      }
      state.currentZone = bestZ.z;

      const floorY = state.region === "ridge" ? 148.0 : state.region === "abyss" ? 48.0 : 65.5;
      state.antennaElev = donkey.group.position.y + 2.35;
      state.relElev = Math.max(0, state.antennaElev - floorY);
      const pingBoost = state.pingTimer > 0 ? 1.25 : 1.0;
      const syncBoost = state.zoneSynced ? 55 : 0;
      state.signalRadius = clamp((28 + Math.min(220, state.relElev * 1.25) + syncBoost) * (.72 + .28 * state.wifiCharge) * pingBoost, 24, 245);

      const dM = Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z);
      state.signalDbm = Math.round(clamp(-30 - dM * .35 + Math.min(28, state.relElev * .18), -90, -24));
      state.litRelays = relays.filter(r => r.lit).length;
      state.coveragePct = Math.round((state.litRelays / relays.length) * 100);
      state.unlockedGroves = forestGroves.filter(g => g.unlocked).length;
      state.unlockedTrees = forestGroves.reduce((s, g) => s + (g.unlocked ? g.trees : 0), 0);
      state.frameWifiPct = computeFrameWifiPct();
      recomputeFilledCans();

      // Closest active delivery target bearing relative to view forward
      const navTarget = npState.active === "ahiya" ? nearestAhiyaTarget(state.x, state.z) : nearestUnlitRelay(state.x, state.z);
      const nextR = navTarget.relay, nextD = navTarget.distance;
      if (nextR) {
        const navMotion = state.gliding ? "glide" : state.drivingCart ? "drive" : state.riding ? "ride" : "walk";
        const { fx, fz } = activeForwardVec(navMotion);
        state.nextRelayDist = nextD; state.nextRelayName = nextR.name;
        state.nextRelayAzDeg = relativeBearing(nextR.x - state.x, nextR.z - state.z, fx, fz).relDeg;
      } else { state.nextRelayDist = 9999; state.nextRelayName = "Complete"; state.nextRelayAzDeg = 0; }
    }

    function exposePlate() {
      if (contextLost) return;
      if (DEMO && demo.dew) demo.dew.bloom();                                 // the exposure overfills the glass
      audio.shutter();
      if (useFieldLayout()) {
        exposedUntil = performance.now() + 450;
      } else {
        const fl = $("flash"); fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go");
      }
      sampleMeter(); renderFrame(performance.now() * .001);
      const portrait = canvas.height > canvas.width;
      const tmp = document.createElement("canvas"), cw = portrait ? 512 : 640, ch = portrait ? 640 : 512;
      tmp.width = cw; tmp.height = ch;
      const tx = tmp.getContext("2d");
      const crop = captureBounds(canvas.width, canvas.height);
      tx.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, cw, ch);
      splicePlateIntoFilmStrip(tmp, currentPlaceName().slice(0, 14).toUpperCase());
      tx.fillStyle = "rgba(10, 15, 22, 0.80)"; tx.fillRect(0, ch - 34, cw, 34);
      tx.fillStyle = "#22d0ff"; tx.font = "700 13px Inter, system-ui, sans-serif";
      tx.fillText(`WIFI IN-FRAME ${state.frameWifiPct}%  ·  ${state.signalDbm} dBm`, 16, ch - 12);
      tx.fillStyle = "#f1eee6"; tx.textAlign = "right"; tx.font = "600 12px Inter, system-ui, sans-serif";
      const rName = state.region === "ridge" ? "HALF DOME" : state.region === "abyss" ? "ABYSSAL" : "TETONS";
      tx.fillText(`${rName}  ·  Z-${ROMAN[state.meteredZone]}  ·  ALT ${fmtElev(state.antennaElev)}`, cw - 16, ch - 12);
      tx.textAlign = "left";

      const plate = {
        id: (state.plates.at(-1)?.id ?? 0) + 1, zone: state.meteredZone, roman: ROMAN[state.meteredZone],
        place: currentPlaceName(), region: state.region,
        mode: MODES[state.modeIdx].label, look: LOOKS[state.soloLook >= 0 ? state.soloLook : state.focusLook].name,
        focus: state.focusDist.toFixed(1) + " m", stop: STOPS[state.stopIdx].name,
        signalDbm: state.signalDbm, frameWifiPct: state.frameWifiPct, coveragePct: state.coveragePct,
        antennaElev: +state.antennaElev.toFixed(1), unlockedGroves: state.unlockedGroves,
        dataUrl: tmp.toDataURL("image/jpeg", .86)
      };
      state.plates.push(plate);
      plateIndex = -1;
      // Record plate onto active 2086 Night Post circuit log as well
      const curNp = npCarrier();
      if (!curNp.plates.some(p => p.place === curNp.place && p.zone === plate.zone)) {
        curNp.plates.push({ id: plate.id, place: curNp.place, zone: plate.zone, day: curNp.day, maker: npCharter().carrier });
        npState.rev++; saveNpState();
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ plates: state.plates.slice(-22) }));
        plateStorageFault = false;
      } catch {
        plateStorageFault = true;
      }
      updateHUD();
      if (plateStorageFault) toast("Plate in this session. Download to keep it.");
      else toast(`8×10 Plate #${plate.id} Spliced Onto Film Trees! · IN-FRAME WIFI ${plate.frameWifiPct}%`,
        `Plate #${plate.id} · ${plate.frameWifiPct}% WiFi`);
    }
    $("expose-btn").addEventListener("click", exposePlate);

    function openPlateBox() {
      if (useFieldLayout()) {
        selectFieldBand(fieldGroups.findIndex(group => group.name === "Plates"));
        return;
      }
      const box = $("platebox"), grid = $("pl-grid"), big = $("pl-big"), note = $("pl-note");
      const got = new Set(state.plates.map(p => p.zone));
      note.textContent = `${state.plates.length} Plate(s) · ${got.size}/11 Zones · Film Forest ${state.unlockedGroves}/${forestGroves.length} · Jerrycans ${state.filledCans}/${state.totalCans}.`;
      big.hidden = true;
      grid.innerHTML = state.plates.length ? state.plates.slice().reverse().map((p, index) => `
        <button type="button" class="pl-card" data-pid="${state.plates.length - 1 - index}">
          <img src="${p.dataUrl}" alt="Zone ${p.roman} plate">
          <small><strong>#${p.id} · WIFI ${p.frameWifiPct ?? 0}%</strong> (${p.place})<br>Alt ${fmtElev(p.antennaElev ?? 0)} · Forest ${p.unlockedGroves ?? 1}/${forestGroves.length}</small>
        </button>`).join("") : `<p class="tray-note">No coverage plates exposed yet. Press Space or click Expose 8×10.</p>`;
      grid.querySelectorAll("[data-pid]").forEach(btn => {
        btn.onclick = () => { const p = state.plates[+btn.dataset.pid]; if (p) { big.src = p.dataUrl; big.hidden = false; } };
      });
      box.hidden = false;
    }
    $("sp-plates").addEventListener("click", openPlateBox);
    $("pl-close").addEventListener("click", () => { $("platebox").hidden = true; });

    /* ---------- 2-Stage Live 3D Cinematic Intro Choreography ---------- */
    const INTRO_DURATION = 13.6;
    const startPlayerY = driveSurfaceAt(-14.8, 0.8) + 1.68;
    const startYaw = Math.PI * .50, startPitch = -.05;
    const endLookX = -14.8 - Math.sin(startYaw) * Math.cos(startPitch) * 20;
    const endLookY = startPlayerY + Math.sin(startPitch) * 20;
    const endLookZ = 0.8 - Math.cos(startYaw) * Math.cos(startPitch) * 20;
    const yWell = well.y, yDonkey = driveSurfaceAt(-26.0, -1.2);

    const INTRO_SHOTS = [
      {
        t0: 0.0, t1: 3.4,
        fromPos: [-19.2, yWell + 1.32, -8.4], toPos: [-18.4, yWell + 1.48, -6.4],
        fromLook: [well.x + .85, yWell + .38, well.z + .85], toLook: [well.x + .55, yWell + .68, well.z + .55],
        focus0: 2.6, focus1: 3.4, modeIdx: 0,
        kicker: "ACT I · THE WELLHEAD",
        line: "“Iron lever cracks before the rooster — take this cyan WiFi water from my well.”",
        onEnter() { state.pumpFlow = 1.0; state.pumpLeverPhase = .02; audio.pumpClank(); }
      },
      {
        t0: 3.4, t1: 6.8,
        fromPos: [-23.1, yDonkey + 1.28, -3.5], toPos: [-21.6, yDonkey + 1.62, 1.9],
        fromLook: [-26.0, yDonkey + 1.15, -1.1], toLook: [-24.6, yDonkey + 1.35, 1.4],
        focus0: 3.2, focus1: 4.8, modeIdx: 0,
        kicker: "ACT II · MISTLETOE & THE SCION PACK",
        line: "“Cyan jerikan balanced on my shoulder blade — hooves on cobble and the tape is turning.”",
        onEnter() { state.focusPulse = 1.0; audio.relayChime(false); }
      },
      {
        t0: 6.8, t1: 10.4,
        fromPos: [-28.0, 165.0, 14.0], toPos: [-42.0, 189.0, -12.0],
        fromLook: [-180.0, 128.0, -35.0], toLook: [-320.0, 145.0, -18.0],
        focus0: 42.0, focus1: 185.0, modeIdx: 1,
        kicker: "ACT III · ELEVEN TONAL WORLDS",
        line: "“You don’t take a photograph, you make it — Tetons, Abyssal Reef & Half Dome in one world.”",
        onEnter() { state.pingTimer = 3.8; state.focusPulse = 1.0; }
      },
      {
        t0: 10.4, t1: INTRO_DURATION,
        fromPos: [-8.2, 165.5, 5.4], toPos: [-14.8, startPlayerY, 0.8],
        fromLook: [-34.0, 157.0, 0.4], toLook: [endLookX, endLookY, endLookZ],
        focus0: 28.0, focus1: 18.0, modeIdx: state.savedModeBeforeIntro,
        kicker: "ACT IV · SNAKE RIVER OVERLOOK",
        line: "“Carry the cyan up the ridge with me — keep Mistletoe hydrated across every depot.”",
        onEnter() { state.modeIdx = state.savedModeBeforeIntro; state.focusPulse = .85; }
      }
    ];

    function syncIntroUI() {
      document.body.classList.toggle("intro-active", state.introActive);
      if (state.introActive) releaseFieldInputs();
      const sec = $("cinema-intro"), tStage = $("cinema-title-stage"), mStage = $("cinema-montage-stage");
      if (sec) sec.hidden = !state.introActive;
      if (tStage) tStage.hidden = !state.introActive || state.introPhase !== "title";
      if (mStage) mStage.hidden = !state.introActive || state.introPhase !== "montage";
    }

    function resetOverlookScene() {
      setRegion("tetons");
      state.drivingCart = false; state.wagonCruise = 0; state.donkeyOnRoof = false; state.riding = false;
      clearGlide();
      wagon.x = -23.0; wagon.z = 4.6; wagon.y = driveSurfaceAt(wagon.x, wagon.z);
      wagon.heading = -Math.PI * .52; wagon.speed = 0;
      wagon.group.position.set(wagon.x, wagon.y, wagon.z); wagon.group.rotation.set(0, wagon.heading, 0, "YXZ");
      donkey.place(-26.0, -1.2, -Math.PI * .45, (x, z) => driveSurfaceAt(x, z));
      state.x = -14.8; state.z = 0.8; state.y = startPlayerY;
      state.yaw = startYaw; state.pitch = startPitch;
      applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
      initRain();
    }

    function startPrologue() {
      state.savedModeBeforeIntro = state.modeIdx;
      resetOverlookScene();
      state.introActive = true;
      state.introPhase = "montage";
      state.introT = 0;
      state.introShotIdx = -1;
      syncIntroUI();
      if (audioEl.paused) toggleTape();
    }

    function finishIntro(keepCurrentPose = false) {
      if (!state.introActive) return;
      state.introActive = false;
      state.introPhase = "done";
      state.modeIdx = state.savedModeBeforeIntro;
      if (!keepCurrentPose) {
        state.focusDist = 18.0;
        placeAtNpStation(npCarrier().place || "overlook");
      }
      syncIntroUI();
      updateHUD();
      toast("Snake River Overlook · WASD move · C drive Woody · J Base-Jump · K Dance · L Lidar!", "Drag the view to look");
    }

    if ($("intro-roll")) $("intro-roll").addEventListener("click", startPrologue);
    if ($("intro-skip")) $("intro-skip").addEventListener("click", () => finishIntro(false));
    if ($("intro-ahiya")) $("intro-ahiya").addEventListener("click", () => {
      finishIntro(false);
      switchNpCircuit("ahiya");
    });
    if ($("intro-jump")) $("intro-jump").addEventListener("click", () => {
      if (audioEl.paused) toggleTape();
      finishIntro(true);
      launchSummit(0);
    });
    if ($("montage-skip")) $("montage-skip").addEventListener("click", () => finishIntro(false));

    /* ---------- Mobile viewfinder controls ---------- */
    const cycle = (index, count, step) => ((index + step) % count + count) % count;
    const opticsKeys = ["focusDist", "focusLook", "modeIdx", "filterIdx", "stopIdx", "tilt", "soloLook", "groundGlass", "chaseZoom", "ppcOn"];
    const labels = {
      walk: ["On foot", "Move", "", "", "Run"],
      ride: ["Mounted", "Ride", "", "", "Trot"],
      drive: ["Wagon", "Drive", "Fwd", "Reverse", "Turbo"],
      glide: ["Glide", "Steer", "Dive", "Climb", "Lift"]
    };
    const vehicleLabels = { walk: "Drive", drive: "Park", ride: "Dismount" };
    const fieldStick = $("field-stick");
    const fieldHoldButtons = [...document.querySelectorAll("[data-field-key]")];
    const heldPointers = new Map();
    const heldButtons = new Set();
    let stickPointer = null, stickTap = null, stickX = 0, stickY = 0;
    let fieldMotion = "", fieldSettingIndex = 0;
    let opticsUndo = null, armedTravel = null, armedUntil = 0, exposedUntil = 0;
    let plateIndex = -1, fieldPlateURL = "", fieldPlateSource = "", plateStorageFault = false;
    const destinations = [0, 4, 0];
    const shortZones = ["Rim shadow", "Moraine", "Cloud notch", "Bluff pines", "Overlook", "Sage bench", "Silver Ford", "Oxbow", "Reef", "East apron", "Pueblo"];
    const shortSummits = ["Overlook", "Moraine", "Half Dome", "Reef"];
    const tiltStops = [-.32, 0, .32];
    const dotElements = (id, count) => Array.from({length: count}, () => $(id).appendChild(document.createElement("i")));
    const wifiDots = dotElements("field-wifi-scale", 5);
    const toolDots = dotElements("field-tool-dots", 6);
    const canTravel = () => !state.gliding && !state.pourAnim;
    const canMount = () => !state.donkeyCollapsed && !state.pourAnim;
    const canStartMotion = () => canMount() && !state.gliding && !state.drivingCart;
    const canDance = () => state.danceTimer > 0 || canStartMotion();
    const currentMotion = () => state.gliding ? "glide" : state.drivingCart ? "drive" : state.riding ? "ride" : "walk";
    const fieldZone = () => ZONES[destinations[1]];
    const fieldSummit = () => SUMMITS[destinations[2]];
    const selectedFieldPlate = () => plateIndex < 0 ? state.plates.length - 1 : plateIndex;
    const setText = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };

    function setOptics(property, value) {
      if (state[property] === value) return;
      opticsUndo = Object.fromEntries(opticsKeys.map(key => [key, state[key]]));
      state[property] = value;
      applyFieldOptics();
    }
    function applyFieldOptics() {
      state.focusPulse = .85;
      document.body.classList.toggle("ground-glass", state.groundGlass);
      updateHUD();
    }
    function travelWithConfirmation(key, label, run) {
      if (armedTravel === key && performance.now() <= armedUntil) {
        armedTravel = null;
        releaseFieldInputs();
        run();
      } else {
        armedTravel = key;
        armedUntil = performance.now() + 3400;
        toast(`Tap again · ${label}`);
      }
    }
    const changeStep = (property, list, dir) => setOptics(property, cycle(state[property], list.length, dir));
    const fieldTravel = (key, label, run) => () => travelWithConfirmation(key, label(), run);
    const fieldGroups = [
      { band: 4, name: "Lens", settings: [
        { name: "Focus", value: () => `${state.focusDist.toFixed(1)} m`, step: d => setOptics("focusDist", clamp(state.focusDist * 1.16 ** d, 1.2, 900)) },
        { name: "Aperture", value: () => STOPS[state.stopIdx].name, step: d => changeStep("stopIdx", STOPS, d) },
        { name: "Front tilt", value: () => state.tilt < -.08 ? "Near–far" : state.tilt > .08 ? "Reverse" : "Level", step: d => {
          const index = state.tilt < -.08 ? 0 : state.tilt > .08 ? 2 : 1;
          setOptics("tilt", tiltStops[cycle(index, 3, d)]);
        } },
        { name: "Filter", value: () => state.filterIdx === 5 ? "#47B" : FILTERS[state.filterIdx].short, step: d => changeStep("filterIdx", FILTERS, d) },
        { name: "Cloth", value: () => state.groundGlass ? "Open cloth" : "Close cloth", run: () => setOptics("groundGlass", !state.groundGlass) },
        { name: "8×10 rig", value: () => state.rigDeployed ? "Pack tripod" : "Set tripod", run: deployRig },
        { name: "Framing", value: () => state.ppcOn ? "Hide guides" : "Show guides", run: () => setOptics("ppcOn", !state.ppcOn) },
        { name: "Chase zoom", value: () => `${state.chaseZoom.toFixed(1)} m`, show: () => currentMotion() !== "walk",
          step: d => setOptics("chaseZoom", clamp(state.chaseZoom * 1.12 ** d, 4.5, 22)) }
      ] },
      { band: 1, name: "Look", settings: [
        { name: "Shader", value: () => state.soloLook < 0 ? "All zones" : LOOKS[state.soloLook].name,
          step: d => setOptics("soloLook", cycle(state.soloLook + 1, LOOKS.length + 1, d) - 1) }
      ] },
      { band: 6, name: "Mode", settings: [
        { name: "Render", value: () => MODES[state.modeIdx].label, step: d => changeStep("modeIdx", MODES, d) },
        { name: "Focus zone", value: () => `Z‑${ROMAN[destinations[0]]}`, step: d => { destinations[0] = cycle(destinations[0], ZONES.length, d); },
          detail: () => ZONES[destinations[0]].name,
          run: () => {
            const z = ZONES[destinations[0]];
            const before = Object.fromEntries(opticsKeys.map(key => [key, state[key]]));
            state.focusDist = clamp(Math.hypot(z.x - camera.position.x, z.pz - camera.position.z), 1.4, 900);
            state.focusLook = z.look;
            opticsUndo = before;
            applyFieldOptics();
            toast(`Focus · Zone ${ROMAN[z.z]}`);
          } },
        { name: "Travel zone", value: () => `${ROMAN[destinations[1]]} · ${shortZones[destinations[1]]}`, detail: () => fieldZone().name,
          step: d => { destinations[1] = cycle(destinations[1], ZONES.length, d); },
          show: canTravel, confirm: true, run: fieldTravel("Travel zone", () => shortZones[destinations[1]], () => teleportZone(destinations[1])) },
        { name: "Summit jump", value: () => shortSummits[destinations[2]], detail: () => fieldSummit().name,
          step: d => { destinations[2] = cycle(destinations[2], SUMMITS.length, d); },
          show: () => canTravel() && canMount(), confirm: true,
          run: fieldTravel("Summit jump", () => fieldSummit().name, () => launchSummit(destinations[2])) },
        { name: "Glider", value: () => "Unfurl wing", show: canStartMotion, run: () => toggleGlide() },
        { name: "Wagon", value: () => "Drive", show: canStartMotion, run: toggleCart },
        { name: "Shuttle", value: () => state.region === "tetons" ? "To Reef" : state.region === "abyss" ? "To Half Dome" : "To Tetons",
          show: canTravel, confirm: true, run: fieldTravel("Shuttle", () => "Shuttle", toggleRegion) },
        { name: "Lidar", value: () => state.lidarOn ? "Lidar off" : "Lidar on", run: toggleLidar },
        { name: "Prologue", value: () => "Replay", show: canTravel, confirm: true, run: fieldTravel("Prologue", () => "Replay", startPrologue) }
      ] },
      { band: 2, name: "Burro", settings: [
        { name: "Mount", value: () => state.riding ? "Dismount" : "Ride", show: canStartMotion, run: toggleRide },
        { name: "Burro water", value: () => `Pump · ${Math.round(state.donkeyWater * 100)}%`, run: pumpWell },
        { name: "WiFi water", value: () => `${Math.round(state.wifiCharge * 100)}%` },
        { name: "Trust", value: () => `Soothe · ${Math.round(donkey.mind.trust * 100)}%`, run: () => { donkey.soothe(); toast("Mistletoe soothed"); } },
        { name: "Energy", value: () => `Feed · ${Math.round(donkey.state.stamina * 100)}%`, run: () => { donkey.feed(); toast("Mistletoe fed"); } },
        { name: "Bray", value: () => "Call", run: () => { donkey.bray(); toast("Mistletoe brayed"); } },
        { name: "Dance", value: () => state.danceTimer > 0 ? "Stop dance" : "Eskista", show: canDance, run: () => triggerDance() },
        { name: "Pour", value: () => state.pourAnim ? "Stop pour" : "Deliver",
          show: () => !!state.pourAnim || (canMount() && !!findPourTarget()), run: () => state.pourAnim ? stopPour() : pourWifi() },
        { name: "Delivery", value: () => `${state.filledCans}/${state.totalCans} cans` },
        { name: "Forest", value: () => `${state.unlockedGroves}/${forestGroves.length} groves` },
        { name: "Signal", value: () => `${Math.round(state.signalRadius)} m · ${state.signalDbm} dBm` },
        { name: "WiFi", value: () => "Ping", run: pingSignal }
      ] },
      { band: 3, name: "Clocks", settings: [
        { name: "Three clocks", value: () => audio.isOn() ? "Mute" : "Play", run: toggleClocks },
        { name: "Tape", value: () => audioEl.paused ? "Play tape" : "Pause tape", run: toggleTape },
        { name: "Cue ±10 s", value: () => formatMMSS(audioEl.currentTime || 0), step: d => seekTape((audioEl.currentTime || 0) + d * 10, false) },
        { name: "Source", value: () => state.spatialAudio ? "3D burro" : "Cabin", run: toggleSpatialAudio },
        { name: "Resonance", value: () => `Sync Z‑${ROMAN[state.resonantZone]}`, run: syncResonantZone }
      ] },
      { band: 5, name: "Plates", settings: [
        { name: "Inspect", plate: "inspect" },
        { name: "Download", plate: "download", show: () => state.plates.length > 0 },
        { name: "Coverage", value: () => `${new Set(state.plates.map(p => p.zone)).size}/11 zones`, show: () => state.plates.length > 0 }
      ] }
    ].sort((a, b) => a.band - b.band);
    let fieldToolIndex = fieldGroups.findIndex(group => group.name === "Lens");
    const fieldBandPicker = $("field-band-picker");
    const fieldBandToggle = $("field-band-toggle");
    const fieldLens = $("field-lens");
    const fieldMap = $("field-map");
    const fieldMapToggle = $("field-map-toggle");
    const fieldMapCanvas = $("field-map-canvas");
    const fieldBandButtons = [...fieldBandPicker.querySelectorAll("[data-field-band]")];

    function showFieldTool(view) {
      const active = document.activeElement;
      const returnFocus = (view !== "bands" && fieldBandPicker.contains(active)) ||
        (view !== "dial" && fieldLens.contains(active));
      fieldBandPicker.hidden = view !== "bands";
      fieldLens.hidden = view !== "dial";
      fieldMap.hidden = view !== "map";
      $("field-tools").toggleAttribute("data-view", view !== "dial");
      fieldBandToggle.setAttribute("aria-expanded", String(view === "bands"));
      fieldMapToggle.setAttribute("aria-expanded", String(view === "map"));
      armedTravel = null;
      if (returnFocus) (view === "map" ? fieldMapToggle : fieldBandToggle).focus({ preventScroll: true });
    }

    function selectFieldBand(index) {
      fieldToolIndex = index;
      fieldSettingIndex = 0;
      showFieldTool("dial");
      const band = fieldGroups[index].band;
      fieldBandButtons.forEach(button => button.setAttribute("aria-pressed", String(Number(button.dataset.fieldBand) === band)));
      updateHUD();
    }
    fieldBandButtons.forEach(button => button.addEventListener("click", () => {
      const index = fieldGroups.findIndex(group => group.band === Number(button.dataset.fieldBand));
      selectFieldBand(index);
    }));

    const mapRange = 224, reliefCell = 8, reliefSnap = 64;
    const reliefRange = mapRange + reliefSnap / 2 + reliefCell;
    const reliefCells = reliefRange * 2 / reliefCell;
    const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    let mapContext, relief, reliefX, reliefZ;

    function drawFieldRelief(ctx, x, z, fx, fz) {
      // Reuse the same world-aligned samples while the map pans inside a tile.
      const left = Math.round(x / reliefSnap) * reliefSnap - reliefRange;
      const top = Math.round(z / reliefSnap) * reliefSnap - reliefRange;
      if (!relief) {
        relief = document.createElement("canvas");
        relief.width = relief.height = reliefCells;
      }
      if (left !== reliefX || top !== reliefZ) {
        const terrain = relief.getContext("2d");
        if (!terrain) return;
        const heights = new Float32Array(reliefCells ** 2);
        for (let row = 0; row < reliefCells; row++) {
          for (let col = 0; col < reliefCells; col++) {
            heights[row * reliefCells + col] = groundAt(left + (col + .5) * reliefCell, top + (row + .5) * reliefCell);
          }
        }
        const image = terrain.createImageData(reliefCells, reliefCells);
        for (let row = 0; row < reliefCells; row++) {
          for (let col = 0; col < reliefCells; col++) {
            const index = row * reliefCells + col, h = heights[index];
            const west = col ? heights[index - 1] : h, north = row ? heights[index - reliefCells] : h;
            const contour = Math.abs(h - 12 * Math.round(h / 12)) < 1.2 ? 12 : 0;
            const tone = clamp(57 + (west - h) * 2.1 + (north - h) * 1.25 - contour, 24, 110);
            const water = mw.wet(left + (col + .5) * reliefCell, top + (row + .5) * reliefCell) > -.5;
            const pixel = index * 4;
            image.data[pixel] = water ? 19 : tone * .82;
            image.data[pixel + 1] = water ? 67 : tone;
            image.data[pixel + 2] = water ? 83 : tone * 1.14;
            image.data[pixel + 3] = 255;
          }
        }
        terrain.putImageData(image, 0, 0);
        reliefX = left;
        reliefZ = top;
      }
      const span = mapRange * 2 / reliefCell, size = fieldMapCanvas.width, mid = size / 2;
      ctx.save();
      ctx.translate(mid, mid);
      ctx.rotate(Math.atan2(-fx, -fz));
      ctx.drawImage(relief, (x - mapRange - left) / reliefCell, (z - mapRange - top) / reliefCell, span, span, -mid, -mid, size, size);
      ctx.restore();
    }

    function updateFieldMap(motion) {
      const pose = motion === "drive" ? wagon : motion === "glide" ? state.glide : motion === "ride" ? donkey.state : state;
      const { x, z } = pose;
      const { fx, fz } = activeForwardVec(motion);
      const isAhiya = npState.active === "ahiya";
      const waypoint = motion === "glide" ? state.glide.waypoint : null;
      const navTarget = isAhiya ? nearestAhiyaTarget(x, z) : nearestUnlitRelay(x, z);
      const target = waypoint ?? navTarget.relay;
      const distance = waypoint ? Math.hypot(waypoint.x - x, waypoint.z - z) : navTarget.distance;
      const rel = target ? relativeBearing(target.x - x, target.z - z, fx, fz) : { rightM: 0, aheadM: 0, relRad: 0, relDeg: 0 };
      const bearing = target ? Math.atan2(target.x - x, z - target.z) : 0;
      const direction = compass[cycle(0, compass.length, Math.round(bearing * 4 / Math.PI))];
      const cue = turnCueFromDeg(rel.relDeg);
      const delivery = isAhiya ? `${npCarrier().liters}/20 L` : `${state.filledCans}/${state.totalCans} cans`;
      setText("field-map-relay", target?.name ?? (isAhiya ? "Ahiya route" : "All relays lit"));
      const rangeLabel = distance < .5 ? (isAhiya ? "At stop" : "At relay") : `${Math.round(distance)} m ${cue}`;
      if (waypoint) {
        const range = distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
        setText("field-map-route", distance <= TETON_ARRIVAL_DISTANCE ? "Over summit" : `${range} ${cue} (${direction})`);
      } else {
        setText("field-map-route", target ? `${rangeLabel} · ${delivery}` : delivery);
      }

      const size = fieldMapCanvas.width, mid = size / 2, inset = mid - 27, scale = mid / mapRange;
      if (target) {
        const range = Math.min(distance * scale, inset);
        state.mapTargetPx = +(mid + Math.sin(rel.relRad) * range).toFixed(1);
        state.mapTargetPy = +(mid - Math.cos(rel.relRad) * range).toFixed(1);
        state.mapTargetRelDeg = +rel.relDeg.toFixed(1);
      } else {
        state.mapTargetPx = null; state.mapTargetPy = null; state.mapTargetRelDeg = null;
      }

      if (mapContext === undefined) mapContext = fieldMapCanvas.getContext("2d");
      if (!mapContext) return;
      const ctx = mapContext;
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(mid, mid, mid - 2, 0, TAU);
      ctx.clip();
      ctx.fillStyle = "#152b33";
      ctx.fillRect(0, 0, size, size);
      drawFieldRelief(ctx, x, z, fx, fz);
      ctx.strokeStyle = "#b2eef088";
      ctx.lineWidth = 3;
      ctx.stroke();

      const markers = isAhiya
        ? AHIYA_STOPS.map(id => ({ id, x: NP_STATIONS[id].x, z: NP_STATIONS[id].z, lit: npCarrier().visited.includes(id) }))
        : relays;
      for (const cand of markers) {
        if (target && cand.id === target.id) continue;
        const rb = relativeBearing(cand.x - x, cand.z - z, fx, fz);
        const mx = rb.rightM * scale, my = -rb.aheadM * scale;
        if (Math.hypot(mx, my) > inset) continue;
        ctx.beginPath();
        ctx.arc(mid + mx, mid + my, 4, 0, TAU);
        ctx.strokeStyle = "#b2eef0";
        ctx.lineWidth = 1.6;
        if (cand.lit) { ctx.fillStyle = "#b2eef0"; ctx.fill(); }
        else ctx.stroke();
      }
      if (target) {
        const px = state.mapTargetPx, py = state.mapTargetPy;
        ctx.strokeStyle = "#ffe0a3";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(mid, mid); ctx.lineTo(px, py); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#ffe0a3";
        ctx.beginPath(); ctx.moveTo(px, py - 7); ctx.lineTo(px + 7, py);
        ctx.lineTo(px, py + 7); ctx.lineTo(px - 7, py); ctx.closePath(); ctx.fill();
      }
      const rN = mid - 15;
      ctx.fillStyle = "#e9fafa";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "600 16px IBM Plex Mono, monospace";
      ctx.fillText("N", mid - fx * rN, mid + fz * rN);
      ctx.textBaseline = "alphabetic";

      const noseX = pose === state ? -Math.sin(state.yaw) : Math.sin(pose.heading);
      const noseZ = pose === state ? -Math.cos(state.yaw) : Math.cos(pose.heading);
      const noseRel = relativeBearing(noseX, noseZ, fx, fz).relRad;
      ctx.translate(mid, mid);
      ctx.rotate(noseRel);
      ctx.strokeStyle = "#101920";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10);
      ctx.lineTo(0, 6); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (motion === "drive" && (wagon.speed < -.3 || state.wagonCruise < 0)) {
        ctx.fillStyle = "#f5d291";
        ctx.beginPath(); ctx.moveTo(0, 21); ctx.lineTo(-5, 13); ctx.lineTo(5, 13); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    const nearbyActions = {
      stopPour: { label: "Stop pour", run: stopPour },
      water: { label: "Give water", run: pumpWell },
      stopDance: { label: "Stop dance", run: () => triggerDance() },
      pour: { label: "Pour", run: pourWifi },
      pump: { label: "Pump", run: pumpWell },
      takeoff: { label: "Take off", run: () => toggleGlide() },
      tetonCruise: { label: "Fly to Tetons", run: toggleTetonCruise },
      stopCruise: { label: "Stop cruise", run: toggleTetonCruise },
      jump: { label: "Base jump", run: () => toggleGlide() },
      ride: { label: "Ride", run: toggleRide }
    };

    function fieldContext(motion) {
      if (motion === "glide" && state.glide.cruising) return nearbyActions.stopCruise;
      if (state.pourAnim) return nearbyActions.stopPour;
      if (state.donkeyCollapsed || state.donkeyWater < .22) return nearbyActions.water;
      if (state.danceTimer > 0) return nearbyActions.stopDance;
      if (motion === "drive") return nearbyActions.takeoff;
      if (motion === "glide" && canCruiseTetons()) return nearbyActions.tetonCruise;
      if (motion === "ride" && state.relElev > 35 && canStartMotion()) return nearbyActions.jump;
      if (motion !== "walk") return null;
      if (findPourTarget()) return nearbyActions.pour;
      if (Math.hypot(well.x - state.x, well.z - state.z) < 22) return nearbyActions.pump;
      if (Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z) < 12) return nearbyActions.ride;
      return null;
    }

    function fieldSettings() {
      return fieldGroups[fieldToolIndex].settings.filter(s => !s.show || s.show());
    }
    function fieldSetting(settings = fieldSettings()) {
      return settings[fieldSettingIndex % settings.length];
    }
    function stepFieldValue(direction) {
      const setting = fieldSetting();
      armedTravel = null;
      if (setting.plate && state.plates.length) {
        plateIndex = cycle(selectedFieldPlate(), state.plates.length, direction);
      } else setting.step?.(direction);
      updateHUD();
    }
    function syncFieldPlate(plate, operation) {
      const link = $("field-plate-link");
      link.hidden = !plate;
      if (!plate) return;
      if (fieldPlateSource !== plate.dataUrl) {
        if (fieldPlateURL) URL.revokeObjectURL(fieldPlateURL);
        const encoded = plate.dataUrl.split(",")[1];
        const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
        fieldPlateURL = URL.createObjectURL(new Blob([bytes], {type: "image/jpeg"}));
        fieldPlateSource = plate.dataUrl;
        $("field-plate-thumb").src = plate.dataUrl;
        link.href = fieldPlateURL;
      }
      if (operation === "download") link.download = `monolith-plate-${plate.id}.jpg`;
      else link.removeAttribute("download");
      const name = operation === "download" ? "Save plate" : "Open plate";
      link.setAttribute("aria-label", `${name} ${plate.id}, Zone ${plate.roman}, ${plate.place}`);
      setText("field-plate-caption", `#${plate.id} · ${plate.roman}`);
    }
    function updateFieldNotice() {
      const notice = $("field-notice");
      let msg = "";
      if (state.introActive) {
        if (state.introPhase === "montage" && state.introShotIdx >= 0) msg = INTRO_SHOTS[state.introShotIdx].kicker;
      } else if (state.donkeyCollapsed) msg = "Mistletoe needs water";
      else if (state.donkeyWater < .22) msg = `Burro water · ${Math.round(state.donkeyWater * 100)}%`;
      else if (state.pourAnim) msg = `Pouring · ${Math.round(state.pourAnim.t / state.pourAnim.dur * 100)}%`;
      else if (performance.now() < fieldNoticeUntil) msg = fieldNotice;
      else if (plateStorageFault) msg = "Plate in session · download to keep";
      else {
        const c = npCarrier();
        msg = `${npCharter().carrier} · ${c.liters}/20 L (${c.reserve}L chalk) · ${npEngine.clock(c.watch)}`;
      }
      setText("field-notice", msg);
      notice.toggleAttribute("data-warning", !state.introActive && state.donkeyWater < .22);
    }
    function updateFieldHUD() {
      const motion = currentMotion();
      const [label, stickName, pitchUp, pitchDown, boost] = labels[motion];
      const landing = motion === "glide" && state.glide.landing;
      if (fieldMotion !== motion) {
        fieldMotion = motion;
        releaseFieldInputs();
        setText("field-stick-name", stickName);
        setText("field-boost", boost);
        $("field-boost").setAttribute("aria-label", `Hold to ${boost.toLowerCase()}`);
        if ((motion === "drive" || motion === "glide") && !state.introActive) showFieldTool("map");
      }
      setText("field-stick-up", landing ? "" : pitchUp);
      setText("field-stick-down", landing ? "" : pitchDown);
      $("field-boost").hidden = landing;
      const stickLabel = `${stickName}. Drag or use arrow keys.${motion === "glide" && !landing ? " Up to dive, down to climb." : ""}`;
      if (fieldStick.getAttribute("aria-label") !== stickLabel) fieldStick.setAttribute("aria-label", stickLabel);
      let status = label;
      if (motion === "drive") {
        const drvTag = wagon.speed < -.3 || state.wagonCruise < 0 ? "Reverse" : state.wagonCruise > 0 ? "Cruise" : label;
        status = `${drvTag} · ${Math.abs(wagon.speed).toFixed(1)} m/s`;
      }
      if (motion === "glide") {
        const flight = landing ? "Landing" : state.donkeyOnRoof ? "Wagon flight" : label;
        status = `${flight} · ${fmtElev(state.antennaElev)}`;
      }
      setText("field-place", state.introActive ? "Donkey Water" : currentPlaceName());
      setText("field-state", state.introActive ? (state.introPhase === "montage" ? "Prologue" : "Grand Teton") :
        status);
      $("field-wifi").hidden = state.introActive;
      setText("field-wifi-value", `WiFi ${state.frameWifiPct}%`);
      wifiDots.forEach((dot, i) => dot.toggleAttribute("data-lit", state.frameWifiPct > i * 20));
      $("field-pause").hidden = audioEl.paused;
      $("field-undo").hidden = state.introActive || !opticsUndo;
      $("field-progress").hidden = !state.introActive || state.introPhase !== "montage";
      $("field-progress").value = clamp(state.introT / INTRO_DURATION, 0, 1);
      for (const id of ["field-enter", "field-prologue", "field-summit"]) $(id).hidden = state.introPhase !== "title";
      $("field-skip").hidden = state.introPhase !== "montage";
      updateFieldNotice();
      document.body.classList.toggle("field-no-guides", !state.ppcOn);
      if (state.introActive) return;

      setText("field-vehicle", motion === "glide" ? glideActionLabel() : vehicleLabels[motion]);
      $("field-vehicle").hidden = motion === "walk" && !canStartMotion();
      $("field-brake").hidden = !state.drivingCart;
      if ($("field-reverse")) {
        $("field-reverse").hidden = !state.drivingCart;
        $("field-reverse").setAttribute("aria-pressed", String(state.drivingCart && state.wagonCruise < 0));
        setText("field-reverse", state.wagonCruise < 0 ? "Stop rev" : "Reverse");
      }
      if (!fieldMap.hidden) updateFieldMap(motion);
      const context = fieldContext(motion);
      $("field-context").hidden = !context;
      setText("field-context", context?.label ?? "");
      $("field-context").toggleAttribute("data-rescue", context === nearbyActions.water);
      $("field-expose").toggleAttribute("data-exposed", performance.now() < exposedUntil);
      const lastPlate = state.plates.at(-1), orb = $("field-orb-img");
      orb.hidden = !lastPlate;
      if (lastPlate && orb.getAttribute("src") !== lastPlate.dataUrl) orb.src = lastPlate.dataUrl;

      const settings = fieldSettings(), setting = fieldSetting(settings);
      const plate = setting.plate && state.plates[selectedFieldPlate()];
      const adjustable = !!setting.step || (!!plate && state.plates.length > 1);
      const apply = $("field-apply"), value = $("field-value");
      const armed = setting.confirm && armedTravel === setting.name && performance.now() < armedUntil;
      const group = fieldGroups[fieldToolIndex];
      setText("field-tool-name", group.name);
      setText("field-band-code", `B${group.band}`);
      fieldBandToggle.setAttribute("aria-label", `${group.name}, band ${group.band}. Choose a control.`);
      toolDots.forEach((dot, i) => dot.toggleAttribute("data-lit", i === fieldToolIndex));
      setText("field-setting-name", setting.name);
      $("field-setting-next").disabled = settings.length < 2;
      $("field-setting-next").setAttribute("aria-label", settings.length < 2 ? setting.name : `${setting.name}. Tap or swipe to change setting.`);
      $("field-lens").toggleAttribute("data-measure", ["Focus", "Aperture", "Chase zoom"].includes(setting.name));
      const indexMark = $("field-dial-index");
      indexMark.hidden = !adjustable;
      const fractions = {
        Focus: Math.log(state.focusDist / 1.2) / Math.log(900 / 1.2),
        Aperture: state.stopIdx / (STOPS.length - 1),
        "Front tilt": (state.tilt + .35) / .7,
        Filter: state.filterIdx / (FILTERS.length - 1),
        Render: state.modeIdx / (MODES.length - 1),
        Shader: (state.soloLook + 1) / LOOKS.length,
        "Chase zoom": (state.chaseZoom - 4.5) / 17.5,
        "Focus zone": destinations[0] / (ZONES.length - 1),
        "Travel zone": destinations[1] / (ZONES.length - 1),
        "Summit jump": destinations[2] / (SUMMITS.length - 1),
        "Cue ±10 s": Number.isFinite(audioEl.duration) && audioEl.duration > 0 ? audioEl.currentTime / audioEl.duration : 0,
        Inspect: selectedFieldPlate() / Math.max(1, state.plates.length - 1),
        Download: selectedFieldPlate() / Math.max(1, state.plates.length - 1)
      };
      indexMark.style.setProperty("--dial-angle", `${-95 + 190 * (fractions[setting.name] ?? .5)}deg`);
      $("field-choice").toggleAttribute("data-wide", !adjustable);
      $("field-value-prev").hidden = $("field-value-next").hidden = !adjustable;
      $("field-value-prev").setAttribute("aria-label", `Previous ${setting.name.toLowerCase()}`);
      $("field-value-next").setAttribute("aria-label", `Next ${setting.name.toLowerCase()}`);
      value.hidden = !!setting.run || !!plate;
      value.disabled = !setting.step;
      value.toggleAttribute("data-turn", !!setting.step);
      if (!value.hidden) {
        setText("field-value", setting.value?.() ?? "No plates");
        value.setAttribute("aria-label", `${setting.name} ${value.textContent}${setting.step ? ". Tap or drag to adjust." : ""}`);
      }
      apply.hidden = !setting.run;
      apply.toggleAttribute("data-armed", !!armed);
      if (setting.run) {
        setText("field-apply", armed ? "Confirm" : setting.value());
        apply.setAttribute("aria-label", `${armed ? "Confirm " : ""}${setting.name}: ${setting.detail?.() ?? setting.value()}`);
      }
      syncFieldPlate(plate, setting.plate);
    }

    function releaseFieldInputs() {
      stickPointer = null;
      stickTap = null;
      state.wagonCruise = 0;
      setStick(0, 0);
      for (const button of fieldHoldButtons) button.removeAttribute("data-held");
      heldPointers.clear();
      heldButtons.clear();
    }
    const fieldClick = (id, handler) => $(id).addEventListener("click", handler);
    fieldClick("field-value-prev", () => stepFieldValue(-1));
    fieldClick("field-value-next", () => stepFieldValue(1));
    fieldClick("field-apply", () => { fieldSetting().run?.(); updateHUD(); });
    fieldClick("field-pause", () => audioEl.pause());
    fieldClick("field-undo", () => {
      if (!opticsUndo) return;
      Object.assign(state, opticsUndo);
      opticsUndo = null;
      applyFieldOptics();
      toast("Camera adjustment restored");
    });
    fieldClick("field-vehicle", () => {
      if (state.gliding) toggleGlide();
      else if (state.drivingCart) toggleCart();
      else if (state.riding) toggleRide();
      else if (canStartMotion()) toggleCart();
    });
    if ($("field-reverse")) fieldClick("field-reverse", () => {
      if (!state.drivingCart && canStartMotion()) toggleCart();
      if (!state.drivingCart) return;
      setWagonCruise(state.wagonCruise === -1 ? 0 : -1);
      toast(state.wagonCruise < 0 ? "Reverse engaged · backing toward camera" : "Reverse stopped",
        state.wagonCruise < 0 ? "Reverse engaged" : "Reverse off");
    });
    fieldClick("field-brake", () => {
      if (state.wagonCruise !== 0) { setWagonCruise(0); wagon.speed = 0; }
    });
    fieldClick("field-map-toggle", () => {
      showFieldTool(fieldMap.hidden ? "map" : "dial");
      updateHUD();
    });
    fieldClick("field-context", () => fieldContext(currentMotion())?.run());
    fieldClick("field-expose", exposePlate);
    fieldClick("field-enter", () => finishIntro(false));
    fieldClick("field-prologue", () => machinima ? machinima.start("trailer", 0) : startPrologue());
    fieldClick("field-summit", () => $("intro-jump").click());
    fieldClick("field-skip", () => finishIntro(false));

    let dialPointer = null;
    function bindFieldTurn(id, step, tap = () => step(1)) {
      const key = $(id);
      let skipClick = false;
      key.setAttribute("data-turn", "");
      key.addEventListener("pointerdown", e => {
        if (e.button !== 0 || dialPointer || key.disabled) return;
        dialPointer = { key, id: e.pointerId, start: e.clientX };
        skipClick = false;
        key.setPointerCapture(e.pointerId);
      });
      const isDialPointer = e => dialPointer?.key === key && dialPointer.id === e.pointerId;
      key.addEventListener("pointerup", e => {
        if (!isDialPointer(e)) return;
        const delta = e.clientX - dialPointer.start;
        dialPointer = null;
        skipClick = Math.abs(delta) >= 14;
        if (skipClick && !key.disabled) step(Math.sign(delta) * Math.max(1, Math.floor(Math.abs(delta) / 28)));
      });
      for (const type of ["pointercancel", "lostpointercapture"]) {
        key.addEventListener(type, e => { if (isDialPointer(e)) dialPointer = null; });
      }
      key.addEventListener("click", e => {
        if (!key.disabled && (!skipClick || e.detail === 0)) tap();
        skipClick = false;
      });
      key.addEventListener("keydown", e => {
        if (key.disabled || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        e.preventDefault();
        e.stopPropagation();
        step(e.key === "ArrowLeft" ? -1 : 1);
      });
    }
    bindFieldTurn("field-band-toggle", step => selectFieldBand(cycle(fieldToolIndex, fieldGroups.length, step)),
      () => showFieldTool(fieldBandPicker.hidden ? "bands" : "dial"));
    bindFieldTurn("field-setting-next", step => {
      fieldSettingIndex = cycle(fieldSettingIndex, fieldSettings().length, step);
      armedTravel = null;
      updateHUD();
    });
    bindFieldTurn("field-value", stepFieldValue);

    function syncStickVisual() {
      if (stickPointer !== null) return;
      const c = state.drivingCart ? state.wagonCruise : 0;
      if (c !== 0) {
        fieldStick.dataset.cruise = String(c);
        fieldStick.style.setProperty("--stick-x", "0px");
        fieldStick.style.setProperty("--stick-y", `${-c * 22}px`);
      } else {
        delete fieldStick.dataset.cruise;
        fieldStick.style.setProperty("--stick-x", "0px");
        fieldStick.style.setProperty("--stick-y", "0px");
      }
    }
    function setWagonCruise(next) {
      const c = state.drivingCart ? clamp(Math.round(next), -1, 1) : 0;
      if (state.wagonCruise === c) { syncStickVisual(); return; }
      state.wagonCruise = c;
      syncStickVisual();
      updateHUD();
    }
    function setStick(x, y) {
      stickX = x; stickY = y;
      if (stickPointer === null && x === 0 && y === 0) { syncStickVisual(); return; }
      fieldStick.style.setProperty("--stick-x", `${x * 28}px`);
      fieldStick.style.setProperty("--stick-y", `${y * 28}px`);
    }
    function moveStick(event) {
      const {left, top, width, height} = fieldStick.getBoundingClientRect();
      const dx = event.clientX - left - width / 2, dy = event.clientY - top - height / 2;
      if (stickTap) {
        stickTap.maxMove = Math.max(stickTap.maxMove, Math.hypot(event.clientX - stickTap.x0, event.clientY - stickTap.y0));
        if (state.drivingCart && state.wagonCruise !== 0 && stickTap.maxMove >= 14) {
          if (state.wagonCruise < 0 && dy < -10) { state.wagonCruise = 0; delete fieldStick.dataset.cruise; }
          else if (state.wagonCruise > 0 && dy > 10) { state.wagonCruise = 0; delete fieldStick.dataset.cruise; }
        }
      }
      const dist = Math.hypot(dx, dy);
      const scale = dist > 7 ? 1 / Math.max(31, dist) : 0;
      let nx = dx * scale, ny = dy * scale;
      if (state.drivingCart && state.wagonCruise < 0 && dy >= -10) ny = Math.max(ny, .78);
      else if (state.drivingCart && state.wagonCruise > 0 && dy <= 10) ny = Math.min(ny, -.78);
      setStick(nx, ny);
    }
    fieldStick.addEventListener("pointerdown", e => {
      if (stickPointer !== null || e.button !== 0 || state.introActive) return;
      stickPointer = e.pointerId;
      stickTap = { t0: performance.now(), x0: e.clientX, y0: e.clientY, maxMove: 0 };
      armedTravel = null;
      fieldStick.setPointerCapture(e.pointerId);
      moveStick(e);
    });
    fieldStick.addEventListener("pointermove", e => { if (stickPointer === e.pointerId) moveStick(e); });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      fieldStick.addEventListener(type, e => {
        if (stickPointer !== e.pointerId) return;
        const tap = stickTap;
        stickTap = null;
        stickPointer = null;
        stickX = 0; stickY = 0;
        if (type === "pointerup" && tap && state.drivingCart && (performance.now() - tap.t0 < 420) && tap.maxMove < 14) {
          const { top, height } = fieldStick.getBoundingClientRect();
          const dy = e.clientY - (top + height / 2);
          if (dy > 8) {
            setWagonCruise(state.wagonCruise === -1 ? 0 : -1);
            toast(state.wagonCruise < 0 ? "Reverse engaged · backing toward camera" : "Reverse stopped",
              state.wagonCruise < 0 ? "Reverse engaged" : "Reverse off");
          } else if (dy < -8) {
            setWagonCruise(state.wagonCruise === 1 ? 0 : 1);
            toast(state.wagonCruise > 0 ? "Forward cruise engaged" : "Cruise stopped",
              state.wagonCruise > 0 ? "Forward cruise" : "Cruise off");
          } else {
            setWagonCruise(0);
          }
        }
        syncStickVisual();
      });
    }
    for (const button of fieldHoldButtons) {
      button.addEventListener("pointerdown", e => {
        if (e.button !== 0 || state.introActive) return;
        heldPointers.set(e.pointerId, button);
        button.setAttribute("data-held", "");
        button.setPointerCapture(e.pointerId);
      });
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(type, e => {
        heldPointers.delete(e.pointerId);
        if (![...heldPointers.values()].includes(button) && !heldButtons.has(button)) button.removeAttribute("data-held");
      });
      button.addEventListener("keydown", e => {
        if (!["Space", "Enter"].includes(e.code)) return;
        e.preventDefault();
        heldButtons.add(button);
        button.setAttribute("data-held", "");
      });
      for (const type of ["keyup", "blur"]) button.addEventListener(type, e => {
        if (type === "keyup" && !["Space", "Enter"].includes(e.code)) return;
        heldButtons.delete(button);
        if (![...heldPointers.values()].includes(button)) button.removeAttribute("data-held");
      });
    }
    const fieldHeld = code => fieldHoldButtons.some(button => button.dataset.fieldKey === code &&
      (heldButtons.has(button) || [...heldPointers.values()].includes(button)));

    /* ---------- Input Handling ---------- */
    const keys = Object.create(null);
    addEventListener("keydown", e => {
      if (contextLost || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof Element &&
          (e.target.closest("input,textarea,select") || (["Space", "Enter"].includes(e.code) && e.target.closest("a,button")))) return;
      if (state.introActive) {
        if (e.code === "Escape") { e.preventDefault(); finishIntro(false); return; }
        if (state.introPhase === "title" && performance.now() - state.bootMs > 450 && ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp"].includes(e.code)) {
          finishIntro(false);
        } else if (e.code === "Enter" || e.code === "Space") {
          e.preventDefault();
          if (state.introPhase === "title") startPrologue();
          else finishIntro(false);
          return;
        }
      }
      if (e.code === "Escape" && machinima && machinima.isActive()) {
        e.preventDefault();
        machinima.stop();
        return;
      }
      if (e.code === "Escape" && armedTravel) {
        armedTravel = null;
        toast("Travel canceled");
        updateHUD();
        return;
      }
      if (e.code === "Escape" && state.activeDialogueTarget) {
        e.preventDefault();
        closeDialogue();
        return;
      }
      if (e.code === "Escape" && state.bigMapOpen) {
        e.preventDefault();
        setBigMapOpen(false);
        return;
      }
      if (e.code === "Escape" && (!fieldBandPicker.hidden || !fieldMap.hidden)) {
        e.preventDefault();
        showFieldTool("dial");
        return;
      }
      keys[e.code] = true;
      if (state.wagonCruise !== 0 && ["KeyW", "KeyS", "ArrowUp", "ArrowDown", "KeyX"].includes(e.code)) {
        setWagonCruise(0);
      }
      if (e.code === "BracketLeft") { state.focusDist = clamp(state.focusDist * .86, 1.2, 900); state.focusPulse = 1; updateHUD(); }
      else if (e.code === "BracketRight") { state.focusDist = clamp(state.focusDist * 1.16, 1.2, 900); state.focusPulse = 1; updateHUD(); }
      else if (e.code === "KeyC" && !e.repeat) toggleCart();
      else if (e.code === "KeyJ" && !e.repeat) toggleGlide();
      else if (e.code === "KeyR") toggleRegion();
      else if (e.code === "KeyV" && !e.repeat) { if (e.shiftKey) toggleRide(); else toggleCameraMode(); }
      else if (e.code === "KeyP") pumpWell();
      else if (e.code === "KeyF") {
        if (!e.repeat) {
          const pourTgt = findPourTarget();
          if (pourTgt && state.waterLiters > 0.5 && Math.hypot(pourTgt.x - state.x, pourTgt.z - state.z) < 6.0) {
            pourWifi();
          } else {
            triggerSquirtBurst(1.6);
          }
        }
      }
      else if (e.code === "KeyK") triggerDance();
      else if (e.code === "KeyL") toggleLidar();
      else if (e.code === "KeyU" && !e.repeat) { if (machinima) machinima.toggle("trailer"); }
      else if (e.code === "KeyY" && !e.repeat) toggleInWorldVideo();
      else if (e.code === "KeyO" && DEMO && !e.repeat) { startField(); if (field) field.panel(!field.panelOpen); }
      else if (e.code === "KeyN" && DEMO && !e.repeat && state.drivingCart) { if (field && field.radio) field.radio.tune(); }
      else if (e.code === "KeyZ" && DEMO && !e.repeat) { if (demo.withCh && demo.ui) { e.preventDefault(); demo.ui.input.focus(); } }
      else if (e.code === "KeyM" && !e.repeat) toggleBigMap();
      else if (e.code === "Tab") { e.preventDefault(); toggleImmersiveMenu(); }
      else if (e.code === "KeyT") syncResonantZone();
      else if (e.code === "KeyB") deployRig();
      else if (e.code === "KeyH") { state.ppcOn = !state.ppcOn; updateHUD(); }
      else if (e.code === "KeyG" && !e.repeat) throwObject();
      else if (e.code === "Space") {
        e.preventDefault();
        if (e.shiftKey || state.drivingCart || state.gliding) exposePlate();
        else jumpPlayer();
      }
      else if (e.code === "KeyQ") { state.tilt = clamp(state.tilt - .16, -.35, .35); updateHUD(); }
      else if (e.code === "KeyE" && !e.repeat) { interactTalk(); }
      else if (e.code >= "Digit1" && e.code <= "Digit6") { state.filterIdx = +e.code.slice(5) - 1; updateHUD(); }
    });
    addEventListener("keyup", e => { keys[e.code] = false; });

    let lookPointer = null, lastPX = 0, lastPY = 0;
    let clickDownX = 0, clickDownY = 0, clickDownAt = 0;
    const _clickRaycaster = new T.Raycaster();
    const _clickNdc = new T.Vector2();

    function tryRaycastClickTalk(clientX, clientY) {
      if (state.introActive || state.bigMapOpen || contextLost) return false;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      _clickNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _clickNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _clickRaycaster.setFromCamera(_clickNdc, camera);
      const targets = [];
      if (donkey && donkey.group && donkey.group.visible) targets.push(donkey.group);
      if (cast && Array.isArray(cast.list)) {
        for (let i = 0; i < cast.list.length; i++) {
          const ch = cast.list[i];
          if (!ch || !ch.group || !ch.group.visible || ch === activeAvatar) continue;
          targets.push(ch.group);
        }
      }
      if (!targets.length) return false;
      const hits = _clickRaycaster.intersectObjects(targets, true);
      if (!hits.length || hits[0].distance > 42.0) return false;
      let obj = hits[0].object;
      while (obj) {
        if (donkey && obj === donkey.group) {
          const dw = getDonkeyWorldPos(_donkeyWorldTmp);
          openDialogue({
            kind: "donkey",
            npc: null,
            id: "mistletoe",
            name: "Mistletoe",
            jobTitle: "Expedition Donkey",
            jobStatus: state.donkeyCollapsed
              ? "Dehydrated and collapsed — needs cyan water immediately"
              : `Standing ready with 20L saddle pack (${Math.round(clamp(state.donkeyWater, 0, 1) * 100)}% hydrated)`,
            dist: hits[0].distance,
            wx: dw.x, wy: dw.y, wz: dw.z
          });
          return true;
        }
        if (cast && Array.isArray(cast.list)) {
          const found = cast.list.find(c => c && c.group === obj && c !== activeAvatar);
          if (found) {
            const wp = getNpcWorldPos(found, _npcWorldTmp) || found.group.position;
            const info = getNpcDisplayInfo(found);
            openDialogue({
              kind: "npc",
              npc: found,
              id: info.cid,
              name: info.name,
              jobTitle: info.jobTitle,
              jobStatus: info.jobStatus,
              dist: hits[0].distance,
              wx: wp.x, wy: wp.y, wz: wp.z
            });
            return true;
          }
        }
        obj = obj.parent;
      }
      return false;
    }

    canvas.addEventListener("pointerdown", e => {
      if (lookPointer !== null || e.button !== 0 || state.introActive || contextLost) return;
      if (!fieldBandPicker.hidden) showFieldTool("dial");
      lookPointer = e.pointerId;
      lastPX = e.clientX;
      lastPY = e.clientY;
      clickDownX = e.clientX;
      clickDownY = e.clientY;
      clickDownAt = performance.now();
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", e => {
      if (lookPointer !== e.pointerId) return;
      const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
      lastPX = e.clientX; lastPY = e.clientY;
      if (machinima && machinima.onLookDrag(dx, dy)) return;
      if (state.drivingCart || state.gliding || state.riding) {
        state.cartYawOffset = clamp(state.cartYawOffset - dx * .0045, -1.8, 1.8);
        state.cartPitchOffset = clamp(state.cartPitchOffset - dy * .0035, -.45, .45);
      } else {
        state.yaw -= dx * .0045; state.lookDragAt = performance.now();
        state.pitch = clamp(state.pitch - dy * .0038, -.82, .82);
      }
    });
    canvas.addEventListener("pointerup", e => {
      if (lookPointer !== e.pointerId) return;
      lookPointer = null;
      const moved = Math.hypot(e.clientX - clickDownX, e.clientY - clickDownY);
      const elapsed = performance.now() - clickDownAt;
      if (moved < 7 && elapsed < 450) {
        tryRaycastClickTalk(e.clientX, e.clientY);
      }
    });
    for (const event of ["pointercancel", "lostpointercapture"]) {
      canvas.addEventListener(event, e => { if (lookPointer === e.pointerId) lookPointer = null; });
    }

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      if (state.drivingCart || state.gliding || state.riding) {
        state.chaseZoom = clamp(state.chaseZoom * (e.deltaY > 0 ? 1.08 : 0.92), 4.5, 22.0);
      } else {
        state.focusDist = clamp(state.focusDist * (e.deltaY > 0 ? 1.09 : 0.917), 1.2, 900);
        state.focusPulse = 1.0; updateHUD();
      }
    }, { passive: false });

    const knobEl = $("focus-knob");
    let dragKnob = false, knobX0 = 0, knobF0 = 18;
    knobEl.addEventListener("pointerdown", e => { dragKnob = true; knobX0 = e.clientX; knobF0 = state.focusDist; knobEl.setPointerCapture(e.pointerId); e.stopPropagation(); });
    knobEl.addEventListener("pointermove", e => {
      if (!dragKnob) return;
      state.focusDist = clamp(knobF0 * Math.exp((e.clientX - knobX0) * .014), 1.2, 900);
      state.focusPulse = 1.0; updateHUD();
    });
    addEventListener("pointerup", () => { dragKnob = false; });

    function clearInput() {
      lookPointer = null;
      dragKnob = false;
      dialPointer = null;
      for (const key of Object.keys(keys)) delete keys[key];
      releaseFieldInputs();
    }
    addEventListener("blur", clearInput);
    canvas.addEventListener("webglcontextlost", clearInput);
    document.addEventListener("visibilitychange", () => { if (document.hidden) clearInput(); });
    fieldLayoutQuery.addEventListener("change", resize);

    let renderWidth = 0, renderHeight = 0;
    function resize() {
      const fieldLayout = useFieldLayout();
      const layoutChanged = camera.userData.fieldLayout !== fieldLayout;
      if (layoutChanged) {
        document.body.classList.toggle("field-ui", fieldLayout);
        clearInput();
        if (fieldLayout) {
          state.trayTab = null;
          $("rack-tray").hidden = $("platebox").hidden = true;
        } else {
          showFieldTool("dial");
        }
        updateHUD();
      }
      const width = Math.max(2, canvas.clientWidth), height = Math.max(2, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (renderWidth === width && renderHeight === height && !layoutChanged && renderer.getPixelRatio() === dpr) return;
      renderWidth = width; renderHeight = height;
      camera.userData.fieldLayout = fieldLayout;
      if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
      const w = Math.floor(width * dpr), h = Math.floor(height * dpr);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const portraitBoost = clamp(Math.pow(1.05 / Math.max(.40, camera.aspect), .68), 1, 1.56);
      camera.fov = clamp(2 * Math.atan(Math.tan(47 * Math.PI / 360) * portraitBoost) * 180 / Math.PI, 47, 72);
      camera.updateProjectionMatrix();
      rtScene.setSize(w, h); rtA.setSize(w, h); rtB.setSize(w, h);
      const crop = captureBounds(width, height), frame = $("cam-frame");
      frame.style.setProperty("--crop-width", `${crop.w}px`);
      frame.style.setProperty("--crop-height", `${crop.h}px`);
    }
    addEventListener("resize", resize);
    new ResizeObserver(resize).observe(canvas);
    resize();

    /* ---------- Simulation Loop: Unified Open World + Spatial Audio + Flow Puzzle + Hydration + Pour & Eskista Dance ---------- */
    const donkeyHand = new T.Vector3(), halterOut = new T.Vector3(), roofWorldPos = new T.Vector3();
    const tmpCamPos = new T.Vector3(), tmpCamLook = new T.Vector3(), tmpCamFwd = new T.Vector3(); const plantV = new T.Vector3();
    let lastT = null, meterClock = 0;

    function worldBoundsClamp(x, z) {
      const [minX, maxX, minZ, maxZ] = mw.playableBounds;
      return [clamp(x, minX, maxX), clamp(z, minZ, maxZ)];
    }

    function poseRoofRider(dt, pitch = 0, roll = 0) {
      wagon.roofStandSpot.getWorldPosition(roofWorldPos);
      state.roofMountT = Math.min(1, state.roofMountT + dt * 2.8);
      const hop = smooth(0, 1, state.roofMountT), arc = Math.sin(state.roofMountT * Math.PI) * 1.35;
      const x = lerp(state.roofJumpStart.x, roofWorldPos.x, hop);
      const y = lerp(state.roofJumpStart.y, roofWorldPos.y, hop) + arc;
      const z = lerp(state.roofJumpStart.z, roofWorldPos.z, hop);
      donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, () => y);
      Object.assign(donkey.state, { x, y, z, heading: wagon.heading });
      donkey.group.position.set(x, y, z);
      donkey.group.rotation.set(pitch, wagon.heading, roll, "YXZ");
    }

    function poseGlider(dt) {
      const g = state.glide;
      const pitch = clamp(-g.vy * .022, -.42, .32), roll = -g.bank;
      if (state.donkeyOnRoof) {
        Object.assign(wagon, { x: g.x, y: g.y, z: g.z, heading: g.heading, speed: g.speed });
        wagon.group.position.set(g.x, g.y, g.z);
        wagon.group.rotation.set(pitch, g.heading, roll, "YXZ");
        wagon.chassis.position.y = 0;
        wagon.chassis.rotation.set(0, 0, 0);
        poseRoofRider(dt, pitch, roll);
      } else {
        donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 0, drop: 0 }, () => g.y + .22);
        Object.assign(donkey.state, { x: g.x, y: g.y, z: g.z, heading: g.heading });
        donkey.group.position.set(g.x, g.y, g.z);
        donkey.group.rotation.set(pitch, g.heading, roll, "YXZ");
      }
      donkey.group.updateMatrixWorld(true);
    }

    function stepGlide(dt, pitchInput, steer, lift, flowSpeedMult) {
      const g = state.glide;
      if (g.cruising && (lift || Math.abs(steer) > .2 || Math.abs(pitchInput) > .2)) {
        g.cruising = false;
        toast("Cruise stopped · manual flight");
      }
      const surface = driveSurfaceAt(g.x, g.z), clearance = g.y - surface;
      let speed, vertical;
      if (g.cruising) {
        const dx = g.waypoint.x - g.x, dz = g.waypoint.z - g.z;
        const error = Math.atan2(dx, dz) - g.heading;
        const angle = Math.atan2(Math.sin(error), Math.cos(error));
        steer = clamp(-angle * 1.8, -1, 1);
        const cruiseSpeed = lerp(32, 240, smooth(25, 250, clearance));
        speed = Math.min(cruiseSpeed, Math.max(16, Math.hypot(dx, dz) * .45)) * Math.max(.14, Math.cos(angle));
        vertical = clamp((g.waypoint.y + 170 - g.y) * .9, -28, 58);
      } else if (g.landing) {
        speed = clamp(3 + clearance * .045, 3, 13);
        vertical = -clamp(2 + clearance * .25, 2, 64);
      } else if (state.donkeyOnRoof && g.time < .8) {
        speed = 24;
        vertical = 13;
      } else {
        speed = (lift ? lerp(38, 150, smooth(85, 460, clearance)) : pitchInput > .14 ? 46 : pitchInput < -.14 ? 18 : 27) * flowSpeedMult;
        vertical = lift ? lerp(11.5, 35, smooth(45, 240, clearance)) : pitchInput > .14 ? -15.5 : pitchInput < -.14 ? 9.5 : -2.6;
        const ceiling = Math.max(mw.tetonRange.y + 400, surface + 140);
        if (vertical > 0) vertical = Math.min(vertical, Math.max(0, ceiling - g.y));
      }

      g.time += dt;
      const turnRate = lerp(1.75, .45, smooth(45, 235, g.speed));
      g.heading -= steer * turnRate * dt;
      g.bank = lerp(g.bank, steer * (state.donkeyOnRoof ? .32 : .46), 1 - Math.exp(-dt * 8));
      g.speed = lerp(g.speed, speed, 1 - Math.exp(-dt * (g.cruising ? 2.8 : 5)));
      g.vy = lerp(g.vy, vertical, 1 - Math.exp(-dt * 4.5));
      g.y += g.vy * dt;

      const [x, z] = worldBoundsClamp(g.x + Math.sin(g.heading) * g.speed * dt, g.z + Math.cos(g.heading) * g.speed * dt);
      const nextGround = driveSurfaceAt(x, z);
      let contact = surface;
      if (g.cruising && g.vy > 0 && g.y < nextGround + 8) {
        g.speed = 0;
      } else {
        g.x = x;
        g.z = z;
        contact = nextGround;
      }
      if (g.y <= contact + .45 && g.time > .45) { landGlide(); return false; }
      g.y = Math.max(g.y, contact + .45);
      if (g.cruising && Math.hypot(g.waypoint.x - g.x, g.waypoint.z - g.z) <= TETON_ARRIVAL_DISTANCE) {
        g.cruising = false;
        g.speed = Math.min(g.speed, 27);
        toast("Teton Range reached");
      }
      return true;
    }

    /* ---------- AHIYA PLAYABLE DEMO (?demo=ahiya): solid sets and people, human pace, slope-aware wagon, cast who answer ---------- */
    const DEMO = urlParams.get("demo") === "ahiya";
    const demo = { solids: null, grid: new Map(), ui: null, withCh: null, line: null, keep: null };
    /* ---------- Ahiya field sound: real recordings, mixed on six buses, visible in the world ---------- */
    let field = null, fieldStarting = false;
    const AHIYA_SETS = [[-1460, 760], [-1610, 590], [-1765, 540], [-1680, 775]];
    const nearSet = (x, z) => Math.min(...AHIYA_SETS.map(([a, b]) => Math.hypot(x - a, z - b)));
    function startField() {
      if (!DEMO || field || fieldStarting || !window.makeAhiyaSound) return; fieldStarting = true;
      const ctx = audio.context(); if (!ctx) return;
      const at = (x, z, up = 1.4) => new T.Vector3(x, driveSurfaceAt(x, z) + up, z);
      field = window.makeAhiyaSound(T, { ctx, camera, base: "./sound/", anchors: {
        pump: at(-1460, 760, 1.1), beacon: at(-1610, 590, 3), beaconTop: at(-1617, 590, 36), compound: at(-1680, 775, 2.2), compoundYard: at(-1676, 772, 1.2),
        archive: at(-1765, 540, 1.4), dog: at(-1700, 800, .5) } });
      audio.route(field.busInput("music"), field.busInput("synth"));
      field.load().then(() => { fieldReadyAt = performance.now(); }).catch(e => console.warn("field sound", e));
      fetch("./voice/manifest.json").then(r => r.json()).then(m => { demo.voiceMan = m; }).catch(() => { demo.voiceMan = null; });
      audio.connectTape(audioEl); if (audio.setSpatialMode) audio.setSpatialMode(false);   // the tape is the score: through the field mix, not from the donkey
      if (audioEl.paused) { audioEl.volume = 1; audioEl.play().catch(() => { }); }
      // the height range of the real Ahiya ground, for the wind
      let lo = Infinity, hi = -Infinity; for (let x = -1940; x <= -1320; x += 20) for (let z = 380; z <= 950; z += 20) { const y = driveSurfaceAt(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y); } field.lo = lo; field.hi = hi;
    }
    let fieldReadyAt = 0, fieldLast = null, stepAcc = 0;
    const ringPool = [];
    function ring(color) {
      // sound markers: a broken ring on the ground and a thin post, coloured by bus, so they never read as the game's relay rings
      const m = new T.Group(), mat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide });
      for (let i = 0; i < 12; i++) { const seg = new T.Mesh(new T.RingGeometry(.84, 1, 6, 1, i * Math.PI / 6, Math.PI / 9), mat); seg.rotation.x = -Math.PI / 2; m.add(seg); }
      const post = new T.Mesh(new T.CylinderGeometry(.012, .012, 1, 4), mat); post.position.y = .5; m.add(post); m.post = post;
      m.material = mat; m.renderOrder = 20; m.visible = false; mw.world.add(m); return m;
    }
    const BUS_COLOR = { voice: 0xffffff, music: 0xffd27a, radio: 0xff9fd0, ambience: 0x6fb8ff, foley: 0x38e8ff, life: 0x9dff9a, synth: 0xbbbbbb };
    let fieldEdge = null, feetOf = null, feetList = null, fieldPlace = null;
    const fieldV = new T.Vector3();
    function avatarFeet() {
      if (feetOf === activeAvatar) return feetList;
      feetOf = activeAvatar; feetList = [];
      activeAvatar.group.traverse(o => { if (o.isBone && /^foot_[LR]$/i.test(o.name)) feetList.push({ b: o, min: .1, up: false }); });
      if (feetList.length !== 2) feetList = null;
      return feetList;
    }
    function fieldTick(dt) {
      if (!field || !field.ready) return;
      const onFoot = !state.drivingCart && !state.riding && !state.gliding;
      const here = { x: state.x, z: state.z }, moved = fieldLast ? Math.hypot(here.x - fieldLast.x, here.z - fieldLast.z) : 0; fieldLast = here;
      const speed = dt > 0 ? moved / dt : 0, running = speed > 2.3;
      // Footsteps come from the feet you see: each one sounds when the avatar's animated foot bone lands, at that foot.
      // Without a loaded walk clip (or in first person) it falls back to one step per stride of ground covered.
      const surfAt = (x, z) => nearSet(x, z) < 7 ? "stone" : "dirt";
      const loadRate = npCarrier().liters > 12 ? .92 : 1;
      const feet = onFoot && state.cameraMode === "third" && activeAvatar && activeAvatar.group.visible ? avatarFeet() : null;
      if (feet && moved < 3 && speed > .15) {
        for (const f of feet) {
          f.b.getWorldPosition(fieldV); const h = fieldV.y - driveSurfaceAt(fieldV.x, fieldV.z);
          f.min = Math.min(f.min + dt * .05, h);                                   // planted height, slowly re-learnt
          if (h > f.min + .07) f.up = true;
          else if (f.up && h < f.min + .025) { f.up = false; field.footstep({ x: fieldV.x, y: fieldV.y - h + .02, z: fieldV.z, yaw: state.yaw, load: loadRate }, speed, surfAt(fieldV.x, fieldV.z), running); }
        }
        stepAcc = 0;
      } else if (onFoot && moved < 3) {
        stepAcc += moved; const stride = running ? 2.2 : .6;          // the step length of the walk-happy and jog clips at their playback rates
        if (stepAcc > stride) { stepAcc %= stride; const gy = driveSurfaceAt(state.x, state.z); field.footstep({ x: state.x, y: gy + .02, z: state.z, yaw: state.yaw, load: npCarrier().liters > 12 ? .92 : 1 }, speed, nearSet(state.x, state.z) < 7 ? "stone" : "dirt", running); }
      } else stepAcc = 0;
      const gy = driveSurfaceAt(state.x, state.z), dHead = donkey.group.position.clone(); dHead.y += 1.35;
      const thr = (keys.KeyW || keys.ArrowUp) ? 1 : 0;
      const placeNow = npCarrier().place; if (fieldPlace && placeNow !== fieldPlace && field.swell) field.swell(6); fieldPlace = placeNow;   // arriving opens the score up
      // rain is heard by the same rule it is drawn by: it falls only inside the signal discs (sampleWifiEmitters)
      const cp = camera.position; let rainIn = 0, edge = null, edgeD = 1e9;
      for (const em of sampleWifiEmitters()) {
        const R = em.r * .9, d = Math.hypot(cp.x - em.x, cp.z - em.z);
        const dens = clamp(Math.pow(55 / Math.max(20, em.r), .7), .35, 1);      // the same 420 drops spread over a wider disc fall thinner
        rainIn = Math.max(rainIn, dens * clamp(1 - (d - R * .8) / (R * .2 + 4), 0, 1));
        if (d - R < edgeD) { edgeD = d - R; const k = d > 1e-3 ? R / d : 0; edge = (fieldEdge || (fieldEdge = new T.Vector3())).set(em.x + (cp.x - em.x) * k, 0, em.z + (cp.z - em.z) * k); }
      }
      if (edge) edge.y = driveSurfaceAt(edge.x, edge.z) + 2;
      demo.rainIn = rainIn;
      field.update(dt, { rain: rainIn, rainEdge: edgeD > 0 && edgeD < 260 ? edge : null, heightRel: Math.max(0, Math.min(1, (gy - field.lo) / Math.max(1, field.hi - field.lo))), shelter: Math.max(0, 1 - nearSet(state.x, state.z) / 14), speed,
        wagon: { on: state.drivingCart, speed: wagon.speed || 0, throttle: state.drivingCart ? thr : 0, pos: wagon.group.position },
        talking: !!demo.line, watch: npCarrier().watch || 0, compoundOpen: npCarrier().visited.includes("beacon"), donkeyHead: dHead });
      field.drawPanel(dt);
      // sound made visible: a ring on the ground under each source, sized by how loud it is where you stand; a ripple for each hit
      const show = field.panelOpen && field.showRings, now = field.ctx ? 0 : 0;
      let k = 0;
      if (show) {
        for (const E of field.emitters) {
          if (!E.pos || E.target < .01) continue; const m = ringPool[k] || (ringPool[k] = ring(0xffffff)); k++;
          const lv = Math.max(0, (E.level + 70) / 50), y = driveSurfaceAt(E.pos.x, E.pos.z) + .08;
          m.material.color.setHex(BUS_COLOR[E.bus] || 0xffffff); m.position.set(E.pos.x, y, E.pos.z); const sc = .6 + lv * 4 + Math.sin(performance.now() / 300 + k) * .15 * lv; m.scale.set(sc, Math.max(.5, (E.pos.y - y) / Math.max(.3, sc) + .4), sc);
          m.material.opacity = .25 + .55 * Math.min(1, lv); m.visible = true;
        }
        const t = audio.context().currentTime;
        for (const H of field.hits) {
          const age = t - H.t; if (age > .9 || age < 0) continue; const m = ringPool[k] || (ringPool[k] = ring(0xffffff)); k++;
          m.material.color.setHex(BUS_COLOR[H.bus] || 0xffffff); m.position.set(H.pos.x, driveSurfaceAt(H.pos.x, H.pos.z) + .06, H.pos.z);
          m.scale.setScalar(.15 + age * 2.4 * (.6 + H.gain)); m.material.opacity = (1 - age / .9) * .9; m.visible = true;
        }
      }
      for (; k < ringPool.length; k++) ringPool[k].visible = false;
      if (demo.ui) { const b = demo.ui.radioBtn; if (b) { b.hidden = !state.drivingCart; b.textContent = field.radio && field.radio.on ? "Radio · " + field.radio.name : "Radio"; } }
    }
    const DEMO_BOX = [-1976, -1284, 348, 982];
    function demoBuildSolids() {
      demo.solids = []; demo.grid.clear();
      const b = new T.Box3(), c = new T.Vector3(), e = mw.world;
      e.updateMatrixWorld(true);
      const moving = new Set([actorRoot, cast && cast.group, donkey && donkey.group, wagon && wagon.group].filter(Boolean));
      const under = o => { for (let p = o; p; p = p.parent) if (moving.has(p)) return true; return false; };
      e.traverse(o => {
        if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.visible || o.userData.terrain || !o.geometry) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some(m => !m || m.transparent || m.blending === T.AdditiveBlending || m.depthWrite === false)) return;
        if (under(o)) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const lb = o.geometry.boundingBox; if (!lb || !isFinite(lb.min.x)) return;
        b.copy(lb).applyMatrix4(o.matrixWorld); b.getCenter(c);
        if (c.x < DEMO_BOX[0] || c.x > DEMO_BOX[1] || c.z < DEMO_BOX[2] || c.z > DEMO_BOX[3]) return;
        const wx = b.max.x - b.min.x, wz = b.max.z - b.min.z, gy = driveSurfaceAt(c.x, c.z);
        if (Math.max(wx, wz) > 40 || b.max.y - b.min.y < .45 || b.max.y - gy < .7 || b.min.y - gy > 1.5) return;
        const m = o.matrixWorld.elements, sx = Math.hypot(m[0], m[1], m[2]), sy = Math.hypot(m[4], m[5], m[6]), sz = Math.hypot(m[8], m[9], m[10]);
        let ux = 1, uz = 0, hx = wx / 2, hz = wz / 2;
        if (sy > 1e-6 && Math.abs(m[5]) / sy > .9 && sx > 1e-6) {          // upright: keep its own yaw
          ux = m[0] / sx; uz = m[2] / sx; hx = (lb.max.x - lb.min.x) * sx / 2; hz = (lb.max.z - lb.min.z) * sz / 2;
        }
        if (Math.min(hx, hz) < .02) return;                                  // sheets, curtains, screens stay passable
        const sol = { x: c.x, z: c.z, ux, uz, hx, hz, r: Math.hypot(hx, hz) + .6 };
        demo.solids.push(sol);
        for (let gx = Math.floor((sol.x - sol.r) / 6); gx <= Math.floor((sol.x + sol.r) / 6); gx++)
          for (let gz = Math.floor((sol.z - sol.r) / 6); gz <= Math.floor((sol.z + sol.r) / 6); gz++) {
            const k = gx + "," + gz; (demo.grid.get(k) || demo.grid.set(k, []).get(k)).push(sol);
          }
      });
    }
    function demoResolve(x, z, r) {
      if (!demo.solids) demoBuildSolids();
      let hit = false;
      for (let pass = 0; pass < 3; pass++) {
        const list = demo.grid.get(Math.floor(x / 6) + "," + Math.floor(z / 6)); let moved = false;
        if (list) for (const s of list) {
          const dx = x - s.x, dz = z - s.z, lx = dx * s.ux + dz * s.uz, lz = -dx * s.uz + dz * s.ux;
          const px = s.hx + r - Math.abs(lx), pz = s.hz + r - Math.abs(lz);
          if (px <= 0 || pz <= 0) continue;
          if (px < pz) { const d = px * Math.sign(lx || 1); x += d * s.ux; z += d * s.uz; }
          else { const d = pz * Math.sign(lz || 1); x += -d * s.uz; z += d * s.ux; }
          moved = hit = true;
        }
        if (cast) for (const ch of cast.list) {
          if (!ch.group.visible || ch === activeAvatar) continue;
          const dx = x - ch.state.x, dz = z - ch.state.z, d = Math.hypot(dx, dz), need = r + .38;
          if (d < need && d > 1e-4) { x = ch.state.x + dx / d * need; z = ch.state.z + dz / d * need; moved = hit = true; }
        }
        if (r < 1 && donkey && donkey.state && !state.riding) {                // on foot you cannot walk into the donkey
          const dx = x - donkey.state.x, dz = z - donkey.state.z, d = Math.hypot(dx, dz), need = r + 1.0;
          if (d < need && d > 1e-4) { x = donkey.state.x + dx / d * need; z = donkey.state.z + dz / d * need; moved = hit = true; }
        }
        if (!moved) break;
      }
      return [x, z, hit];
    }
    // ---- Conversation: what people know, keyed by topic. c is the carrier's live ledger (liters, reserve, visited, watch). ----
    const DEMO_TOPICS = [
      ["hello", /\b(hi|hello|hey|selam|salam|good (morning|evening|night))\b/],
      ["who", /\b(who are you|your name|who is this|what do you do|what is your (job|work))\b/],
      ["where", /\b(where|which way|road|path|how do i get|how far|direction)\b/],
      ["chalk", /\b(chalk|reserve|mark|four lit)/],
      ["song", /\b(song|take|takes|recording|rehearsal|harmony|verse|chair|music|sing|singing)\b/],
      ["aunt", /\b(aunt|lemlem|custodian|household)\b/],
      ["beacon", /\b(beacon|tower|mast|signal|wifi|white wall|wall)\b/],
      ["archive", /\b(archive|hill|rack|catalog|lacquer|keeper)\b/],
      ["compound", /\b(compound|yard|courtyard|sheet|bowl)\b/],
      ["donkey", /\b(donkey|mule|animal|saddle)\b/],
      ["phone", /\b(phone|show me|let me see|let me hear|play it)\b/],
      ["water", /\b(water|liter|litre|liters|litres|can|jerikan|jerrycan|wet|dry|thirsty)\b/],
      ["thanks", /\b(thanks|thank you|ameseginalehu)\b/],
      ["bye", /\b(bye|goodbye|good bye|i must go|ciao)\b/]
    ];
    // Things you can ask a person to do. Each maps onto an action the water law already allows at this stop.
    const DEMO_ASKS = [
      [/\b(draw|fill|pump|top up)\b/, o => /^pump/.test(o.id), "pump"],
      [/\b(cool|cooling|rack)\b/, o => /cool/i.test(o.id + " " + o.label), "handInspect"],
      [/\b(leave|permission|permit|grant|allow|may i)\b/, o => /permi|leave|grant|sign|ask/i.test(o.id + " " + o.label), "listen"],
      [/\b(write|copy|dock|label|load)\b/, o => /dock|write|copy|load/i.test(o.id + " " + o.label), "deskWrite"],
      [/\b(screen|perform|play it for|show them)\b/, o => /^screen/.test(o.id), "screenWatch"],
      [/\b(listen|hear|earphone)\b/, o => /^listen/.test(o.id), "listen"],
      [/\b(tap|cup|public)\b/, o => /tap/i.test(o.id + " " + o.label), "pour"],
      [/\b(water (the |my )?(donkey|animal)|give (her|him|it) a drink)\b/, o => /^water/.test(o.id), "pour"]
    ];
    const DEMO_STOP_OF = { saba: "basalt", rahel: "beacon", escort_yared: "beacon", convoy_elder_1: "beacon", convoy_elder_2: "beacon", aunt_lemlem: "beacon",
      ppc_op_male: "hill", ppc_op_female: "hill", compound_lead: "compound", compound_partner: "compound", compound_child: "compound" };
    const DEMO_SETS = { basalt: [-1460, 760, "the Basalt Pump"], beacon: [-1610, 590, "the white wall at the Cross-Beacon"], hill: [-1765, 540, "the Hill Archive"], compound: [-1680, 775, "the Daylight Compound"] };
    const DEMO_KB = {
      saba: { who: "“Saba. I keep this pump. I can close the intake even when the map up the hill says the tank is full.”",
        water: c => c.liters <= 0 ? "“Your can is dry. Ask me to draw and I will work the lever, to the chalk and no lower.”" : `“${c.liters} ${c.liters === 1 ? "liter" : "liters"} aboard. The first four are for you and the donkey. The rest is yours to spend.”`,
        chalk: "“The chalk line is the well’s reserve. Draw below it and I close this pump for two shift changes.”",
        donkey: "“She is mine, the gray one. A wet saddle keeps a recording in order while it moves. Keep her watered.”",
        song: "“Rahel wants the rehearsal from over the ridge. Songs are her business. Water is mine.”" },
      rahel: { who: "“Rahel. I run sound on the night route. I know the singers by the chairs they move before a take.”",
        song: "“Three rehearsal takes. In the third a chair scrapes stone just before the first note. That is the one.”",
        aunt: "“My aunt keeps the takes. She is at the white wall. Ask her leave yourself, she likes to be asked.”",
        phone: "Rahel turns the screen toward you. Three waveforms, the third with a small spike before it starts. “There. The chair.”",
        water: "“A dry can loses its traveling copies. Keep it wet until the hill has written the label.”" },
      aunt_lemlem: { who: "“Lemlem. Those three takes are in my keeping.”",
        song: "“He came in early on the held note and we all followed him. Keep the wrong one too. It is the only one where we came in together.”",
        aunt: "“Listening at home, yes. In public once, and only if I am standing there to sing the answer myself.”",
        water: c => c.liters <= 0 ? "“A song does not travel in an empty can. Come back wet.”" : "“Good. Then it can travel. Ask me for leave and I will give it.”" },
      escort_yared: { who: "“Yared. I film the convoy so the hill has a record of who walked.”", phone: "Yared tips his phone so you can see the lamps strung along the trail.",
        where: null },
      convoy_elder_1: { who: "“Gebre. I walk with the lamps.”", beacon: "“The beacon is for finding the road. The singing is for the people already on it.”" },
      convoy_elder_2: { who: "“Solomon. I carry and I witness the signal.”", water: "“Carry it level. Spilled water forgets.”" },
      ppc_op_male: { who: "“Daniel. I keep the log for the rack.”",
        archive: c => c.liters - c.reserve < 9 ? "“The rack takes nine liters above your chalk mark and you are short. The pump is downhill.”" : "“Nine for cooling and I can open the inner rack. Ask me to cool it.”",
        water: c => { const n = Math.max(0, c.liters - c.reserve); return `“You have ${n} ${n === 1 ? "liter" : "liters"} above the mark. The rack wants nine.”`; },
        song: "“Three versions of that verse turn up in the catalog once the rack is cool.”" },
      ppc_op_female: { who: "“Hanna. Radio and the monitor.”",
        archive: c => !c.visited.includes("beacon") ? "“No leave from the white wall, no copy from this window.”" : "“I will label the lacquer with the aunt as custodian. Both singers stay on the take. Ask me to write it.”",
        aunt: "“Her name goes on the seal. That is the rule here.”", phone: "Hanna turns the monitor. The route is drawn in cyan where the cans are wet." },
      compound_lead: { who: "“Tesfaye. I unload and I pour.”",
        compound: c => c.liters <= c.reserve ? "“Not from your reserve. We wait.”" : "“Set it by the root bowl. Three liters wakes the sheet. Ask me to screen it when the aunt has given leave.”",
        water: c => c.liters <= c.reserve ? "“That is travel water. I will not take it.”" : "“Three liters for the sheet. The rest goes on with you.”" },
      compound_partner: { who: "“Desta. I see to the hitch.”", song: "“She sang it wrong the first time and we all came in together. Keep that one.”", donkey: "“Bring her in the shade. The hitch post is by the wall.”" },
      compound_child: { who: "“Biruk.”", phone: "Biruk tilts the tablet toward you. The route glows where the cans are wet and nowhere else.", beacon: "“When you can see the mast, the tablet works. Behind the ridge it does not.”" }
    };
    const DEMO_SEND = { water: "saba", chalk: "saba", donkey: "saba", song: "rahel", aunt: "aunt_lemlem", beacon: "aunt_lemlem", archive: "ppc_op_male", compound: "compound_lead" };
    function demoDirections(toId) {
      const s = DEMO_SETS[toId]; if (!s) return "";
      const dx = s[0] - state.x, dz = s[1] - state.z, d = Math.hypot(dx, dz), rise = driveSurfaceAt(s[0], s[1]) - driveSurfaceAt(state.x, state.z);
      const brg = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360, comp = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(brg / 45) % 8];
      return `${s[2][0].toUpperCase() + s[2].slice(1)} is ${Math.round(d / 5) * 5} meters ${comp}, ${Math.abs(rise) < 3 ? "nearly level" : rise > 0 ? `${Math.round(rise)} meters up` : `${Math.round(-rise)} meters down`}.`;
    }
    const DEMO_NAMES = { saba: "Saba", rahel: "Rahel", aunt_lemlem: "Aunt Lemlem", escort_yared: "Yared", convoy_elder_1: "Abba Gebre", convoy_elder_2: "Memhir Solomon",
      ppc_op_male: "Daniel", ppc_op_female: "Hanna", compound_lead: "Tesfaye", compound_partner: "Abba Desta", compound_child: "Biruk" };
    const demoName = ch => DEMO_NAMES[ch.state.id] || String(ch.state.name).replace(/\s*\(.*\)\s*/, "");
    // What a person says aloud is only what sits inside “…”; the rest is subtitle (numbers, meters, what the water law logged).
    // Every spoken line comes from a finite set, so each one has a recorded Kokoro voice (night-post/voice/).
    const DEMO_POINT = { basalt: "That way, down to the pump.", beacon: "Up there, to the white wall.", hill: "That way, up the hill to the archive.", compound: "Down that way, to the yard." };
    const DEMO_ABOUT = { who: "my work", water: "the water", chalk: "the chalk mark", song: "the song", aunt: "the aunt’s leave", beacon: "the beacon", archive: "the rack", compound: "the yard", donkey: "the donkey", phone: "my phone" };
    function demoAnswer(ch, text) {
      const NAME = demoName(ch), id = ch.state.id, c = npCarrier(), kb = DEMO_KB[id] || {}, t = " " + text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ") + " ";
      // 1. a request: try the action the law allows here, and let the person report the outcome
      for (const [re, pick, pose] of DEMO_ASKS) if (re.test(t)) {
        let opts = []; try { opts = npEngine.options(npState) || []; } catch (e) { opts = []; }
        const o = opts.find(pick);
        if (o && DEMO_STOP_OF[id] === c.place) {
          if (!o.enabled) return { say: `“Not yet.” ${o.reason || ""}`, emotion: "determined_focus" };
          const before = c.liters, r = runNpAction(o.id, true), after = npCarrier(), log = after.log && after.log.at(-1) ? after.log.at(-1).text : "";
          if (r && r.ok === false) return { say: `“Not here.” ${r.reason || ""}`, emotion: "determined_focus" };
          const delta = after.liters - before;
          return { say: "“There.” " + (log ? log.slice(0, 230).replace(/[“”]/g, "") : "") + (delta ? ` (${delta > 0 ? "+" : ""}${delta} L)` : ""), pose, emotion: "happy_joy", hold: 3.2, action: o.id };
        }
        if (o) break;
      }
      // 2. a topic this person knows, else point to who does
      for (const [topic, re] of DEMO_TOPICS) if (re.test(t)) {
        if (topic === "hello") return { say: `“Selam.” ${NAME} looks at your can: ${c.liters} L. ` + (c.liters > 0 ? "“Good.”" : "“Dry, I see.”"), pose: "wave", hold: 1.6 };
        if (topic === "thanks") return { say: "“Go well.”", emotion: "happy_joy" };
        if (topic === "bye") return { say: "“Mind the grade in the dark.”", pose: "wave", hold: 1.6, end: true };
        if (topic === "where") {
          const named = Object.keys(DEMO_SETS).find(k => new RegExp(k === "basalt" ? "pump|basalt|water" : k === "beacon" ? "beacon|wall|aunt|mast" : k === "hill" ? "hill|archive|rack" : "compound|yard|sheet").test(t));
          const next = named || ["basalt", "beacon", "hill", "compound"].find(k => !c.visited.includes(k)) || "compound";
          return { say: `${NAME} points. “${DEMO_POINT[next]}” ${demoDirections(next)}`, gesture: "pointing_call", pointTo: next };
        }
        let line = kb[topic]; if (typeof line === "function") line = line(c);
        if (line) return { say: line, pose: topic === "phone" ? "holdPhone" : (topic === "song" && id === "aunt_lemlem" ? "sing" : null), phone: topic === "phone", hold: topic === "phone" ? 4 : 0 };
        const to = DEMO_SEND[topic], who = to && cast.byId && cast.byId[to] ? demoName(cast.byId[to]) : null;
        if (who && to !== id) return { say: `“That is for ${who}.” ${demoDirections(DEMO_STOP_OF[to])}`, gesture: "pointing_call", pointTo: DEMO_STOP_OF[to] };
      }
      const know = Object.keys(kb).filter(k => kb[k] && DEMO_ABOUT[k]).slice(0, 3).map(k => DEMO_ABOUT[k]);
      return { say: `${NAME} waits. “Ask me about ${know.length ? know.join(know.length > 2 ? ", " : " or ") : "the road"}.”`, emotion: "determined_focus" };
    }
    function demoUi() {
      if (demo.ui) return demo.ui;
      const el = document.createElement("div");
      el.innerHTML = `<style>
        .dm{position:fixed;z-index:60;font:14px/1.45 system-ui,sans-serif;color:#e9f6fb}
        .dm[hidden],.dm [hidden]{display:none!important}
        #demo-bub{max-width:min(340px,70vw);background:rgba(8,20,30,.92);border:1px solid #38e8ff;border-radius:10px;padding:8px 12px;transform:translate(-50%,-100%);pointer-events:none}
        #demo-bub b{display:block;font-size:12px;color:#8fd0de;font-weight:600}
        #demo-you{left:50%;bottom:calc(132px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:rgba(233,246,251,.92);color:#0b1a22;border-radius:10px;padding:6px 12px;max-width:min(420px,80vw)}
        #demo-say{left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:flex;gap:6px;width:min(460px,calc(100vw - 32px))}
        #demo-say input{flex:1;min-width:0;font:14px system-ui,sans-serif;padding:8px 10px;background:rgba(8,20,30,.92);color:#e9f6fb;border:1px solid #38e8ff;border-radius:8px}
        #demo-say button,#demo-phone button,#demo-brief button{font:12px system-ui,sans-serif;padding:6px 10px;background:#0b2a38;color:#e9f6fb;border:1px solid #38e8ff;border-radius:8px;cursor:pointer}
        #demo-say button[aria-pressed="true"]{background:#38e8ff;color:#06222c}
        #demo-phone{right:max(10px,env(safe-area-inset-right,0px));top:calc(10px + env(safe-area-inset-top,0px));width:min(250px,calc(100vw - 20px));background:rgba(10,17,22,.94);border:1px solid #26343c;border-radius:16px;padding:9px 12px;box-shadow:0 0 24px rgba(56,232,255,.18)}
        #demo-phone.shut{width:auto;min-width:150px}
        #demo-phone.shut #demo-los,#demo-phone.shut #demo-thread,#demo-phone.shut #demo-btns{display:none}
        #demo-phone h4{margin:0 0 6px;font:600 11px system-ui,sans-serif;letter-spacing:.08em;color:#8fd0de;display:flex;justify-content:space-between;gap:10px;cursor:pointer}
        #demo-phone h4 em{font-style:normal;color:#5e7f89;font-weight:400}
        #demo-can{position:relative;height:10px;background:#12232c;border-radius:6px;overflow:hidden}#demo-can i{position:absolute;inset:0 auto 0 0;background:#38e8ff}
        #demo-can u{position:absolute;top:0;bottom:0;left:20%;width:2px;background:#fff}
        #demo-phone p{margin:5px 0 0;font-size:12px;color:#b9d7df}#demo-thread{margin-top:8px;display:flex;flex-direction:column;gap:4px;max-height:140px;overflow:hidden;justify-content:flex-end}
        #demo-thread span{font-size:11.5px;line-height:1.3;padding:4px 7px;border-radius:8px;background:#12232c;align-self:flex-start;max-width:100%}
        #demo-thread span.me{background:#38e8ff;color:#06222c;align-self:flex-end}
        #demo-btns{display:grid;grid-template-columns:1fr 1fr;gap:6px}#demo-btns button{min-height:36px}
        #demo-brief{left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;background:rgba(6,14,20,.95);border:1px solid #2c6b78;border-radius:14px;padding:18px 20px;z-index:70}
        #demo-brief h3{margin:0 0 2px;font:600 18px/1.2 Georgia,serif;color:#fff}#demo-brief .sub{margin:0 0 10px;color:#8fd0de;font-size:12px;letter-spacing:.06em;text-transform:uppercase}
        #demo-brief p{margin:0 0 10px}#demo-brief .keys{color:#b9d7df;font-size:13px;border-top:1px solid #1d3540;padding-top:10px}
        #demo-brief button#demo-brief-ok{width:100%;min-height:44px;font-size:15px;background:#38e8ff;color:#06222c;border:0;font-weight:600}
        body.demo-mode #play-bar,body.demo-mode #quest-tracker,body.demo-mode #cinema-intro,body.demo-mode #field-intro,body.demo-mode .letterbox,body.demo-mode #cloth{display:none!important}
        body.demo-clean #top-left,body.demo-clean #reel-col,body.demo-clean #rack-tray,body.demo-clean #wedge-wrap,body.demo-clean #focus-dock,body.demo-clean #keys,
        body.demo-clean #ppc-hud,body.demo-clean #inworld-video-bar,body.demo-clean #field-status,body.demo-clean #field-tools,body.demo-clean #field-actions,body.demo-clean #np-radio-host,body.demo-clean .hs-radio-hud{display:none!important}
        #demo-sig{display:inline-flex;gap:2px;align-items:flex-end;height:12px}#demo-sig i{width:4px;background:#26343c;border-radius:1px}#demo-sig i.on{background:#38e8ff}
        #demo-sig i:nth-child(1){height:4px}#demo-sig i:nth-child(2){height:7px}#demo-sig i:nth-child(3){height:10px}#demo-sig i:nth-child(4){height:12px}
        #demo-phone h4{cursor:pointer}
        #demo-phone h4{cursor:pointer}
        body.demo-touch #demo-say{display:none}
        body.demo-touch.demo-typing #demo-say{display:flex!important;left:12px;right:12px;width:auto;transform:none;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:80}
        body.demo-typing #dk-ctx,body.demo-typing #dk-pad{display:none}
        body.rain2 .dk,body.rain2 #demo-say,body.rain2 #demo-you,body.rain2 #demo-bub,body.rain2 #demo-phone,body.rain2 #field-move{display:none!important}
        /* ---- dew: every control is water on the lens; you see the world through it ---- */
        #demo-bub,#demo-you{display:none!important}
        #dk-status,#dk-menu-btn,#dk-pad button,#dk-jump,#dk-ctx .verb,#dk-chips button,.dk .bead{
          background:radial-gradient(130% 140% at 28% 18%,rgba(255,255,255,.30) 0,rgba(255,255,255,.07) 34%,rgba(6,22,30,.20) 68%,rgba(0,8,12,.44) 100%)!important;
          -webkit-backdrop-filter:blur(2.5px) saturate(1.6) brightness(1.18);backdrop-filter:blur(2.5px) saturate(1.6) brightness(1.18);
          border:1px solid rgba(255,255,255,.34)!important;color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 8px rgba(0,10,16,.85);
          box-shadow:inset 0 -7px 12px rgba(255,255,255,.13),inset 0 6px 9px rgba(0,8,12,.30),0 5px 14px rgba(0,0,0,.38)!important}
        #dk-ctx .verb:not(.alt),#dk-menu-btn.on,.dk .bead.on,#dk-pad button.on{background:radial-gradient(130% 140% at 28% 18%,rgba(255,255,255,.42) 0,rgba(56,232,255,.34) 36%,rgba(20,150,180,.36) 70%,rgba(0,40,56,.6) 100%)!important;border-color:rgba(160,245,255,.75)!important}
        #dk-ctx .verb.urgent{background:radial-gradient(130% 140% at 28% 18%,rgba(255,255,255,.4) 0,rgba(255,110,90,.5) 40%,rgba(120,20,10,.6) 100%)!important}
        #dk-pad #dk-expose{background:radial-gradient(120% 120% at 30% 22%,rgba(255,255,255,.62) 0,rgba(255,255,255,.16) 36%,rgba(10,30,40,.2) 70%,rgba(0,8,12,.5) 100%)!important;border:2px solid rgba(255,255,255,.7)!important}
        #dk-ctx .verb,#dk-chips button{animation:dew-in .45s cubic-bezier(.2,.9,.3,1.2) both}
        @keyframes dew-in{from{transform:scale(.3);opacity:0;filter:blur(5px)}to{transform:none;opacity:1;filter:none}}
        #dk-menu-btn{width:52px;min-width:52px;height:44px;padding:0;border-radius:50% 50% 50% 50%/42% 42% 58% 58%;font-size:12px;font-weight:600}
        #dk-rail{right:max(10px,env(safe-area-inset-right,0px));top:calc(62px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:8px;align-items:center;width:52px}
        #dk-rail[hidden],#dk-row[hidden]{display:none}
        #dk-rail .bead{width:46px;height:46px;border-radius:50%;font-size:10.5px;font-weight:600;padding:0;animation:dew-in .4s cubic-bezier(.2,.9,.3,1.2) both}
        #dk-rail .bead:nth-child(2){animation-delay:.05s}#dk-rail .bead:nth-child(3){animation-delay:.1s}#dk-rail .bead:nth-child(4){animation-delay:.15s}
        #dk-row{left:max(10px,env(safe-area-inset-left,0px));right:calc(70px + env(safe-area-inset-right,0px));top:calc(60px + env(safe-area-inset-top,0px));display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding:2px 2px 20px;-webkit-mask-image:linear-gradient(90deg,#000 88%,transparent);mask-image:linear-gradient(90deg,#000 88%,transparent)}
        #dk-row::-webkit-scrollbar{display:none}
        #dk-row .bead{flex:none;position:relative;width:52px;height:52px;border-radius:50%;padding:0;animation:dew-in .4s cubic-bezier(.2,.9,.3,1.2) both;background-size:cover!important;background-position:center!important}
        #dk-row .bead:nth-child(n+2){animation-delay:.04s}#dk-row .bead:nth-child(n+4){animation-delay:.09s}#dk-row .bead:nth-child(n+6){animation-delay:.14s}
        #dk-row .bead i{font:600 11.5px system-ui,sans-serif;font-style:normal;display:block;max-width:46px;margin:0 auto;overflow:hidden;white-space:nowrap}
        #dk-row .bead em{position:absolute;left:50%;top:100%;transform:translateX(-50%);margin-top:3px;font:500 10px system-ui,sans-serif;font-style:normal;letter-spacing:.06em;color:#dff4fa;white-space:nowrap;text-shadow:0 1px 2px #000,0 0 6px rgba(0,10,16,.9)}
        #dk-row .bead.pic i{font-size:13px}
        .dk-plate{left:50%;top:36%;width:min(46vw,230px);aspect-ratio:1;object-fit:cover;border-radius:50%;transform:translate(-50%,-50%) scale(.1);opacity:0;pointer-events:none;z-index:79;border:2px solid rgba(255,255,255,.6);box-shadow:inset 0 0 30px rgba(0,0,0,.5),0 10px 30px rgba(0,0,0,.5);transition:transform .5s cubic-bezier(.2,.9,.3,1.15),opacity .4s}
        .dk-plate.on{transform:translate(-50%,-50%) scale(1);opacity:1}.dk-plate.fall{transform:translate(-50%,130vh) scale(.8,1.3);opacity:.6;transition:transform 1s cubic-bezier(.6,0,.9,.4),opacity 1s}
        #dk-flash{border-radius:50%;aspect-ratio:1;object-fit:cover;border:2px solid rgba(255,255,255,.7)}
        /* ---- the vision: liquid shapes with drips; a teardrop to expose; honey for the menu; little else ---- */
        #dk-jump,body.demo-mode #field-boost{display:none!important}
        #dk-ctx .verb,#dk-pad button{position:relative}
        #dk-status,#dk-menu-btn,#dk-ctx .verb,#dk-pad button,body.demo-mode.field-ui #field-stick{overflow:visible;
          background:radial-gradient(90% 70% at 30% 20%,rgba(255,255,255,.55) 0,rgba(255,255,255,.10) 26%,rgba(255,255,255,0) 44%),radial-gradient(70% 55% at 70% 88%,rgba(255,255,255,.30) 0,rgba(255,255,255,0) 60%),radial-gradient(120% 120% at 50% 50%,rgba(255,255,255,.03) 40%,rgba(0,10,16,.32) 82%,rgba(0,8,12,.6) 100%)!important;
          border:1px solid rgba(255,255,255,.55)!important;box-shadow:inset 0 0 0 1px rgba(0,10,16,.25),inset 0 -8px 14px rgba(255,255,255,.14),0 6px 16px rgba(0,0,0,.42)!important}
        #dk-status::after,#dk-menu-btn::after,#dk-ctx .verb::after,#dk-pad #dk-veh::after{content:"";position:absolute;left:var(--dx,68%);top:calc(100% - 3px);width:7px;height:var(--dl,16px);border-radius:50% 50% 50% 50%/22% 22% 78% 78%;
          background:linear-gradient(rgba(255,255,255,.10),rgba(255,255,255,.34) 60%,rgba(255,255,255,.7));border:1px solid rgba(255,255,255,.45);border-top:0;box-shadow:0 3px 6px rgba(0,0,0,.35);pointer-events:none;transform-origin:top;animation:dew-drip 5.5s ease-in-out infinite}
        @keyframes dew-drip{0%,62%{transform:scaleY(.55)}82%{transform:scaleY(1.25)}90%{transform:scaleY(.35)}100%{transform:scaleY(.55)}}
        @keyframes dew-morph{0%,100%{border-radius:58% 42% 55% 45%/56% 48% 52% 44%}33%{border-radius:46% 54% 44% 56%/50% 58% 42% 50%}66%{border-radius:54% 46% 60% 40%/44% 52% 48% 56%}}
        #dk-ctx .verb{min-height:50px;padding:10px 22px;animation:dew-in .45s cubic-bezier(.2,.9,.3,1.2) both,dew-morph 9s ease-in-out infinite;font:500 16px system-ui,sans-serif;text-align:center}
        #dk-ctx .verb:nth-child(2){--dx:30%;--dl:22px;animation-duration:.45s,11s}
        #dk-ctx .verb:not(.alt){background:radial-gradient(90% 70% at 30% 20%,rgba(255,255,255,.6) 0,rgba(255,255,255,.10) 26%,rgba(255,255,255,0) 44%),radial-gradient(120% 120% at 50% 50%,rgba(56,232,255,.22) 30%,rgba(10,120,150,.36) 80%,rgba(0,40,56,.62) 100%)!important;border-color:rgba(190,248,255,.8)!important}
        #dk-status{border-radius:46% 54% 60% 40%/62% 58% 42% 38%;padding:9px 20px 9px 14px;--dx:22%;--dl:12px;animation:dew-morph 12s ease-in-out infinite}
        #dk-menu-btn{width:62px;min-width:62px;height:58px;border-radius:52% 48% 50% 50%/46% 46% 54% 54%;font:500 14px system-ui,sans-serif;--dx:56%;--dl:20px;
          background:radial-gradient(80% 60% at 32% 20%,rgba(255,244,214,.75) 0,rgba(255,220,140,.14) 30%,rgba(255,255,255,0) 46%),radial-gradient(120% 120% at 50% 50%,rgba(240,160,30,.50) 20%,rgba(170,90,10,.62) 78%,rgba(70,30,0,.8) 100%)!important;border-color:rgba(255,226,160,.8)!important}
        #dk-menu-btn::after{background:linear-gradient(rgba(240,170,40,.4),rgba(255,200,90,.75));border-color:rgba(255,226,160,.6)}
        #dk-pad button{width:auto;height:auto;border-radius:0;display:block;padding:0}
        #dk-pad #dk-expose{width:74px;height:74px;border-radius:4% 50% 50% 50%;transform:rotate(45deg);margin:22px 8px 14px;border:1px solid rgba(255,255,255,.7)!important}   /* a teardrop, point up */
        #dk-pad #dk-expose b{display:block;transform:rotate(-45deg) translateY(6px);font:500 15px system-ui,sans-serif}
        #dk-pad #dk-expose:active{transform:rotate(45deg) scale(.94)}
        #dk-pad #dk-veh{width:66px;height:54px;border-radius:55% 45% 50% 50%/50% 56% 44% 50%;--dx:30%;font:500 14px system-ui,sans-serif;animation:dew-morph 10s ease-in-out infinite}
        #dk-pad #dk-veh b,#dk-pad #dk-expose b{font-weight:500}
        #dk-chips button{border-radius:48% 52% 55% 45%/60% 52% 48% 40%;padding:8px 15px;font:500 14.5px system-ui,sans-serif}
        body.demo-mode.field-ui #field-move{left:max(12px,env(safe-area-inset-left,0px));bottom:max(14px,env(safe-area-inset-bottom,0px));display:block}
        body.demo-mode.field-ui #field-stick{width:112px;height:78px;border-radius:62% 38% 46% 54%/58% 52% 48% 42%;animation:dew-morph 11s ease-in-out infinite}
        body.demo-mode.field-ui #field-stick::before,body.demo-mode.field-ui #field-stick::after,body.demo-mode #field-stick-up,body.demo-mode #field-stick-down{display:none!important}
        body.demo-mode.field-ui #field-stick-name{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:500 16px system-ui,sans-serif;letter-spacing:0;text-transform:none;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 8px rgba(0,10,16,.85)}
        body.demo-mode.field-ui #field-stick-dot{width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.9),rgba(255,255,255,.18) 45%,rgba(0,10,16,.4));border:1px solid rgba(255,255,255,.7);box-shadow:0 2px 6px rgba(0,0,0,.4);opacity:.0;transition:opacity .2s}
        body.demo-mode.field-ui #field-stick:active #field-stick-dot{opacity:1}
        body.demo-mode.field-ui #field-stick:active #field-stick-name{opacity:.25}
        @media (max-height:500px) and (orientation:landscape){#dk-pad #dk-expose{width:60px;height:60px;margin:16px 8px 10px}body.demo-mode.field-ui #field-stick{width:96px;height:66px}}
        /* ---- one water: the controls' bodies are drawn in the rain layer; these elements are only where you touch ---- */
        body.dew-skin #dk-status,body.dew-skin #dk-menu-btn,body.dew-skin #dk-rail .bead,body.dew-skin #dk-row .bead:not(.pic),body.dew-skin #dk-ctx .verb,body.dew-skin #dk-chips button,body.dew-skin #dk-pad button,body.dew-skin.field-ui #field-stick{
          background:none!important;border-color:transparent!important;box-shadow:none!important;-webkit-backdrop-filter:none;backdrop-filter:none;color:transparent!important;text-shadow:none!important;animation:none!important}
        body.dew-skin #dk-row .bead.pic{border-color:transparent!important;box-shadow:none!important;color:transparent!important;text-shadow:none!important;border-radius:50%}
        body.dew-skin #dk-status::after,body.dew-skin #dk-menu-btn::after,body.dew-skin #dk-ctx .verb::after,body.dew-skin #dk-pad #dk-veh::after{display:none}
        body.dew-skin #dk-status *,body.dew-skin #dk-row .bead em,body.dew-skin #dk-row .bead i,body.dew-skin #dk-ctx .verb *,body.dew-skin.field-ui #field-stick-name{color:transparent!important;text-shadow:none!important;visibility:hidden}
        body.dew-skin #dk-status{width:74px;height:50px;padding:0;max-width:none}
        body.dew-skin #dk-pad #dk-expose,body.dew-skin #dk-pad #dk-veh,body.dew-skin #dk-menu-btn,body.dew-skin #dk-status{background:none!important;border-color:transparent!important;box-shadow:none!important}
        body.dew-skin #dk-pad #dk-expose{transform:none;width:76px;height:98px;margin:4px 4px 6px;border-radius:0}
        body.dew-skin #dk-pad #dk-expose b{transform:none;visibility:hidden}body.dew-skin #dk-pad #dk-veh b{visibility:hidden}
        body.dew-skin #dk-pad #dk-expose:active{transform:none}
        body.dew-skin #dk-ctx .verb{min-width:118px;min-height:54px}
        body.dew-skin #dk-chips{gap:10px}body.dew-skin #dk-chips button{min-height:48px;min-width:48px;width:48px;padding:0;overflow:hidden}
        .dk-gauge{position:fixed;left:calc(18px + env(safe-area-inset-left,0px));width:38px;height:38px;background:none;border:0;padding:0;color:transparent}
        #dk-g-donkey{top:calc(154px + env(safe-area-inset-top,0px))}#dk-g-signal{top:calc(114px + env(safe-area-inset-top,0px))}
        #dk-map{top:calc(92px + env(safe-area-inset-top,0px));left:calc(16px + env(safe-area-inset-left,0px));width:54px;height:54px;cursor:pointer;touch-action:none}
        body.dew-skin #dk-verbs .verb,body.dew-skin #dk-offers .verb{min-width:0!important;width:58px;height:58px;min-height:0!important;padding:0!important;overflow:hidden}
        body.dew-skin #dk-offers .verb{width:48px;height:48px}
        body.dew-skin #dk-status{width:58px;height:66px}
        body.dew-skin #dk-verbs .verb[data-plain]{width:auto;min-width:118px!important;height:50px;padding:0 20px!important}
        body.dew-skin #dk-verbs .verb,body.dew-skin #dk-chips button{position:fixed;left:50%;top:70%;transform:translate(-50%,-50%);margin:0;touch-action:none;white-space:nowrap}
        body.dew-skin #dk-offers .verb{position:fixed;transform:translate(-50%,-50%);margin:0;touch-action:none;white-space:nowrap;min-width:0;min-height:42px;padding:8px 16px;font-size:14px;pointer-events:auto;background:none!important;border-color:transparent!important;box-shadow:none!important;color:transparent!important;text-shadow:none!important;animation:none!important}
        body.dew-skin #dk-offers .verb::after{display:none}
        body.dew-skin #dk-chips{overflow:visible;pointer-events:none}body.dew-skin #dk-chips button{pointer-events:auto}
        body.dew-skin #dk-status,body.dew-skin #dk-pad button{touch-action:none}
        body.dew-skin.demo-mode #field-move{display:none!important}
        @media (prefers-reduced-motion:reduce){#dk-ctx .verb,#dk-chips button,.dk .bead,#dk-status,#dk-pad #dk-veh,body.demo-mode.field-ui #field-stick{animation:none}#dk-status::after,#dk-menu-btn::after,#dk-ctx .verb::after{animation:none}}
        body.demo-full #dk-pad,body.demo-full #dk-ctx,body.demo-full #dk-status{display:none!important}
        body.demo-mode #dialogue-card,body.demo-mode #immersive-corner,body.demo-mode #ctx-actions{display:none!important}
        body.demo-mode #demo-phone{display:none!important}
        body.demo-mode #field-status,body.demo-mode #field-tools,body.demo-mode #field-actions,body.demo-mode #field-intro{display:none!important}
        .dk{position:fixed;z-index:62;font:14px/1.3 system-ui,sans-serif;color:#e9f6fb}
        .dk button,.dk select{font:inherit;color:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;text-transform:none;letter-spacing:0}
        #dk-status{left:max(10px,env(safe-area-inset-left,0px));top:calc(10px + env(safe-area-inset-top,0px));display:flex;gap:10px;align-items:center;background:rgba(6,14,20,.82);border:1px solid #23414b;border-radius:18px;padding:7px 12px;max-width:calc(100vw - 120px);white-space:nowrap;overflow:hidden}
        #dk-status b{font-weight:600}#dk-status .can{width:46px;height:7px;background:#12232c;border-radius:4px;overflow:hidden;position:relative;flex:none}#dk-status .can i{position:absolute;inset:0 auto 0 0;background:#38e8ff}
        #dk-status .can u{position:absolute;top:0;bottom:0;left:20%;width:2px;background:#fff}#dk-status small{color:#8fb3bd;overflow:hidden;text-overflow:ellipsis}
        #dk-menu-btn{right:max(10px,env(safe-area-inset-right,0px));top:calc(10px + env(safe-area-inset-top,0px));min-width:44px;height:38px;border-radius:19px;background:rgba(6,14,20,.82);border:1px solid #23414b;padding:0 14px;font-weight:600}
        #dk-pad{right:max(12px,env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column-reverse;gap:8px;align-items:center}
        #dk-pad [hidden]{display:none!important}
        #dk-jump{left:calc(30px + env(safe-area-inset-left,0px));bottom:calc(122px + env(safe-area-inset-bottom,0px));width:48px;height:48px;border-radius:50%;background:rgba(6,14,20,.72);border:1px solid #3b6c78;font-size:11.5px;font-weight:600}
        body:not(.demo-touch) #dk-jump{display:none}
        #dk-sig{display:inline-flex;gap:2px;align-items:flex-end;height:11px;flex:none}#dk-sig i{width:3px;background:#26343c;border-radius:1px}#dk-sig i.on{background:#38e8ff}
        #dk-sig i:nth-child(1){height:3px}#dk-sig i:nth-child(2){height:6px}#dk-sig i:nth-child(3){height:9px}#dk-sig i:nth-child(4){height:11px}
        #dk-place{transition:opacity .4s}#dk-place.gone{opacity:0;width:0}
        #dk-pad button{width:56px;height:56px;border-radius:50%;background:rgba(6,14,20,.82);border:1px solid #3b6c78;font-size:11.5px;font-weight:600;line-height:1.1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
        #dk-pad button span{font-size:18px;line-height:1}#dk-pad button kbd{font:10px ui-monospace,monospace;opacity:.55}
        #dk-pad #dk-expose{width:64px;height:64px;background:rgba(240,236,226,.92);color:#0b1a22;border:3px solid #38e8ff}
        #dk-pad button.on{background:#38e8ff;color:#06222c;border-color:#38e8ff}
        #dk-pad button:active,#dk-ctx button:active{transform:scale(.94)}
        #dk-ctx{left:calc(150px + env(safe-area-inset-left,0px));right:calc(90px + env(safe-area-inset-right,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:flex-end;gap:7px;pointer-events:none}
        body:not(.demo-touch) #dk-ctx{left:30%}
        #dk-ctx button{pointer-events:auto}
        #dk-verbs{display:flex;flex-direction:column-reverse;align-items:flex-end;gap:7px;max-width:100%}
        #dk-ctx .verb .csq{display:block;font-size:11.5px;font-weight:500;opacity:.8}
        #dk-ctx .verb{min-height:44px;padding:8px 16px;border-radius:22px;background:#38e8ff;color:#06222c;border:0;font-weight:650;box-shadow:0 3px 14px rgba(0,0,0,.45);text-align:right}
        #dk-ctx .verb.alt{background:rgba(6,14,20,.88);color:#e9f6fb;border:1px solid #38e8ff;font-weight:550}
        #dk-ctx .verb.off{background:rgba(6,14,20,.82);color:#9fbcc4;border:1px solid #2c4c56;font-weight:500;min-height:38px;font-size:13px}
        #dk-ctx .verb small{display:block;font-size:11px;font-weight:450;opacity:.85}
        #dk-ctx .verb.urgent{background:#ff6b5a;color:#1a0806}
        #dk-chips{position:fixed;left:max(10px,env(safe-area-inset-left,0px));right:max(10px,env(safe-area-inset-right,0px));bottom:calc(180px + env(safe-area-inset-bottom,0px));display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0;pointer-events:auto}#dk-chips::-webkit-scrollbar{display:none}
        #dk-chips[hidden]{display:none}#dk-chips .x{border-color:#5d7c86;color:#a9c6ce;min-width:40px}
        #dk-chips button{flex:none;min-height:38px;padding:6px 12px;border-radius:19px;background:rgba(6,14,20,.9);border:1px solid #8fd0de}
        #dk-chips .who{border:0;background:none;color:#8fd0de;font-size:11px;letter-spacing:.08em;text-transform:uppercase;pointer-events:none;padding:6px 2px}
        #dk-ctx kbd,#dk-chips kbd{font:10px ui-monospace,monospace;opacity:.6;margin-right:5px}
        body.demo-touch .dk kbd{display:none}
        #dk-flash{left:50%;top:50%;transform:translate(-50%,-50%);width:min(240px,50vw);border:6px solid #f1eee6;box-shadow:0 8px 30px rgba(0,0,0,.6);pointer-events:none;transition:all .6s cubic-bezier(.5,0,.3,1);z-index:79}
        #dk-flash.fly{left:40px;top:28px;width:40px;opacity:.2;border-width:2px}
        @media (orientation:portrait) and (max-width:700px){
          #dk-ctx{left:calc(150px + env(safe-area-inset-left,0px))}}
        @media (max-height:500px) and (orientation:landscape){#dk-pad button{width:48px;height:48px;font-size:10.5px}#dk-pad #dk-expose{width:56px;height:56px}
          #dk-ctx{right:calc(84px + env(safe-area-inset-right,0px))}#dk-chips{bottom:calc(70px + env(safe-area-inset-bottom,0px));left:calc(150px + env(safe-area-inset-left,0px))}}
        @media (max-width:700px) and (orientation:portrait){
          #demo-say{bottom:calc(122px + env(safe-area-inset-bottom,0px));left:auto;right:12px;transform:none;width:calc(100vw - 120px)}
          #demo-you{bottom:calc(170px + env(safe-area-inset-bottom,0px))}
        }
        @media (max-height:500px) and (orientation:landscape){
          #demo-say{bottom:calc(10px + env(safe-area-inset-bottom,0px));width:min(420px,calc(100vw - 340px))}
          #demo-you{bottom:calc(56px + env(safe-area-inset-bottom,0px))}
          #demo-phone:not(.shut) #demo-thread{max-height:70px}
        }
        }</style>
        <div id="demo-brief" class="dm"><h3>Ahiya · night shift</h3><p class="sub">Night Post · Abyssinian Highlands</p>
          <p>You carry water from the Basalt Pump to the people on the ridge. Walk up to anyone and talk; say “draw” at the pump, “where is the archive”, “show me your phone”.</p>
          <p>Every sound is a recording placed where it happens: rain where it falls, the chant at the beacon, the yard fire. Headphones help.</p>
          <p class="keys" id="demo-keys"></p>
          <button id="demo-brief-ok">Begin</button></div>
        <div id="demo-bub" class="dm" hidden><b></b><span></span></div>
        <div id="dk-g-donkey" class="dk dk-gauge" data-icon="donkey" data-stain="go" data-fill="1" role="img" aria-label="The donkey's water"></div>
        <div id="dk-g-signal" class="dk dk-gauge" hidden data-icon="beacon" data-stain="lens" data-fill="0" role="img" aria-label="Beacon signal"></div>
        <button id="dk-map" class="dk dk-gauge" type="button" data-icon="map" data-stain="go" aria-label="Map"></button>
        <div id="dk-status" class="dk" role="status" data-icon="none" data-stain="water" data-mark=".2" aria-label="Water carried"><span class="can"><i></i><u></u></span><b id="dk-l">0 L</b><span id="dk-sig" aria-label="Beacon signal"><i></i><i></i><i></i><i></i></span><small id="dk-place"></small></div>
        <button id="dk-menu-btn" class="dk" type="button" aria-label="Menu" aria-expanded="false" data-icon="menu">Menu</button>
        <div id="dk-ctx" class="dk"><div id="dk-chips" hidden></div><div id="dk-verbs"></div><div id="dk-offers"></div></div>
        <button type="button" id="dk-jump" class="dk" aria-label="Jump">Jump</button>
        <div id="dk-pad" class="dk" role="group" aria-label="Actions">
          <button type="button" id="dk-veh" aria-label="Vehicle" hidden data-icon="drive" data-stain="go"><b id="dk-veh-l">Drive</b></button>
          <button type="button" id="dk-expose" aria-label="Expose an 8 by 10 plate" data-icon="expose" data-stain="lens"><b>Expose</b></button>
        </div>
        <nav id="dk-rail" class="dk" hidden aria-label="Menu groups"></nav>
        <div id="dk-row" class="dk" hidden role="toolbar" aria-label="Menu items"></div>
        <div id="demo-you" class="dm" hidden></div>
        <form id="demo-say" class="dm" hidden autocomplete="off"><input id="demo-in" maxlength="140" aria-label="Say something" placeholder=""><button type="button" id="demo-mic" aria-pressed="false">Mic</button><button type="submit">Say</button></form>
        <div id="demo-phone" class="dm shut"><h4><span>PHONE <em>tap</em></span><span id="demo-sig"><i></i><i></i><i></i><i></i></span></h4><div id="demo-can"><i></i><u></u></div>
          <p id="demo-lit"></p><p id="demo-los"></p><div id="demo-thread"></div><p id="demo-btns"><button type="button" id="demo-listen">Listen</button><button type="button" id="demo-voice" aria-pressed="true">Voice on</button><button type="button" id="demo-radio" hidden>Radio</button><button type="button" id="demo-map">Map</button><button type="button" id="demo-wagon">Wagon</button><button type="button" id="demo-cam">First person</button><button type="button" id="demo-help">How to play</button></p></div>`;
      document.body.append(el);
      const q = id => el.querySelector("#" + id);
      const ui = demo.ui = { brief: q("demo-brief"), bub: q("demo-bub"), you: q("demo-you"), say: q("demo-say"), input: q("demo-in"), mic: q("demo-mic"), sig: q("demo-sig"), can: q("demo-can").firstElementChild,
        lit: q("demo-lit"), los: q("demo-los"), thread: q("demo-thread"), voice: q("demo-voice"), radioBtn: q("demo-radio") };
      q("demo-brief-ok").onclick = () => { ui.brief.hidden = true; startField(); if (state.introActive) finishIntro(true); };
      const kick = () => { startField(); removeEventListener("pointerdown", kick, true); removeEventListener("keydown", kick, true); };
      addEventListener("pointerdown", kick, true); addEventListener("keydown", kick, true);       // sound begins with the first touch, wherever it lands
      q("demo-listen").onclick = () => { startField(); if (field) field.panel(!field.panelOpen); phone.classList.add("shut"); };
      q("demo-radio").onclick = () => { if (field && field.radio) field.radio.tune(); };
      document.body.classList.add("demo-clean");
      const phone = q("demo-phone"); phone.firstElementChild.onclick = () => phone.classList.toggle("shut");
      document.body.classList.add("demo-mode");
      const RAIN2 = urlParams.get("rain") !== "1";                         // the vendored rain engine (night-post/rain/) instead of dew-ui
      demo.dew = window.makeDew && !RAIN2 ? window.makeDew(canvas) : null;
      document.body.classList.toggle("rain2", RAIN2);
      if (RAIN2) { const V = "?v=3", lk = document.createElement("link"); lk.rel = "stylesheet"; lk.href = "./rain/rain.css" + V; document.head.append(lk);
        const en = document.createElement("script"); en.src = "./rain/engine.js" + V; en.onload = () => { const su = document.createElement("script"); su.src = "./rain/surface.js" + V; document.head.append(su); }; document.head.append(en); }
      document.body.classList.toggle("dew-skin", !!demo.dew);
      if (demo.dew) {
        // carrying water from one drop into another is the act: litres onto a person, the tap or the donkey; the pump's drop into your litres
        // the language of the rain: ?lang=am|zh|es|pt|fr|de|ru|en, or Menu > World; remembered on this device
        const RL = window.RAIN_LANG; let lc = urlParams.get("lang") || ""; try { lc = lc || localStorage.getItem("ahiya-lang") || ""; } catch (e) { }
        demo.setLang = code => { if (!RL) return; demo.lang = RL.get(code).code; demo.dew.setLang(RL.get(code)); demo.tr = null;
          if (demo.lang !== "en") fetch(`./lang/${demo.lang}.json`).then(r => r.json()).then(j => { if (demo.lang === RL.get(code).code) demo.tr = j; }).catch(() => { }); document.documentElement.lang = demo.lang; try { localStorage.setItem("ahiya-lang", demo.lang); } catch (e) { } };
        demo.setLang(lc || "en");
        const keyOf = el => el && el.dataset ? el.dataset.key || (el.dataset.offer ? "o:" + el.dataset.offer : "") : "";
        // CARRY: water moves between the can and the wet thing. Start on either; let go on the other. A touch on the wet
        // thing alone also does it. Let go anywhere else and the water goes back.
        let carry = null; const canPos = () => { const r = q("dk-status").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
        addEventListener("pointerdown", e => {
          if (carry || demo.handoff || state.introActive) return; const w = demo.wetPos, t = e.target, onCan = t.closest && t.closest("#dk-status");
          const onThing = w && (t === canvas || t.id === "viewfinder") && Math.hypot(e.clientX - w.x, e.clientY - w.y) < w.r + 30;
          if (!onCan && !onThing) return; if (onCan && !w) return;
          e.stopImmediatePropagation(); const c0 = canPos(); carry = { id: e.pointerId, from: onCan ? "can" : "thing", x0: onCan ? c0[0] : w.x, y0: onCan ? c0[1] : w.y, moved: 0, sx: e.clientX, sy: e.clientY };
          demo.dew.carry = { x0: carry.x0, y0: carry.y0, x: e.clientX, y: e.clientY };
        }, true);
        addEventListener("pointermove", e => { if (!carry || e.pointerId !== carry.id) return; e.stopImmediatePropagation(); carry.moved = Math.max(carry.moved, Math.hypot(e.clientX - carry.sx, e.clientY - carry.sy)); demo.dew.carry.x = e.clientX; demo.dew.carry.y = e.clientY; }, true);
        const drop = e => { if (!carry || e.pointerId !== carry.id) return; const w = demo.wetPos, c0 = canPos(), k = carry; carry = null; demo.dew.carry = null;
          const nearThing = w && Math.hypot(e.clientX - w.x, e.clientY - w.y) < w.r + 34, nearCan = Math.hypot(e.clientX - c0[0], e.clientY - c0[1]) < 70;
          const done = k.from === "can" ? nearThing : (nearCan || k.moved < 16);                      // carried across, or the thing simply touched
          if (done) { demo.carryFromCan = k.from === "can"; demoLiveDo(); demo.carryFromCan = false; }
          else demo.dew.drop({ x: e.clientX, y: e.clientY, r: 7, state: "fall", vy: 20, grow: 1, forced: true }); };   // let go over nothing: it falls, nothing is spent
        addEventListener("pointerup", drop, true); addEventListener("pointercancel", e => { if (carry && e.pointerId === carry.id) { carry = null; demo.dew.carry = null; } }, true);
        q("dk-map").onclick = () => { demo.mapOn = !demo.mapOn; demo.mapUntil = 0; };
        demo.dew.onBreathe = () => { demo.mapUntil = (demo.clock || 0) + 7000; demo.snooze = {}; demo.shownAt = {}; demo.offerT = 0; demo.hintT = 0; demo.dockSig = ""; demo.dockT = 0; };   // breath on the glass brings the drops back
        demo.dew.onMerge = null; const _unusedMerge = (a, b) => { const v = [a, b].find(el => el.dataset && (el.dataset.verb || el.dataset.ctx)), st = [a, b].find(el => el.id === "dk-status"); if (v && st) v.click(); };
        // the pool: on a touch screen you walk from wherever your thumb comes down in the lower left; lift, and it is gone
        if (matchMedia("(pointer:coarse)").matches) {
          demo.dew.hint = "touch here to walk";
          let pool = null;
          addEventListener("pointerdown", e => {
            if (pool || e.pointerType === "mouse" || state.introActive || demo.handoff) return; const t = e.target;
            if (!(t === canvas || t.id === "viewfinder") || e.clientX > innerWidth * .55 || e.clientY < innerHeight * .4) return;
            e.stopPropagation(); pool = { id: e.pointerId, x: e.clientX, y: e.clientY }; stickPointer = e.pointerId; demo.dew.pool = { x: pool.x, y: pool.y, kx: 0, ky: 0 }; demo.dew.hint = "";
          }, true);
          addEventListener("pointermove", e => { if (!pool || e.pointerId !== pool.id) return; e.stopPropagation();
            let kx = (e.clientX - pool.x) / 54, ky = (e.clientY - pool.y) / 54; const n = Math.hypot(kx, ky); if (n > 1) { kx /= n; ky /= n; }
            stickX = kx; stickY = ky; demo.dew.pool.kx = kx; demo.dew.pool.ky = ky; }, true);
          const end = e => { if (!pool || e.pointerId !== pool.id) return; pool = null; stickX = stickY = 0; stickPointer = null; demo.dew.pool = null; };
          addEventListener("pointerup", end, true); addEventListener("pointercancel", end, true);
        }
      }
      const touch = matchMedia("(pointer:coarse)").matches;
      document.body.classList.toggle("demo-touch", touch);
      ui.verbs = q("dk-verbs"); ui.chips = q("dk-chips"); ui.dk = q("dk-ctx");
      ui.dk.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return; e.stopPropagation();
        if (b.dataset.verb) demoDo(b.dataset.verb);
        else if (b.dataset.ctx) { const a = (state.ctxActs || []).find(a => a.id === b.dataset.ctx); if (a) a.fn(); demo.dockSig = ""; }
        else if (b.dataset.do) { ({ land: () => toggleGlide(), down: () => toggleRide(), park: () => toggleCart(), fly: () => toggleGlide() })[b.dataset.do](); demo.dockSig = ""; }
        else if (b.dataset.offer) demoOfferTake(b);
        else if (b.dataset.talk) { const who = demo.withCh; if (who) { const kb = DEMO_KB[who.state.id] || {}, list = ["who", ...Object.keys(kb).filter(k => k !== "who" && kb[k] && DEMO_Q[k]), "where"];
            const ix = demo.askIx || (demo.askIx = {}), k = list[(ix[who.state.id] || 0) % list.length]; ix[who.state.id] = (ix[who.state.id] || 0) + 1; demoSay(k === "where" ? "Where next?" : DEMO_Q[k]); }
          if (demo.curKey) { (demo.shownAt || {})[demo.curKey] = demo.clock || 0; } demo.dockSig = ""; }
        else if (b.dataset.untalk) { demo.talking = false; demo.dockSig = ""; demoDock(1); }
        else if (b.dataset.type) { document.body.classList.add("demo-typing"); ui.say.hidden = false; setTimeout(() => ui.input.focus(), 30); }
        else if (b.dataset.ask) demoSay(b.dataset.ask);
      });
      ui.input.addEventListener("blur", () => setTimeout(() => document.body.classList.remove("demo-typing"), 150));
      // the pad: the game's own verbs, always in reach
      q("dk-jump").onclick = () => jumpPlayer();
      q("dk-expose").onclick = () => { exposePlate(); demoFlash(); };
      q("dk-veh").onclick = () => { if (state.riding) toggleRide(); else toggleCart(); demo.dockSig = ""; };
      // The menu is beads on the edges of the glass: groups run down the right edge, a group's items along the top.
      // It is always one tap away and it never sits on the world; the middle of the glass stays clear.
      const cyc = (k, n, d = 1) => (k + d + n) % n, click = id => { const el = document.getElementById(id); if (el) el.click(); };
      const FOCI = [2.5, 6, 18, 45, 120, 400];
      const names = () => { const o = document.getElementById("sel-play-as"); return o ? [...o.options].map(x => [x.value, x.textContent.replace(/^PLAY AS:\s*/i, "")]) : []; };
      const MENU = demo.MENU = {
        Lens: [
          { id: "focus", cap: "focus", val: () => state.focusDist < 100 ? state.focusDist.toFixed(0) + " m" : "far", act: () => { const k = FOCI.findIndex(f => f > state.focusDist * 1.05); state.focusDist = FOCI[k < 0 ? 0 : k]; state.focusPulse = 1; updateHUD(); } },
          { id: "filter", cap: "filter", val: () => FILTERS[state.filterIdx].short.split(" ")[0], act: () => { state.filterIdx = cyc(state.filterIdx, FILTERS.length); updateHUD(); } },
          { id: "stop", cap: "stop", val: () => STOPS[state.stopIdx].name, act: () => { state.stopIdx = cyc(state.stopIdx, STOPS.length); updateHUD(); } },
          { id: "mode", cap: "mode", val: () => MODES[state.modeIdx].label.toLowerCase().split(" ")[0], act: () => { state.modeIdx = cyc(state.modeIdx, MODES.length); updateHUD(); } },
          { id: "tilt", cap: "tilt", val: () => state.tilt > .05 ? "up" : state.tilt < -.05 ? "down" : "level", act: () => { state.tilt = state.tilt > .05 ? -.32 : state.tilt < -.05 ? 0 : .32; updateHUD(); } },
          { id: "guides", cap: "guides", val: () => state.ppcOn ? "on" : "off", on: () => state.ppcOn, act: () => { state.ppcOn = !state.ppcOn; updateHUD(); } },
          { id: "lidar", cap: "lidar", val: () => state.lidarOn ? "on" : "off", on: () => state.lidarOn, act: () => toggleLidar() },
          { id: "cam", cap: "view", val: () => state.cameraMode === "third" ? "3rd" : "1st", act: () => toggleCameraMode() },
          { id: "plates", cap: "plates", val: () => String(state.plates.length), img: () => state.plates.length ? state.plates.at(-1).dataUrl : "", act: () => demoShowPlate() }],
        Go: [
          { id: "map", cap: "map", val: () => "M", act: () => toggleBigMap(), closes: true },
          { id: "jump", cap: "jump", val: () => "⤒", act: () => jumpPlayer() },
          { id: "ride", cap: "donkey", val: () => state.riding ? "down" : "ride", on: () => state.riding, act: () => toggleRide() },
          { id: "drive", cap: "wagon", val: () => state.drivingCart ? "park" : "drive", on: () => state.drivingCart, act: () => toggleCart() },
          { id: "glide", cap: "glide", val: () => state.gliding ? "land" : "jump", on: () => state.gliding, act: () => toggleGlide(), closes: true },
          { id: "run", cap: "run", val: () => state.sprintToggle ? "on" : "off", on: () => state.sprintToggle, act: () => { state.sprintToggle = !state.sprintToggle; } },
          { id: "region", cap: "region", val: () => String(state.region || "").slice(0, 5), act: () => toggleRegion(), closes: true },
          { id: "route", cap: "route", val: () => "swap", act: () => click("field-switch-btn"), closes: true },
          { id: "dispatch", cap: "dispatch", val: () => "book", act: () => click("field-dispatch-btn"), closes: true },
          { id: "dance", cap: "dance", val: () => "K", act: () => triggerDance() }],
        Sound: [
          { id: "listen", cap: "listen", val: () => field && field.panelOpen ? "open" : "mix", on: () => field && field.panelOpen, act: () => { startField(); if (field) field.panel(!field.panelOpen); } },
          { id: "voice", cap: "voices", val: () => demo.voice ? "on" : "off", on: () => demo.voice, act: () => ui.voice.click() },
          { id: "tape", cap: "tape", val: () => audioEl.paused ? "off" : "on", on: () => !audioEl.paused, act: () => toggleTape() },
          { id: "radio", cap: "radio", val: () => field && field.radio && field.radio.on ? field.radio.name.split(" ")[0] : "tune", act: () => { if (field && field.radio) field.radio.tune(); } }],
        World: [
          { id: "throw", cap: "throw", val: () => "G", act: () => throwObject() },
          { id: "squirt", cap: "squirt", val: () => "F", act: () => triggerSquirtBurst(1.4) },
          { id: "rig", cap: "rig", val: () => "B", act: () => deployRig() },
          { id: "sync", cap: "sync", val: () => "T", act: () => syncResonantZone() },
          { id: "video", cap: "video", val: () => "Y", act: () => toggleInWorldVideo(), closes: true },
          { id: "trailer", cap: "trailer", val: () => "U", act: () => { if (machinima) machinima.toggle("trailer"); }, closes: true },
          { id: "playas", cap: "play as", val: () => (names().find(n => n[0] === state.playAs) || ["", "you"])[1].slice(0, 6).toLowerCase(), act: () => { const N = names(); if (N.length) setPlayAs(N[cyc(N.findIndex(n => n[0] === state.playAs), N.length)][0]); } },
          { id: "hud", cap: "old hud", val: () => document.body.classList.contains("demo-full") ? "on" : "off", on: () => document.body.classList.contains("demo-full"),
            act: () => { const on = !document.body.classList.contains("demo-full"); document.body.classList.toggle("demo-clean", !on); document.body.classList.toggle("demo-mode", !on); document.body.classList.toggle("demo-full", on); } },
          { id: "lang", cap: "language", val: () => demo.lang || "en", act: () => { const o = window.RAIN_LANG.order; demo.setLang(o[(o.indexOf(demo.lang || "en") + 1) % o.length]);
              if (demo.dew) for (let i = 0; i < 9; i++) demo.dew.drop({ x: 30 + Math.random() * (innerWidth - 60), y: -10 - Math.random() * 60, r: 4 + Math.random() * 3, state: "fall", vy: 40 + Math.random() * 60, grow: 1, forced: true }); } },   // a shower in the new tongue
          { id: "help", cap: "how to", val: () => "?", act: () => { ui.brief.hidden = false; }, closes: true }]
      };
      const rail = q("dk-rail"), row = q("dk-row"), mbtn = q("dk-menu-btn");
      rail.innerHTML = Object.keys(MENU).map(k => `<button type="button" class="bead" data-group="${k}" data-icon="${k.toLowerCase()}" aria-label="${k}">${k}</button>`).join("");
      const openMenu = (on, group) => {
        demo.menuOpen = on; demo.menuTouch = demo.clock || 0; demo.menuGroup = on ? (group || demo.menuGroup || "Lens") : demo.menuGroup;
        rail.hidden = row.hidden = !on; mbtn.setAttribute("aria-expanded", on); mbtn.classList.toggle("on", on); document.body.classList.toggle("dk-menu-open", on);
        if (on) { row.dataset.group = ""; demoBeads(true); if (demo.dew) for (let i = 0; i < 3; i++) demo.dew.drop({ x: innerWidth - 30 + (Math.random() - .5) * 20, y: 70 + i * 30, r: 2.5 + Math.random() * 3, grow: 0, life: .3 + i * .25, amb: true }); }
        else if (demo.dew) { const r = mbtn.getBoundingClientRect(); for (let i = 0; i < 5; i++) demo.dew.wisp(r.left + r.width / 2 + (Math.random() - .5) * 30, r.bottom + 10 + Math.random() * 60); }   // the beads leave as vapour
      };
      ui.openSheet = openMenu;
      mbtn.onclick = () => openMenu(!demo.menuOpen);
      rail.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; demo.menuTouch = demo.clock || 0; demo.menuGroup = b.dataset.group; row.dataset.group = ""; demoBeads(true); });
      row.addEventListener("click", e => {
        const b = e.target.closest("button"); if (!b) return; const it = (MENU[demo.menuGroup] || []).find(x => x.id === b.dataset.item); if (!it) return;
        demo.menuTouch = demo.clock || 0;
        it.act(); if (demo.dew) { const r = b.getBoundingClientRect(); demo.dew.drop({ x: r.left + r.width / 2, y: r.bottom - 6, r: 4 + Math.random() * 2, state: "fall", vy: 30, grow: 1 }); }   // a touch shakes a drop loose
        if (it.closes) openMenu(false); else demoBeads(true);
      });
      addEventListener("keydown", e => {                                   // E does the stop's verb when there is one; every other key is the game's
        if (document.activeElement === ui.input || e.repeat) return;
        if (e.code === "KeyE" && demo.live) { e.stopImmediatePropagation(); e.preventDefault(); demoLiveDo(); }
        if (e.code === "Escape" && demo.menuOpen) { e.stopImmediatePropagation(); openMenu(false); }
      }, true);
      q("demo-keys").textContent = touch ? "Left stick walks; push it to the rim to run. Drag anywhere else to look. Jump, Expose, Throw and the wagon are bottom right; everything else is in Menu."
        : "W A S D walk · Shift run · Space jump · Shift+Space expose · drag to look · Z talk · E the stop’s verb · G throw · C wagon · V camera · M map · O listen.";
      q("demo-help").onclick = () => { ui.brief.hidden = false; phone.classList.add("shut"); };
      const via = id => () => { const b = document.getElementById(id); if (b) b.click(); phone.classList.add("shut"); };   // the game's own controls, reached from the phone
      q("demo-map").onclick = via("btn-big-map"); q("demo-wagon").onclick = via("btn-drive-pill");
      q("demo-cam").onclick = e => { via("btn-cam-mode")(); e.currentTarget.textContent = state.cameraMode === "third" ? "First person" : "Third person"; };
      // THE BRIDGE: everything a surface needs from the game, and nothing of its internals. night-post/rain/ is built on this.
      window.AhiyaBridge = {
        version: 1, canvas,
        state() {
          const c = npCarrier(), L = demo.live, w = demo.wetPos, ln = demo.line, order = ["basalt", "beacon", "hill", "compound"], nx = order.find(k => !c.visited.includes(k)) || null;
          let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const k of order) { x0 = Math.min(x0, DEMO_SETS[k][0]); x1 = Math.max(x1, DEMO_SETS[k][0]); z0 = Math.min(z0, DEMO_SETS[k][1]); z1 = Math.max(z1, DEMO_SETS[k][1]); }
          const U = (x, z) => [(x - x0) / (x1 - x0), (z - z0) / (z1 - z0)];
          let head = null; if (ln) { demoV.set(ln.ch.state.x, (ln.ch.state.y || 0) + 1.8, ln.ch.state.z).project(camera); if (demoV.z < 1) head = [(demoV.x * .5 + .5) * innerWidth, (-demoV.y * .5 + .5) * innerHeight]; }
          return {
            ready: !!state.ready && !state.introActive, clock: demo.clock || 0, lang: demo.lang || "en",
            water: { liters: c.liters, capacity: 20, reserve: c.reserve || 4, donkey: clamp(state.donkeyWater, 0, 1), donkeyDown: !!state.donkeyCollapsed },
            place: { id: c.place, name: currentPlaceName(), next: nx, visited: c.visited.slice() }, signal: demo.signal || 0,
            mode: state.gliding ? "glide" : state.drivingCart ? "drive" : state.riding ? "ride" : "walk", speed: Math.hypot(state.vx || 0, state.vz || 0),
            exit: state.gliding ? { id: "land", label: state.donkeyOnRoof ? glideActionLabel() : "Come down" } : state.riding ? { id: "down", label: "Get down" } : state.drivingCart ? { id: "park", label: "Park the wagon" } : null,
            live: L ? { kind: L.kind, id: L.verb || L.ctx || "ask", label: L.verb ? DEMO_VERB[L.verb].label : L.ctx === "share" ? "Share water" : L.ctx ? "Water the donkey" : "Ask " + demoName(L.ask), delta: L.dl || 0, x: w ? w.x : null, y: w ? w.y : null, r: w ? w.r : 0, person: L.ask ? demoName(L.ask) : null } : null,
            busy: !!demo.handoff,
            speech: ln ? { seq: ln.seq, name: demoName(ln.ch), text: ln.text, spoken: (ln.text.match(/“[^”]*”/g) || []).map(q => q.slice(1, -1)).join(" "), t: ln.t, dur: ln.dur, x: head ? head[0] : null, y: head ? head[1] : null } : null,
            said: demo.youLine || null,
            lens: { focus: state.focusDist, filter: state.filterIdx, filterName: FILTERS[state.filterIdx].short, filters: FILTERS.map(f => f.short), stop: state.stopIdx, stopName: STOPS[state.stopIdx].name, stops: STOPS.map(s => s.name),
              mode: state.modeIdx, modeName: MODES[state.modeIdx].label, modes: MODES.map(m => m.label), tilt: state.tilt, guides: !!state.ppcOn, lidar: !!state.lidarOn, camera: state.cameraMode, plates: state.plates.length },
            map: { stops: order.map(k => ({ id: k, name: DEMO_SETS[k][2], u: U(DEMO_SETS[k][0], DEMO_SETS[k][1])[0], v: U(DEMO_SETS[k][0], DEMO_SETS[k][1])[1], next: k === nx, seen: c.visited.includes(k) })), me: U(state.x, state.z), donkey: U(donkey.state.x, donkey.state.z), heading: -state.yaw },
            sound: { voices: !!demo.voice, tape: !audioEl.paused, radio: !!(field && field.radio && field.radio.on) }
          };
        },
        act: {
          live: fromCan => { demo.carryFromCan = !!fromCan; const ok = demoLiveDo(); demo.carryFromCan = false; return ok; },
          exit: () => { if (state.gliding) toggleGlide(); else if (state.riding) toggleRide(); else if (state.drivingCart) toggleCart(); demo.dockSig = ""; },
          expose: () => exposePlate(), lastPlate: () => (state.plates.at(-1) || {}).dataUrl || null,
          steer: (x, y, active) => { stickPointer = active ? -7 : null; stickX = active ? clamp(x, -1, 1) : 0; stickY = active ? clamp(y, -1, 1) : 0; },
          look: (dx, dy) => { state.yaw -= dx * .0045; state.lookDragAt = performance.now(); state.pitch = clamp(state.pitch - dy * .0038, -.82, .82); },
          say: text => demoSay(text), ask: () => { demo.carryFromCan = false; return demoLiveDo(); },
          focus: m => { state.focusDist = clamp(m, 1.2, 900); state.focusPulse = 1; updateHUD(); },
          set: (what, i) => { if (what === "filter") state.filterIdx = clamp(i | 0, 0, FILTERS.length - 1); else if (what === "stop") state.stopIdx = clamp(i | 0, 0, STOPS.length - 1); else if (what === "mode") state.modeIdx = clamp(i | 0, 0, MODES.length - 1); else if (what === "tilt") state.tilt = clamp(+i, -.35, .35); updateHUD(); },
          lang: code => demo.setLang && demo.setLang(code), jump: () => jumpPlayer(), begin: () => { ui.brief.hidden = true; startField(); if (state.introActive) finishIntro(true); }
        },
        menu: () => Object.entries(demo.MENU || {}).flatMap(([g, items]) => items.map(it => ({ id: it.id, group: g, label: it.cap, value: String(it.val()), on: !!(it.on && it.on()), run: () => it.act() })))
      };
      ui.say.addEventListener("submit", e => { e.preventDefault(); const v = ui.input.value.trim(); if (v) demoSay(v); ui.input.value = ""; ui.input.blur(); document.body.classList.remove("demo-typing"); });
      ui.input.addEventListener("keydown", e => { if (e.code === "Escape") ui.input.blur(); });
      ui.voice.onclick = () => { demo.voice = !demo.voice; ui.voice.setAttribute("aria-pressed", demo.voice); ui.voice.textContent = demo.voice ? "Voice on" : "Voice off"; if (!demo.voice && window.speechSynthesis) speechSynthesis.cancel(); };
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) ui.mic.hidden = true;
      else ui.mic.onclick = () => {
        if (demo.rec) { demo.rec.stop(); return; }
        const rec = demo.rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; rec.maxAlternatives = 1; ui.mic.setAttribute("aria-pressed", "true");
        rec.onresult = ev => { const r = ev.results[ev.results.length - 1]; ui.input.value = r[0].transcript; if (r.isFinal) { const v = ui.input.value.trim(); ui.input.value = ""; if (v) demoSay(v); } };
        rec.onend = rec.onerror = () => { demo.rec = null; ui.mic.setAttribute("aria-pressed", "false"); };
        try { rec.start(); } catch (e) { demo.rec = null; ui.mic.setAttribute("aria-pressed", "false"); }
      };
      demo.voice = true; demo.thread = [];
      return ui;
    }
    function demoThread(who, text, me) {
      demo.thread.push([who, text, me]); if (demo.thread.length > 4) demo.thread.shift();
      demo.ui.thread.innerHTML = ""; for (const [w, t, m] of demo.thread) { const s = document.createElement("span"); if (m) s.className = "me"; s.textContent = (m ? "" : w + ": ") + t; demo.ui.thread.append(s); }
    }
    // What is written on the glass is in the language of the rain; the recorded voice stays English for now.
    function demoTr(text) {
      const Tm = demo.tr; if (!Tm) return text;
      const nm = n => { const w = n.trim().split(" ").pop(), t = Tm[n.trim() + "."] || Tm[w + "."]; return t ? t.replace(/[.。።]\s*$/, "") : n; };   // a name in the script of the rain
      const sep = demo.lang === "am" ? "፣ " : demo.lang === "zh" ? "、" : ", ";
      const sent = s => { const nums = s.match(/\d+/g) || []; let k = s.replace(/\d+/g, "{n}"), name = null, list = null, m;
        if ((m = /^That is for (.+)\.$/.exec(s))) { k = "That is for {name}."; name = nm(m[1]); }
        else if ((m = /^Ask me about (.+)\.$/.exec(s))) { k = "Ask me about {list}."; list = m[1].split(/,\s*|\s+or\s+/).map(x => Tm[x.trim()] || x.trim()).join(sep); }
        let t = Tm[k]; if (!t) return s; let i = 0; return t.replace(/\{n\}/g, () => nums[i++] ?? "").replace("{name}", name || "").replace("{list}", list || ""); };
      const speech = q => q.split(/(?<=[.?!])\s+/).map(sent).join(" ");
      return text.replace(/“([^”]*)”/g, (_, q) => "“" + speech(q) + "”").replace(/^(.+?) looks at your can: (\d+) L\./m, (m, n, l) => (Tm["{name} looks at your can: {n} L."] || m).replace("{name}", nm(n)).replace("{n}", l))
        .replace(/(^|” )([A-Z][\w ]+?) points\./, (m, a, n) => a + (Tm["{name} points."] || "{name} points.").replace("{name}", nm(n))).replace(/(^|” )([A-Z][\w ]+?) waits\./, (m, a, n) => a + (Tm["{name} waits."] || "{name} waits.").replace("{name}", nm(n)));
    }
    // A person speaks: bubble over the head, mouth and hands move, the body holds a pose that fits, a voice reads it.
    function demoSpeakAs(ch, r) {
      const ui = demoUi(), text = r.say, dur = Math.max(1.8, r.hold || 0, 1.1 + text.length * .052);
      if (demo.line && demo.line.ch !== ch) demoRestore();
      if (!demo.line || demo.line.ch !== ch) demo.keep = { pose: ch.state.pose, opts: ch.state.poseOpts };
      ch.setPose({ pose: r.pose || demo.keep.pose, speaking: true, emotion: r.emotion || "speaking_animated", emotionIntensity: .9,
        handGestureL: r.gesture || "talking_gesticulate", handGestureR: r.pose ? undefined : "talking_gesticulate", expressiveArmGesture: true, phoneOut: r.phone ? true : undefined });
      demo.line = { ch, text: demoTr(text), t: 0, dur, end: r.end, seq: (demo.lineSeq = (demo.lineSeq || 0) + 1) };
      ui.bub.firstElementChild.textContent = demoName(ch); ui.bub.hidden = false;
      if (demo.dew) {                                                       // the line condenses beside the speaker; said aloud it will fall, refused or narrated it will smoke
        if (demo.msg) demo.msg.end(demo.msg.kind);
        demo.msg = demo.dew.say({ name: demoName(ch), text: "", anchor: () => {
          demoV.set(ch.state.x, (ch.state.y || 0) + 1.98, ch.state.z).project(camera); if (demoV.z >= 1 || Math.abs(demoV.x) > 1.15) return null;
          return [clamp((demoV.x * .5 + .5) * innerWidth, 24, innerWidth - 24), clamp((-demoV.y * .5 + .5) * innerHeight, 74, innerHeight - 200)]; } });
        demo.msg.kind = /“/.test(text) && !/^“Not (yet|here)\.”/.test(text) ? "fall" : "smoke";
      }
      demoThread(demoName(ch), text, false);
      // the voice: the recorded Kokoro line for exactly what is said aloud, from the speaker's head; the system voice only if none
      const spoken = (text.match(/“[^”]+”/g) || []).map(q => q.slice(1, -1).trim()).join(" ").trim();
      if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { }
      if (!demo.voice || !spoken) return;
      const vm = demo.voiceMan, rec = vm && vm.lines[ch.state.id + "|" + spoken], L = demo.line;
      demo.lastVoice = { key: ch.state.id + "|" + spoken, found: !!rec, man: !!vm, field: !!(field && field.ready) };
      if (rec && field && field.ready) {
        const head = new T.Vector3(ch.state.x, (ch.state.y || driveSurfaceAt(ch.state.x, ch.state.z)) + 1.62 * (ch.state.scale || 1), ch.state.z);
        field.say("./voice/" + rec[0], head, { rate: (vm.cast[ch.state.id] || {}).rate || 1, label: demoName(ch) }).then(v => {
          if (!v || demo.line !== L) return; L.voice = v.voice; L.dur = Math.max(L.dur * .6, v.duration + .7);
        });
      } else if (window.speechSynthesis) try {
        const u = new SpeechSynthesisUtterance(spoken);
        let h = 0; for (const k of ch.state.id) h = (h * 31 + k.charCodeAt(0)) % 97; u.pitch = .75 + (h % 50) / 100; u.rate = .95; speechSynthesis.speak(u);
      } catch (e) { /* no voice available */ }
    }
    /* ---------- One tap on a phone: the verbs this stop allows, and the questions this person can answer ---------- */
    const DEMO_VERB = {
      pump: { label: "Draw water", who: "saba", ask: "draw", kind: "draw" },
      cool: { label: "Give 9 L to the cooler", who: "ppc_op_male", ask: "cool the rack", kind: "pour" },
      tap: { label: "Pour 4 L at the tap", who: "compound_lead", ask: "pour at the public tap", kind: "pour" },
      ask: { label: "Ask the aunt’s leave", who: "aunt_lemlem", ask: "may i have your permission", kind: "talk" },
      copy: { label: "Load the licensed cuts", who: "ppc_op_female", ask: "write and load it", kind: "talk" },
      listen: { label: "Pass the earphone", who: "compound_lead", ask: "let them listen", kind: "talk" },
      screen: { label: "Play it for the aunt", who: "compound_lead", ask: "screen it", kind: "talk" }
    };
    const DEMO_Q = { who: "Who are you?", water: "About my water?", chalk: "The chalk mark?", donkey: "The donkey?", song: "The song?", aunt: "The aunt?",
      beacon: "The beacon?", archive: "The archive?", compound: "The yard?", phone: "Show me your phone" };
    function demoFocus(ch) { if (!ch || ch === activeAvatar) return; if (demo.line && demo.line.ch !== ch) demoRestore(); demo.withCh = ch; demo.metAt = demo.clock; demo.pinned = ch; }
    function demoDo(id) {
      const V = DEMO_VERB[id], ch = V && cast.byId && cast.byId[V.who]; if (!ch || demo.handoff) return;
      demoFocus(ch); demo.greeted = true; demoThread("You", V.label, true);
      const r = demoAnswer(ch, V.ask); demoSpeakAs(ch, r);
      if (r.action && V.kind !== "talk") demoHandoff(V.kind, ch);
      demo.dockSig = "";
    }
    function demoFlash() {                                                    // the plate you just made, flying into the status chip
      const pl = state.plates.at(-1); if (!pl || !pl.dataUrl) return;
      const im = document.createElement("img"); im.id = "dk-flash"; im.className = "dk"; im.src = pl.dataUrl; document.body.append(im);
      setTimeout(() => im.classList.add("fly"), 650); setTimeout(() => im.remove(), 1400); demo.dockSig = "";
    }
    function demoShowPlate() {                                                // the last plate, held in a large drop for a moment, then it falls
      const pl = state.plates.at(-1); if (!pl || !pl.dataUrl) return;
      const im = document.createElement("img"); im.className = "dk dk-plate"; im.alt = `Plate ${pl.id}, ${pl.place}`; im.src = pl.dataUrl; document.body.append(im);
      requestAnimationFrame(() => im.classList.add("on")); setTimeout(() => im.classList.add("fall"), 2600); setTimeout(() => im.remove(), 3600);
    }
    function demoBeads(force) {
      const ui = demo.ui; if (!ui || !demo.menuOpen || !demo.MENU) return;
      const rail = document.getElementById("dk-rail"), row = document.getElementById("dk-row"), items = demo.MENU[demo.menuGroup] || [];
      for (const b of rail.children) b.classList.toggle("on", b.dataset.group === demo.menuGroup);
      if (row.dataset.group !== demo.menuGroup) {
        row.dataset.group = demo.menuGroup;
        row.innerHTML = items.map(it => `<button type="button" class="bead" data-item="${it.id}" data-icon="${{ cam: "eye", glide: "wing", jump: "jump", drive: "drive", lang: "ask" }[it.id] || it.id}" aria-label="${it.cap}"><i></i><em>${it.cap}</em></button>`).join(""); row.scrollLeft = 0;
      }
      items.forEach((it, k) => { const b = row.children[k]; if (!b) return; const v = it.val(), i = b.firstElementChild;
        if (i.textContent !== v) i.textContent = v; b.classList.toggle("on", !!(it.on && it.on()));
        const img = it.img ? it.img() : ""; if ((b.dataset.img || "") !== (img ? "1" + img.length : "")) { b.dataset.img = img ? "1" + img.length : ""; b.style.backgroundImage = img ? `radial-gradient(circle at 32% 26%,rgba(255,255,255,.5),rgba(255,255,255,0) 30%),url(${img})` : ""; b.classList.toggle("pic", !!img); } });
    }
    // The deck shows only what is true now. Each element is bound to the state that makes it so:
    //   gauge + signal  always (they change every choice); place name  for 4 s after you arrive
    //   a stop's verb   only while it is allowed, with its consequence; a refused verb is not shown
    //   Talk to <name>  only within reach of a person; the questions only after you choose to talk (× returns)
    //   Water the donkey only when she is thirsty and you carry water; Ride only beside her
    //   Drive / Park / Get down  only beside the wagon, in it, or on the donkey
    //   Expose          always: making a plate is always possible and always yours
    function demoLiveDo() {
      const L = demo.live; if (!L || demo.handoff) return false;
      if (L.verb) demoDo(L.verb);
      else if (L.ctx && L.ctx !== "share") { const a = (state.ctxActs || []).find(a => a.id === L.ctx); if (a) a.fn(); }
      else if (L.ctx === "share" && demo.carryFromCan) { const a = (state.ctxActs || []).find(a => a.id === "share"); if (a) a.fn(); }
      else if (L.ask) { const who = L.ask, kb = DEMO_KB[who.state.id] || {}, list = ["who", ...Object.keys(kb).filter(k => k !== "who" && kb[k] && DEMO_Q[k]), "where"];
        const ix = demo.askIx || (demo.askIx = {}), k = list[(ix[who.state.id] || 0) % list.length]; ix[who.state.id] = (ix[who.state.id] || 0) + 1; demoFocus(who); demoSay(k === "where" ? "Where next?" : DEMO_Q[k]); }
      demo.dockSig = ""; return true;
    }
    function demoDock(dt) {
      const ui = demo.ui; if (!ui) return;
      demo.dockT = (demo.dockT || 0) - dt; if (demo.dockT > 0) return; demo.dockT = .25;
      const c = npCarrier(), busy = !!demo.handoff, q = id => document.getElementById(id), onFoot = !state.drivingCart && !state.riding && !state.gliding;
      // SENSE
      q("dk-status").querySelector(".can i").style.width = Math.min(100, c.liters / 20 * 100) + "%";
      const lt = `${c.liters} L`; if (q("dk-l").textContent !== lt) q("dk-l").textContent = lt;
      q("dk-status").dataset.fill = (c.liters / 20).toFixed(3); q("dk-g-donkey").dataset.fill = clamp(state.donkeyWater, 0, 1).toFixed(2); q("dk-g-donkey").dataset.stain = state.donkeyCollapsed || state.donkeyWater < .35 ? "urgent" : "go";
      q("dk-g-donkey").hidden = !(state.donkeyCollapsed || state.donkeyWater < .5);                  // her drop is on the glass only when she is thirsty
      q("dk-g-signal").dataset.fill = ((demo.signal || 0) / 4).toFixed(2);
      q("dk-status").dataset.dewLabel = lt; q("dk-status").dataset.dewScale = (.72 + .4 * c.liters / 20).toFixed(2);          // the litres are a drop as big as what you carry
      if (demo.lastL != null && demo.lastL !== c.liters && demo.dew) {            // the change itself, beside the gauge, then it falls
        const dl = c.liters - demo.lastL, r = q("dk-status").getBoundingClientRect(), m = demo.dew.say({ text: (dl > 0 ? "+" : "−") + Math.abs(dl) + " L", anchor: () => [r.left + 26, r.bottom + 22] });
        m.set(m.full || ((dl > 0 ? "+" : "−") + Math.abs(dl) + " L"), 1); setTimeout(() => m.end("fall"), 1800);
      }
      demo.lastL = c.liters;
      [...q("dk-sig").children].forEach((b, i) => b.classList.toggle("on", i < (demo.signal || 0)));
      const place = typeof currentPlaceName === "function" ? currentPlaceName() : "";
      if (place !== demo.shownPlace) { demo.shownPlace = place; demo.placeUntil = (demo.clock || 0) + 4000; q("dk-place").textContent = place; }
      q("dk-place").classList.toggle("gone", (demo.clock || 0) > (demo.placeUntil || 0));
      demoBeads();
      // vehicle: only where it is real
      const dWagon = Math.hypot(wagon.x - state.x, wagon.z - state.z), dDonkey = Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z);
      const veh = onFoot && dWagon < 7.5 ? "Drive" : "";
      q("dk-veh").hidden = !veh; if (veh && q("dk-veh-l").textContent !== veh) q("dk-veh-l").textContent = veh;
      q("dk-jump").hidden = !onFoot;
      // ACT: verbs the water law allows here, now
      let verbs = [];
      if (!busy && onFoot) { let opts = []; try { opts = npEngine.options(npState) || []; } catch (e) { }
        verbs = opts.filter(o => { const V = DEMO_VERB[o.id], ch = V && cast.byId && cast.byId[V.who];
          return o.enabled && ch && DEMO_STOP_OF[V.who] === c.place && Math.hypot(ch.state.x - state.x, ch.state.z - state.z) < 9; }); }
      const ctx = state.ctxActs || [], get = id => ctx.find(a => a.id === id);
      const extra = [];
      if (!busy && onFoot && (state.donkeyCollapsed || (state.donkeyWater < .5 && c.liters > 0)) && get("water-burro")) extra.push({ id: "water-burro", label: state.donkeyCollapsed ? "Water the donkey now" : "Water the donkey", urgent: state.donkeyCollapsed });
      if (!busy && onFoot && !verbs.length && dDonkey < 2.6 && !demo.withCh && get("ride")) extra.push({ id: "ride", label: "Ride the donkey" });
      // what your state needs is stubborn: in the air you can always come down, mounted you can always get off, driving you can always park
      const must = busy ? [] : state.gliding ? [{ k: "land", label: state.donkeyOnRoof ? glideActionLabel() : "Come down" }] : state.riding ? [{ k: "down", label: "Get down" }] : state.drivingCart ? [{ k: "park", label: "Park the wagon" }, { k: "fly", label: "Take off" }] : [];
      if (!busy && onFoot && demo.withCh && c.liters > 0 && !verbs.length && get("share")) extra.push({ id: "share", label: "Share water" });
      const ch = !busy && onFoot ? demo.withCh : null;
      if (!ch || (demo.talkWith && demo.talkWith !== ch)) demo.talking = false;     // talking is with one person; walking to another asks again
      if (demo.talking) demo.talkWith = ch; else demo.talkWith = null;
      // WET THINGS. The glass offers nothing. The one thing in the world you can act on gets wet, and water moves between
      // the can and that thing: carry from the pump to the can to draw, from the can to a person, tap or donkey to give.
      // A person with nothing to take is touched to be asked. The only control drawn for you is the way out of a state.
      const speaking = !!demo.line; let live = null;
      const urg = extra.find(a => a.urgent);
      if (!busy && !speaking && onFoot) {
        if (urg) live = { kind: "give", ctx: urg.id, at: "donkey", dl: 0 };
        else if (verbs.length) { const o = verbs[0], V = DEMO_VERB[o.id], m = /(\d+)\s*L/.exec(V.label);
          live = { kind: V.kind === "draw" ? "draw" : V.kind === "talk" ? "talk" : "give", verb: o.id, at: o.id === "pump" ? "pump" : "ch:" + V.who, dl: o.id === "pump" ? 20 - c.liters : V.kind === "talk" ? 0 : m ? -(+m[1]) : 0 }; }
        else if (extra.some(a => a.id === "share")) live = { kind: "give", ctx: "share", at: "ch:" + ch.state.id, dl: 0, ask: ch };
        else if (ch) live = { kind: "talk", ask: ch, at: "ch:" + ch.state.id, dl: 0 };
      }
      demo.live = live;
      const st = q("dk-status"); if (live && live.dl) st.dataset.ghost = (clamp(c.liters + live.dl, 0, 20) / 20).toFixed(3); else delete st.dataset.ghost;   // what this act would leave in the can
      const sig = must.map(m => m.k + m.label).join() + (speaking ? "s" : "");
      if (sig === demo.dockSig) return; demo.dockSig = sig;
      ui.verbs.innerHTML = must.map((m, i) => `<button type="button" class="verb${i ? " alt" : ""}" data-do="${m.k}" data-key="m:${m.k}" data-plain="1" data-stain="go" data-anchor="self">${m.label}</button>`).join("");
      ui.chips.hidden = true; ui.chips.innerHTML = "";
    }
    // Information condenses where its thing is: each action drop sits on the pump, the person or the donkey it belongs to,
    // and a person's questions bead around their head. Off screen or behind you, a drop waits at the nearest edge.
    function demoAnchors() {
      const ui = demo.ui; if (!ui) return; const Wd = innerWidth, Hd = innerHeight, placed = [];
      const proj = (x, y, z) => { demoV.set(x, y, z).project(camera); return demoV.z < 1 ? [(demoV.x * .5 + .5) * Wd, (-demoV.y * .5 + .5) * Hd] : null; };
      const chPos = (id, up) => { const c = cast.byId && cast.byId[id]; if (!c) return null; const w = c.group.getWorldPosition(hoV.pR); return proj(w.x, w.y + up, w.z); };
      const put = (b, p, hw, hh, self) => {
        let x = p ? p[0] : Wd * .5, y = p ? p[1] : Hd - 150;
        if (p && !self) { const out = p[0] >= Wd / 2 ? 1 : -1; x = p[0] + out * (hw + 36); y = p[1] - 8;                    // beside its thing, on the outer side
          if (x > Wd * .3 - hw && x < Wd * .7 + hw && y > Hd * .3 && y < Hd * .8) x = out > 0 ? Wd * .7 + hw + 4 : Wd * .3 - hw - 4; }   // never over the middle of the glass
        x = clamp(x, hw + 12, Wd - hw - 12); y = clamp(y, 96 + hh, Hd - (self ? 70 : 150));
        for (let n = 0; n < 6; n++) { const hit = placed.find(q => Math.abs(q[0] - x) < q[2] + hw + 6 && Math.abs(q[1] - y) < q[3] + hh + 6); if (!hit) break; y = hit[1] + hit[3] + hh + 8; if (y > Hd - 150) { y = hit[1] - hit[3] - hh - 8; } }
        placed.push([x, y, hw, hh]); b.style.left = x + "px"; b.style.top = y + "px";
        if (p && !self) { b.dataset.ax = Math.round(p[0]); b.dataset.ay = Math.round(p[1]); } else { delete b.dataset.ax; delete b.dataset.ay; }
        const rp = b.dataset.topic ? ref(b.dataset.topic) : p && !self ? p : null;                      // what this drop looks at
        if (rp && rp[0] > 0 && rp[0] < Wd && rp[1] > 0 && rp[1] < Hd) { b.dataset.rx = Math.round(rp[0]); b.dataset.ry = Math.round(rp[1]); } else { delete b.dataset.rx; delete b.dataset.ry; }
      };
      const setP = k => proj(DEMO_SETS[k][0], driveSurfaceAt(DEMO_SETS[k][0], DEMO_SETS[k][1]) + (k === "beacon" ? 16 : 2.5), DEMO_SETS[k][1]);
      const ref = t => { const who = ui.chips.dataset.who, c = npCarrier();
        return t === "who" || t === "phone" ? chPos(who, 1.6) : t === "water" ? proj(state.x, driveSurfaceAt(state.x, state.z) + 1.0, state.z) : t === "chalk" ? setP("basalt") : t === "donkey" ? proj(donkey.state.x, donkey.group.position.y + 1.1, donkey.state.z)
          : t === "aunt" ? chPos("aunt_lemlem", 1.6) : t === "beacon" ? setP("beacon") : t === "archive" ? setP("hill") : t === "compound" ? setP("compound")
          : t === "where" ? setP(["basalt", "beacon", "hill", "compound"].find(k => !c.visited.includes(k)) || "compound") : null; };
      for (const b of ui.verbs.children) { const r = b.getBoundingClientRect(); put(b, [Wd / 2, Hd - 86], r.width / 2 || 60, r.height / 2 || 27, true); }
      const L = demo.live; let wt = null;
      if (L) { const a = L.at, p = a === "pump" ? proj(DEMO_SETS.basalt[0], driveSurfaceAt(DEMO_SETS.basalt[0], DEMO_SETS.basalt[1]) + 1.0, DEMO_SETS.basalt[1]) : a === "donkey" ? proj(donkey.state.x, donkey.group.position.y + 1.0, donkey.state.z) : chPos(a.slice(3), 1.0);
        if (p && p[0] > 20 && p[0] < Wd - 20 && p[1] > 70 && p[1] < Hd - 60) { const d = a === "pump" ? Math.hypot(DEMO_SETS.basalt[0] - state.x, DEMO_SETS.basalt[1] - state.z) : 3; wt = { x: p[0], y: p[1], r: clamp(150 / Math.max(2, d), 34, 62), kind: L.kind }; } }
      demo.wetPos = wt; if (demo.dew) { demo.dew.wetThing = wt; demo.dew.lure = wt ? [wt.x, wt.y] : null; }
    }
    // Commands fall as rain. Each one that fits your state drops in from above now and then, sticks for as long as it matters
    // (stick, in seconds), sags as its time runs out, then lets go and runs down the glass. Touch it while it is there.
    const DEMO_OFFERS = [
      { id: "map", label: "Map", stick: 7, when: () => true, act: () => toggleBigMap() },
      { id: "ride", label: "Ride the donkey", stick: 9, at: "donkey", when: () => !state.riding && !state.drivingCart && !state.gliding && !state.donkeyCollapsed && Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z) < 9, act: () => toggleRide() },
      { id: "glide", label: "Base jump", stick: 6, when: () => !state.gliding && !state.drivingCart && !state.riding, act: () => toggleGlide() },
      { id: "lidar", label: "Lidar", stick: 5, when: () => true, act: () => toggleLidar() },
      { id: "plates", label: "Your plates", stick: 6, when: () => state.plates.length > 0, act: () => demoShowPlate() },
      { id: "listen", label: "Listen", stick: 6, when: () => true, act: () => { startField(); if (field) field.panel(!field.panelOpen); } },
      { id: "view", label: "Through her eyes", stick: 5, when: () => !state.drivingCart && !state.gliding && state.cameraMode === "third", act: () => toggleCameraMode() },
      { id: "view3", label: "Step back", stick: 8, when: () => !state.drivingCart && !state.gliding && state.cameraMode !== "third", act: () => toggleCameraMode() },
      { id: "squirt", label: "Squirt water", stick: 4, when: () => npCarrier().liters > 0 && !state.drivingCart && !state.gliding, act: () => triggerSquirtBurst(1.4) },
      { id: "throw", label: "Throw the can", stick: 4, when: () => npCarrier().liters > 0 && !state.drivingCart && !state.gliding && !state.riding, act: () => throwObject() },
      { id: "dance", label: "Dance", stick: 4, when: () => !state.drivingCart && !state.gliding, act: () => triggerDance() },
      { id: "radio", label: "Tune the radio", stick: 8, when: () => state.drivingCart && field && field.radio, act: () => field.radio.tune() },
      { id: "jump", label: "Jump", stick: 4, when: () => !state.drivingCart && !state.gliding && !state.riding, act: () => jumpPlayer() }
    ];
    function demoOfferTake(b) { const o = DEMO_OFFERS.find(x => x.id === b.dataset.offer); b.remove(); if (o) o.act(); demo.dockSig = ""; }
    function demoOffers(dt) {
      const ui = demo.ui, box = document.getElementById("dk-offers"); if (!ui || !box || !demo.dew) return;
      if (!demo.offersOn) { if (box.children.length) box.innerHTML = ""; return; }                    // the glass stays empty unless something is true
      const now = demo.clock || 0, quiet = demo.handoff || demo.menuOpen || document.body.classList.contains("demo-typing") || !ui.brief.hidden;
      for (const b of [...box.children]) { const o = DEMO_OFFERS.find(x => x.id === b.dataset.offer), age = (now - +b.dataset.born) / 1000;
        if (!o || !o.when() || age > o.stick || quiet) b.remove(); }                                  // its time is up, or it is no longer true: it lets go
      // small written droplets: what you would want to know, falling now and then at the edge
      demo.hintT = (demo.hintT ?? 6) - dt;
      if (false && !quiet && demo.hintT <= 0) {
        demo.hintT = 11 + Math.random() * 7; const c = npCarrier(), H = [], seen = demo.hinted || (demo.hinted = {});
        try { for (const o of npEngine.options(npState) || []) { const V = DEMO_VERB[o.id]; if (V && !o.enabled && o.reason && DEMO_STOP_OF[V.who] === c.place) H.push(["r:" + o.id, `${V.label}: ${o.reason.replace(/\.$/, "").toLowerCase()}.`]); } } catch (e) { }
        if (state.donkeyCollapsed) H.push(["dk", "The donkey is down. She needs water now."]); else if (state.donkeyWater < .5) H.push(["dk", "The donkey is thirsty."]);
        if (c.liters <= (c.reserve || 4) && c.place !== "basalt") H.push(["dry", "Only the reserve is left. The pump refills you."]);
        if (c.liters > 0 && (demo.signal || 0) === 1) H.push(["los", "The ridge hides the beacon. No signal here."]);
        const nx = ["basalt", "beacon", "hill", "compound"].find(k => !c.visited.includes(k)); if (nx) H.push(["nx:" + nx, "Next: " + DEMO_SETS[nx][2] + "."]);
        const pick = H.filter(h => now - (seen[h[0]] || -1e9) > 50000)[0];
        if (pick) { seen[pick[0]] = now; const left = Math.random() < .5, y = innerHeight * (.2 + Math.random() * .16), m = demo.dew.say({ me: true, text: pick[1], anchor: () => [left ? 26 : innerWidth - 26, y] }); m.set(pick[1], 1); setTimeout(() => m.end("fall"), 5200); }
      }
      demo.offerT = (demo.offerT || 2.5) - dt; if (quiet || demo.offerT > 0 || box.children.length >= 2) return;
      demo.offerT = 3 + Math.random() * 3.5; demo.offered = demo.offered || {};
      const pool = DEMO_OFFERS.filter(o => o.when() && now - (demo.offered[o.id] || -1e9) > 26000 && !box.querySelector(`[data-offer="${o.id}"]`)); if (!pool.length) return;
      const o = pool[Math.floor(Math.random() * pool.length)]; demo.offered[o.id] = now;
      const b = document.createElement("button"); b.type = "button"; b.className = "verb alt offer"; b.dataset.offer = o.id; b.dataset.born = now; b.dataset.dewLife = o.stick; b.textContent = o.label;
      const OI = { map: ["map", "go"], ride: ["ride", "go"], glide: ["wing", "go"], lidar: ["lidar", "lens"], plates: ["plates", "lens"], listen: ["listen", "sys"], view: ["eye", "lens"], view3: ["back", "lens"], squirt: ["squirt", "water"], throw: ["throw", "water"], dance: ["dance", "go"], radio: ["radio", "sys"], jump: ["jump", "go"] }[o.id] || ["drop", "water"];
      b.dataset.icon = OI[0]; b.dataset.stain = OI[1];
      let x = Math.random() < .5 ? 64 + Math.random() * innerWidth * .2 : innerWidth - 64 - Math.random() * innerWidth * .2, y = innerHeight * (.2 + Math.random() * .3);
      if (o.at === "donkey") { demoV.set(donkey.state.x, donkey.group.position.y + 1.5, donkey.state.z).project(camera); if (demoV.z < 1 && Math.abs(demoV.x) < .85) { x = clamp((demoV.x * .5 + .5) * innerWidth, 70, innerWidth - 70); y = clamp((-demoV.y * .5 + .5) * innerHeight, 120, innerHeight - 220); } }
      b.style.left = x + "px"; b.style.top = y + "px"; box.append(b);
    }
    /* ---------- A can changing hands, with weight: step in, lift, both hold, the other takes it, sets it down or pours ---------- */
    const hoV = { a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3(), gL: new T.Vector3(), gR: new T.Vector3(), pL: new T.Vector3(), pR: new T.Vector3() };
    function demoHandoff(kind, ch) {
      if (!activeAvatar || state.cameraMode !== "third" || !window.makeWaterWifiCan) return;
      if (!demo.can) {
        demo.can = window.makeWaterWifiCan(T); demo.can.canRoot.visible = false; actorRoot.add(demo.can.canRoot);
        // two hands on the top handle, for when the can is low (the heave grip under the base is out of reach near the ground)
        for (const [k, x] of [["handleL", -.045], ["handleR", .045]]) { const o = new T.Object3D(); o.position.set(x, .208, -.022); demo.can.canRoot.add(o); demo.can[k] = o; }
      }
      const w = kind === "draw" ? { x: DEMO_SETS.basalt[0], z: DEMO_SETS.basalt[1] } : ch.group.getWorldPosition(new T.Vector3());   // world, not a set's local frame
      const dx = w.x - state.x, dz = w.z - state.z, d = Math.hypot(dx, dz) || 1;
      demo.handoff = { kind, ch, N: { x: w.x, z: w.z }, t: 0, dur: kind === "draw" ? 5.2 : 4.8, dir: [dx / d, dz / d], from: [state.x, state.z], fired: {},
        keep: demo.keep && demo.line && demo.line.ch === ch ? demo.keep : { pose: ch.state.pose, opts: ch.state.poseOpts }, liters: npCarrier().liters };
    }
    function demoHandoffTick(dt) {
      const H = demo.handoff; if (!H) return;
      if (demo.dew && (H.memT = (H.memT || 0) - dt) <= 0) { H.memT = .55; demo.dew.remember(); }                // the action, kept frame by frame
      H.t += dt; const u = Math.min(1, H.t / H.dur), ch = H.ch, can = demo.can, A = activeAvatar, sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
      const [dx, dz] = H.dir, rx = -dz, rz = dx, hdg = Math.atan2(dx, dz);
      const N = H.N, gy = (x, z) => driveSurfaceAt(x, z);
      // step to a working distance, facing the pump, the person or the rack; a free-standing receiver turns to you
      const stand = H.kind === "give" ? .95 : H.kind === "draw" ? 1.1 : 1.05, curD = Math.hypot(N.x - H.from[0], N.z - H.from[1]);
      const sxp = N.x - dx * Math.min(stand, curD), szp = N.z - dz * Math.min(stand, curD), k = sm(0, .12, u);
      state.x = H.from[0] + (sxp - H.from[0]) * k; state.z = H.from[1] + (szp - H.from[1]) * k;
      state.y = gy(state.x, state.z) + 1.68; state.avatarHeading = hdg; if (carrierPhys) { carrierPhys.vx = carrierPhys.vz = 0; }
      if (H.kind === "give") { ch.state.heading = hdg + Math.PI; ch.group.rotation.y = hdg + Math.PI; }
      const P = { x: state.x, z: state.z }, y0 = gy(P.x, P.z), yN = gy(N.x, N.z);
      const side = hoV.a.set(P.x + dx * .34, y0 + .62, P.z + dz * .34);            // carried two-handed in front, handle at the hips (inside the arms' reach)
      const mid = hoV.b.set(P.x + dx * .5, (y0 + yN) / 2 + 1.0, P.z + dz * .5);
      const pos = hoV.c; let tilt = 0;
      if (H.kind === "draw") {                                                    // set the can under the spout, let it fill, lift it back
        const ground = new T.Vector3(P.x + dx * .5, y0 + .26, P.z + dz * .5);
        if (u < .25) pos.lerpVectors(side, ground, sm(.05, .25, u)); else if (u < .72) pos.copy(ground); else pos.lerpVectors(ground, side, sm(.72, .95, u));
        can.innerLiq.scale.y = lerp(.2, 1, sm(.3, .7, u));
      } else if (H.kind === "pour") {                                            // carry it in front, lower it, tip it, bring it back empty-ish
        const front = new T.Vector3(P.x + dx * .45, y0 + .82, P.z + dz * .45), low = new T.Vector3(P.x + dx * .55, y0 + .55, P.z + dz * .55);
        if (u < .12) pos.copy(side); else if (u < .32) pos.lerpVectors(side, front, sm(.12, .32, u)); else if (u < .42) pos.lerpVectors(front, low, sm(.32, .42, u));
        else if (u < .8) { pos.copy(low); tilt = 1.3 * sm(.42, .52, u) * (1 - sm(.74, .8, u)); can.innerLiq.scale.y = lerp(Math.max(.25, H.liters / 20), .45, sm(.48, .76, u)); }
        else pos.lerpVectors(low, side, sm(.8, .97, u));
        if (u < .4) can.innerLiq.scale.y = Math.max(.25, Math.min(1, H.liters / 20));
      } else {
        const recv = new T.Vector3(N.x - dx * .3, yN + .96, N.z - dz * .3);
        const down = new T.Vector3(N.x - rx * .36, yN + .19, N.z - rz * .36);
        if (u < .14) pos.copy(side); else if (u < .34) pos.lerpVectors(side, mid, sm(.14, .34, u)); else if (u < .55) pos.copy(mid).y += .02 * Math.sin(H.t * 9);
        else if (u < .75) pos.lerpVectors(mid, recv, sm(.55, .75, u));
        else if (H.kind === "pour") { pos.copy(recv).y -= .25 * sm(.75, .85, u); tilt = 1.25 * sm(.78, .86, u) * (1 - sm(.95, 1, u)); can.innerLiq.scale.y = lerp(1, .4, sm(.8, .97, u)); }
        else pos.lerpVectors(recv, down, sm(.75, .95, u));
        if (u < .5) can.innerLiq.scale.y = Math.max(.25, Math.min(1, H.liters / 20));
      }
      can.canRoot.visible = u < .99 || H.kind === "give"; can.canRoot.position.copy(pos);
      can.canRoot.rotation.set(tilt, H.kind === "draw" ? hdg : hdg + (u > .62 ? Math.PI : 0), 0);
      can.canRoot.updateMatrixWorld(true);
      const low = pos.y - y0 < .55 || tilt > .1;                                  // low or tipping: both hands on the handle; carried: handle and base
      (low ? can.handleL : can.gripLeadL).getWorldPosition(hoV.gL); (low ? can.handleR : can.gripLeadR).getWorldPosition(hoV.gR); can.gripPartnerL.getWorldPosition(hoV.pL); can.gripPartnerR.getWorldPosition(hoV.pR);
      // the hands: yours on the handle while you hold it; theirs under it once they take the weight
      const youHold = H.kind === "draw" ? (u < .27 || u > .71) : H.kind === "pour" ? u < .98 : u < .64;
      if (youHold) { A.setPose(H.kind === "pour" && tilt > .15 ? "pourBowl" : "unloadHandoff"); A.state.poseOpts = { worldGripL: hoV.gL.clone(), worldGripR: hoV.gR.clone(), unloadRole: "lead", unloadPhase: .3 }; A.state.scripted = true; }
      else if (A.state.scripted) { A.setPose("idle"); A.state.scripted = false; }
      if (H.kind === "give" && u > .36) {
        const pour = H.kind === "pour" && u > .76;
        ch.setPose(pour ? "pourBowl" : "childReceive20kg");
        ch.state.poseOpts = { ...(ch.state.poseOpts || {}), speaking: !!demo.line, worldGripL: (pour ? hoV.gL : hoV.pR).clone(), worldGripR: (pour ? hoV.gR : hoV.pL).clone(), unloadRole: "child", unloadPhase: .5 };
      }
      // the camera steps to the side for a two-shot, then gives you back the road
      const M = new T.Vector3((P.x + N.x) / 2, (y0 + yN) / 2, (P.z + N.z) / 2);
      H.camT = (H.camT || 0) - dt;
      if (H.cam === undefined || H.camT <= 0) {                                   // a high three-quarter view onto the hands, with a clear line of sight
        H.camT = .5;
        const ray = demo.ray || (demo.ray = new T.Raycaster()), from = pos.clone();
        if (!H.blockers) {
          const people = new Set(cast.list.map(c => c.group)); if (demo.can) people.add(demo.can.canRoot);
          const inPerson = o => { for (let q = o, n = 0; q && n < 9; q = q.parent, n++) if (people.has(q)) return true; return false; };
          H.blockers = []; mw.world.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.visible && o.geometry && !inPerson(o)) { const wp = o.getWorldPosition(hoV.pL); if (Math.hypot(wp.x - M.x, wp.z - M.z) < 14) H.blockers.push(o); } });
        }
        const dkx = donkey.state.x - M.x, dkz = donkey.state.z - M.z, away = (dkx * rx + dkz * rz) > 0 ? -1 : 1;   // the side the donkey is not on
        let best = null;
        for (const [a, b, back, up] of [[away, 2.0, -.6, 1.9], [-away, 2.0, -.6, 1.9], [away, 1.9, 1.2, 2.3], [-away, 1.9, 1.2, 2.3], [away, 1.2, 2.2, 2.6], [-away, 1.2, 2.2, 2.6], [0, 0, 2.6, 2.8]]) {
          const cx = P.x + rx * b * a - dx * back, cz = P.z + rz * b * a - dz * back, cy = Math.max(gy(cx, cz) + .9, y0 + up);
          const to = new T.Vector3(cx, cy, cz), dir = to.clone().sub(from), len = dir.length(); ray.set(from, dir.normalize()); ray.far = len;
          if (!ray.intersectObjects(H.blockers, false).length) { best = [cx, cz, cy]; break; }
        }
        if (best || H.cam === undefined) H.cam = best || false;
      }
      demo.shot = u < .97 && H.cam ? { pos: new T.Vector3(H.cam[0], H.cam[2], H.cam[1]), look: new T.Vector3((pos.x + M.x) / 2, pos.y * .6 + (M.y + 1.1) * .4, (pos.z + M.z) / 2) } : null;   // no clear side: stay on the follow camera
      // sound on the beats: cloth as you lift, water shifting as it changes hands, the can on stone, or the pour
      const beat = (name, at, fn) => { if (!H.fired[name] && u >= at) { H.fired[name] = 1; if (field && field.ready) fn(); } };
      beat("lift", .15, () => field.hit("cloth", pos, { gain: .5, label: "cloth" }));
      if (H.kind !== "pour") beat("slosh", H.kind === "draw" ? .3 : .52, () => field.shot("fill_plastic", pos, { gain: .45, dur: H.kind === "draw" ? 2.6 : .9, bus: "foley", label: "water in the can", ref: 2.5 }));
      if (H.kind === "give") beat("set", .93, () => field.hit("stone", pos, { gain: .95, label: "can set down" }));
      if (H.kind === "pour") beat("pour", .47, () => field.shot("fill_plastic", pos, { gain: .65, from: 1, dur: 1.7, bus: "foley", label: "pour", ref: 3 }));
      if (u >= 1) {
        if (H.kind !== "give") can.canRoot.visible = false;
        ch.setPose(H.keep.pose || "idle"); ch.state.poseOpts = H.keep.opts || {};
        if (A.state.scripted) { A.setPose("idle"); A.state.scripted = false; }
        demo.handoff = null; demo.shot = null; demo.dockSig = ""; if (field && field.swell) field.swell(7);
        if (demo.dew) { const r = document.getElementById("dk-status").getBoundingClientRect(); demo.dew.recall(r.left + r.width / 2, r.bottom + 4); }   // it hangs from the litres as a worm of its own frames
        if (H.kind === "give") setTimeout(() => { if (!demo.handoff && demo.can) demo.can.canRoot.visible = false; }, 9000);
      }
    }
    function demoRestore() {
      if (demo.line && demo.keep) { const ch = demo.line.ch; ch.setPose(demo.keep.pose); ch.state.poseOpts = demo.keep.opts || {}; ch.state.voiceJaw = null; }
      demo.line = null; if (demo.ui) demo.ui.bub.hidden = true;
      if (demo.msg) { demo.msg.end(demo.msg.kind); demo.msg = null; }
    }
    function demoSay(text) {
      const low = text.toLowerCase();
      if (cast) for (const o of cast.list) {                                // calling a name turns you to that person
        if (o === demo.withCh || o === activeAvatar || !o.group.visible || Math.hypot(o.state.x - state.x, o.state.z - state.z) > 6) continue;
        const first = demoName(o).split(" ").pop().toLowerCase();
        if (first.length > 2 && low.includes(first)) { if (demo.line) demoRestore(); demo.withCh = o; demo.greeted = true; break; }
      }
      const ch = demo.withCh; if (!ch) return null;
      demo.greeted = true; (demo.greetedAt = demo.greetedAt || {})[ch.state.id] = demo.clock || 0;   // you spoke first: no greeting over your answer
      const ui = demoUi(); ui.you.textContent = text; ui.you.hidden = false; demo.youUntil = (demo.clock || 0) + 2600; demo.youLine = { text, seq: (demo.youSeq = (demo.youSeq || 0) + 1) };
      if (demo.dew) { const m = demo.dew.say({ me: true, text, anchor: () => [innerWidth - 34, innerHeight - 222] }); m.set(text, 1); setTimeout(() => m.end("fall"), 1700); }   // your words: a small drop that falls
      demoThread("You", text, true);
      const r = demoAnswer(ch, text); demoSpeakAs(ch, r); return r.say;
    }
    const DEMO_FIXED = new Set(["recDesk", "kneelPour", "screenWatch", "seatedWatch", "unloadHandoff", "convoyWalk", "convoyPhoneWalk", "filmConvoy", "clerkWindow", "deskWrite", "deskNotes"]);
    const demoV = new T.Vector3();
    function demoTick(dt) {
      const ui = demoUi(), now = (demo.clock = (demo.clock || 0) + dt * 1000);
      if (!demo.started && state.ready && !state.introActive) {
        demo.started = true;
        const sb = cast && cast.byId && cast.byId.saba ? cast.byId.saba.state : { x: -1458.4, z: 761.8 };
        state.x = sb.x + 4.6; state.z = sb.z + 4.4; state.y = driveSurfaceAt(state.x, state.z) + 1.68;
        state.yaw = Math.atan2(-(sb.x - state.x), -(sb.z - state.z)); state.pitch = -.04;
        donkey.place(state.x + 3.2, state.z + 3.0, state.yaw, (x, z) => driveSurfaceAt(x, z));
      }
      // who you are with: nearest person within reach, held until you step well away
      let best = null, bd = 2.8;
      if (cast && !state.drivingCart && !state.riding) for (const ch of cast.list) {
        if (!ch.group.visible || ch === activeAvatar) continue;
        const d = Math.hypot(ch.state.x - state.x, ch.state.z - state.z); if (d < bd) { bd = d; best = ch; }
      }
      const cur = demo.withCh, curD = cur ? Math.hypot(cur.state.x - state.x, cur.state.z - state.z) : 99;
      if (cur && (curD > 4.4 || (best && best !== cur && bd < curD - .6))) { if (demo.line && demo.line.ch === cur) demoRestore(); demo.withCh = null; }
      if (demo.withCh && demo.withCh !== demo.prefetched && demo.voiceMan && field && field.prefetch) {   // their voice is ready before they speak
        demo.prefetched = demo.withCh; const pre = demo.withCh.state.id + "|";
        Object.keys(demo.voiceMan.lines).filter(k => k.startsWith(pre) && !/\d/.test(k)).slice(0, 30).forEach(k => field.prefetch("./voice/" + demo.voiceMan.lines[k][0]));
      }
      if (!demo.withCh && best) { demo.withCh = best; demo.metAt = now; demo.greeted = demo.greetedAt && demo.greetedAt[best.state.id] > now - 45000; }
      const ch = demo.withCh;
      if (ch) {
        if (!demo.greeted && now - demo.metAt > 550) {                     // they speak first
          demo.greeted = true; (demo.greetedAt = demo.greetedAt || {})[ch.state.id] = now;
          demoSpeakAs(ch, demoAnswer(ch, "hello"));
        }
        if (!DEMO_FIXED.has(demo.keep && demo.line && demo.line.ch === ch ? demo.keep.pose : ch.state.pose)) {   // standing people turn to you
          const want = Math.atan2(state.x - ch.state.x, state.z - ch.state.z), df = Math.atan2(Math.sin(want - ch.state.heading), Math.cos(want - ch.state.heading));
          ch.state.heading += df * (1 - Math.exp(-dt * 5)); ch.group.rotation.y = ch.state.heading;
        }
      }
      if (demo.line) {
        const L = demo.line; L.t += dt;
        if (L.voice) {                                                   // the jaw follows the recorded voice; the source follows the head
          L.ch.state.voiceJaw = clamp((L.voice.env || 0) * 2.4, 0, .5);
          L.voice.at(demoV.set(L.ch.state.x, (L.ch.state.y || 0) + 1.62, L.ch.state.z));
        }
        ui.bub.lastElementChild.textContent = L.text.slice(0, Math.ceil(L.text.length * Math.min(1, L.t / (L.dur * .62))));
        if (demo.msg) demo.msg.set(L.text, L.t / (L.dur * .62));
        demoV.set(L.ch.state.x, L.ch.state.y + 1.98, L.ch.state.z).project(camera);
        const on = demoV.z < 1 && Math.abs(demoV.x) < 1.1;
        ui.bub.style.left = clamp((demoV.x * .5 + .5) * innerWidth, 150, innerWidth - 150) + "px"; ui.bub.style.top = clamp((-demoV.y * .5 + .5) * innerHeight, 70, innerHeight - (demo.talking ? 250 : 170)) + "px";   // never into the controls band
        ui.bub.hidden = !on;
        if (L.t > L.dur) { const end = L.end; demoRestore(); if (end) demo.withCh = null; }
      }
      if (demo.youUntil && now > demo.youUntil) { ui.you.hidden = true; demo.youUntil = 0; }
      fieldTick(dt);
      demoHandoffTick(dt); demoDock(dt); demoAnchors(); demoOffers(dt);
      if (demo.menuOpen && (demo.clock || 0) - (demo.menuTouch || 0) > 14000) demo.ui.openSheet(false);       // honey left alone drains away
      if (demo.dew) {
        const dw = demo.dew; let rIn = 0; for (const em of sampleWifiEmitters()) { const R = em.r * .9, d = Math.hypot(camera.position.x - em.x, camera.position.z - em.z); rIn = Math.max(rIn, clamp(1 - (d - R * .8) / (R * .2 + 4), 0, 1)); }
        dw.rain = rIn;                                                    // it rains on the glass exactly where it rains on you
        // the beacon is the pane's one light; with line of sight and water aboard it flares, which is your signal, seen
        demoV.set(-1617, driveSurfaceAt(-1617, 590) + 36, 590).project(camera);
        const seen = demoV.z < 1 && Math.abs(demoV.x) < 1.05 && Math.abs(demoV.y) < 1.05;
        dw.light = demoV.z < 1 ? [(demoV.x * .5 + .5) * innerWidth, (-demoV.y * .5 + .5) * innerHeight] : null;
        dw.flare += ((seen && (demo.signal || 0) >= 3 ? .85 : 0) - dw.flare) * Math.min(1, dt * 2.5);
        // PLACES: where you are going is a drop over that place, looking at it; behind you or over a ridge it waits at the edge, leaning that way
        const cN = npCarrier(), NAMES = { basalt: "Basalt Pump", beacon: "Cross-Beacon", hill: "Hill Archive", compound: "Daylight Compound" }, Wd = innerWidth, Hd = innerHeight;
        const targets = []; const nx = ["basalt", "beacon", "hill", "compound"].find(k => !cN.visited.includes(k)); if (nx) targets.push(nx);
        if (cN.liters <= (cN.reserve || 4) && !targets.includes("basalt")) targets.push("basalt");                  // dry: the pump matters again
        const gHere = driveSurfaceAt(state.x, state.z);
        dw.ways = targets.map(k => {
          const [px, pz] = DEMO_SETS[k], d = Math.hypot(px - state.x, pz - state.z); if (d < 26) return null;
          const gy = driveSurfaceAt(px, pz); demoV.set(px, gy + (k === "beacon" ? 16 : 3), pz).project(camera);
          const r = clamp(46 - d / 13, 22, 44), behind = demoV.z >= 1, ux = behind ? -demoV.x : demoV.x, uy = behind ? -demoV.y : demoV.y;
          const tx = (demoV.x * .5 + .5) * Wd, ty = (-demoV.y * .5 + .5) * Hd, on = !behind && tx > r + 10 && tx < Wd - r - 10 && ty > 96 + r && ty < Hd - 190;
          const dir = Math.atan2(-uy, ux), rise = gy - gHere;
          return { id: k, on, tx, ty, r, dir, sx: on ? tx : clamp(Wd / 2 + Math.cos(dir) * Wd, r + 18, Wd - r - 18), sy: on ? ty - r - 12 : clamp(Hd / 2 + Math.sin(dir) * Hd, 112 + r, Hd - 205 - r),
            label: NAMES[k], note: `${Math.round(d / 5) * 5} m${Math.abs(rise) < 6 ? "" : rise > 0 ? " · " + Math.round(rise) + " m up" : " · " + Math.round(-rise) + " m down"}` };
        }).filter(Boolean);
        dw.mark = false && (demo.signal || 0) >= 3 && !targets.includes("beacon") ? Math.round(Math.hypot(-1610 - state.x, 590 - state.z)) + " m" : null;      // how far the beacon is, written beside its light
        // THE MAP in the fog of your breath: the circuit, where you have been, where is next, you and the donkey; north up
        if (demo.mapOn || (demo.clock || 0) < (demo.mapUntil || 0)) {
          const order = ["basalt", "beacon", "hill", "compound"], IC = { basalt: "pump", beacon: "beacon", hill: "archive", compound: "compound" };
          let x0 = state.x, x1 = state.x, z0 = state.z, z1 = state.z; for (const k of order) { x0 = Math.min(x0, DEMO_SETS[k][0]); x1 = Math.max(x1, DEMO_SETS[k][0]); z0 = Math.min(z0, DEMO_SETS[k][1]); z1 = Math.max(z1, DEMO_SETS[k][1]); }
          const sc = Math.min(Wd * .7 / Math.max(1, x1 - x0), Hd * .42 / Math.max(1, z1 - z0)), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, P = (x, z) => [Wd / 2 + (x - mx) * sc, Hd * .42 + (z - mz) * sc];
          dw.map = { stops: order.map(k => { const p = P(DEMO_SETS[k][0], DEMO_SETS[k][1]); return { x: p[0], y: p[1], icon: IC[k], seen: cN.visited.includes(k), next: k === nx }; }), me: [...P(state.x, state.z), -state.yaw], donkey: P(donkey.state.x, donkey.state.z) };
        } else dw.map = null;
        { const order = ["basalt", "beacon", "hill", "compound"]; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const k of order) { x0 = Math.min(x0, DEMO_SETS[k][0]); x1 = Math.max(x1, DEMO_SETS[k][0]); z0 = Math.min(z0, DEMO_SETS[k][1]); z1 = Math.max(z1, DEMO_SETS[k][1]); }
          const U = (x, z) => [clamp((x - x0) / (x1 - x0), -.1, 1.1), clamp((z - z0) / (z1 - z0), -.1, 1.1)];
          dw.mini = { stops: order.map(k => [...U(DEMO_SETS[k][0], DEMO_SETS[k][1]), k === nx, cN.visited.includes(k)]), me: U(state.x, state.z) }; }   // the route, for the little drop that holds the map
        // accents: a strong beat of the song lets one bead go; nothing falls otherwise
        { const bp = state.beatPulse || 0; if (bp > .62 && !(demo.beatHi) && (demo.clock || 0) - (demo.accentAt || 0) > 3200) { if (dw.accent()) demo.accentAt = demo.clock || 0; } demo.beatHi = bp > .62; }
        if (dw.scrub > .04) dw.map = null;                                 // reaching back in time, the fog shows what was, not the map
        // WEATHER: each place has its own on the glass; arriving, its name is written by the shower that brings its drops
        let near = null, nd = 70; for (const k in DEMO_SETS) { const q = Math.hypot(DEMO_SETS[k][0] - state.x, DEMO_SETS[k][1] - state.z); if (q < nd) { nd = q; near = k; } }
        const WX = { basalt: [0, 0, 0], beacon: [75, .15, 0], hill: [30, .6, 0], compound: [0, 0, .85] }[near] || [22, .12, 0], kW = Math.min(1, dt * .8);
        dw.wind += (WX[0] - dw.wind) * kW; dw.mist += (WX[1] - dw.mist) * kW; dw.smoke += (WX[2] - dw.smoke) * kW;
        const at = nd < 34 ? near : null; if (at && at !== demo.titled) { if (demo.titled !== undefined) dw.title(""); demo.titled = at; } else if (!at && nd > 60) demo.titled = null;
        // breath: running and climbing wind you; it fogs the bottom of the lens until you recover
        const sp = Math.hypot(state.vx || 0, state.vz || 0), onFoot = !state.drivingCart && !state.riding && !state.gliding;
        demo.exert = clamp((demo.exert || 0) + dt * (onFoot && sp > 2.2 ? .16 + .1 * clamp((carrierPhys && carrierPhys.grade) || 0, 0, 1) + npCarrier().liters * .004 : -.07), 0, 1);
        dw.breath += (clamp((demo.exert - .3) / .5, 0, 1) - dw.breath) * Math.min(1, dt * 1.5);
        dw.frame(dt);
      }
      if (!ui.brief.hidden && demo.startXZ && Math.hypot(state.x - demo.startXZ[0], state.z - demo.startXZ[1]) > 1.5) ui.brief.hidden = true;
      if (!demo.startXZ && demo.started) demo.startXZ = [state.x, state.z];
      ui.say.hidden = !ch; if (ch && document.activeElement !== ui.input) ui.input.placeholder = `Z · say something to ${demoName(ch)}`;
      // phone: water aboard, and whether the beacon mast is in view over the real ridge
      demo.phoneT = (demo.phoneT || 0) - dt;
      if (demo.phoneT <= 0) {
        demo.phoneT = .4; const c = npCarrier(), bx = -1610, bz = 590, top = driveSurfaceAt(bx, bz) + 40, eye = driveSurfaceAt(state.x, state.z) + 1.68, d = Math.hypot(bx - state.x, bz - state.z);
        let los = true; for (let k = 1; k < 40 && los; k++) { const t = k / 40; if (eye + (top - eye) * t <= driveSurfaceAt(state.x + (bx - state.x) * t, state.z + (bz - state.z) * t)) los = false; }
        const bars = c.liters <= 0 ? 0 : los ? (d < 320 ? 4 : 3) : 1; demo.signal = bars;
        [...ui.sig.children].forEach((b, i) => b.classList.toggle("on", i < bars));
        ui.can.style.width = clamp(c.liters / 20 * 100, 0, 100) + "%";
        ui.lit.textContent = `${c.liters} of 20 L · chalk at ${npWorld.limits.reserve} L`;
        ui.los.textContent = c.liters <= 0 ? "Dry can: no signal" : los ? `Beacon in view, ${Math.round(d)} m` : "Ridge hides the beacon";
      }
    }

    function step(dt) {
      const manualFwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stickY;
      const brakeInput = keys.KeyX || fieldHeld("KeyX");
      if (brakeInput && state.wagonCruise !== 0) setWagonCruise(0);
      const cruiseFwd = (state.drivingCart && !brakeInput && Math.abs(manualFwd) <= .08) ? state.wagonCruise : 0;
      const fwdInput = clamp(Math.abs(manualFwd) > .08 ? manualFwd : cruiseFwd, -1, 1);
      const sideInput = clamp((keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stickX, -1, 1);
      const turbo = keys.ShiftLeft || keys.ShiftRight || fieldHeld("ShiftLeft") || state.sprintToggle;
      const nowSec = performance.now() * .001;
      const portPull = camera.aspect < .85 ? 1.38 : 1;
      const portLift = camera.aspect < .85 ? .85 : 0;

      if (state.pingTimer > 0) state.pingTimer = Math.max(0, state.pingTimer - dt);

      // Check proximity to active Song-Resonant Flow Conduit for movement/hydration boost
      const epInfo = activeEpochInfo(audioEl.currentTime || 0, nowSec);
      if (state.songEpochIdx !== epInfo.idx) {
        state.songEpochIdx = epInfo.idx;
        state.resonantZone = epInfo.ep.zone;
        state.zoneSynced = (state.meteredZone === state.resonantZone);
      }
      const activeConduit = flowConduits[state.songEpochIdx];
      let onResonantPath = false;
      if (activeConduit) {
        for (let k = 0; k < activeConduit.pts.length - 1; k++) {
          const [ax, az] = activeConduit.pts[k], [bx, bz] = activeConduit.pts[k + 1];
          const abx = bx - ax, abz = bz - az, l2 = abx * abx + abz * abz || 1;
          const u = clamp(((state.x - ax) * abx + (state.z - az) * abz) / l2, 0, 1);
          if (Math.hypot(state.x - (ax + abx * u), state.z - (az + abz * u)) < 26) { onResonantPath = true; break; }
        }
      }
      const flowSpeedMult = (onResonantPath || state.zoneSynced) ? 1.35 : 1.0;

      // Audio Analysis & Beat Pulse
      const sp = audio.sampleTape(dt, nowSec, !audioEl.paused);
      state.beatPulse = lerp(state.beatPulse, Math.max(sp.spatialBeat, audioEl.paused ? 0 : sp.beatPulse), clamp(dt * 12, 0, 1));
      lookMat.uniforms.uAudioBass.value = lerp(lookMat.uniforms.uAudioBass.value, sp.bass, clamp(dt * 10, 0, 1));
      lookMat.uniforms.uAudioHigh.value = lerp(lookMat.uniforms.uAudioHigh.value, sp.high, clamp(dt * 10, 0, 1));
      lookMat.uniforms.uBeatPulse.value = state.beatPulse;
      lookMat.uniforms.uT.value = nowSec;
      state.focusPulse = Math.max(0, state.focusPulse - dt * 1.4);
      lookMat.uniforms.uFocusPulse.value = state.focusPulse;
      if (!useFieldLayout()) drawRadioViz(sp.bands12, state.beatPulse);

      if (state.introActive) {
        donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, (x, z) => driveSurfaceAt(x, z));
        if (state.introPhase === "title") {
          const orb = nowSec * .085;
          tmpCamPos.set(-8.0 + Math.cos(orb) * 6.5, 171.5 + Math.sin(orb * .7) * 2.2, 2.0 + Math.sin(orb) * 19.0);
          tmpCamLook.set(-68.0, 140.0, -4.0);
          applyLevelChaseCamera(tmpCamPos, tmpCamLook);
          state.focusDist = 26.0;
        } else if (state.introPhase === "montage") {
          state.introT += dt;
          if (state.introT >= INTRO_DURATION) {
            finishIntro(false);
          } else {
            let idx = INTRO_SHOTS.findIndex(s => state.introT >= s.t0 && state.introT < s.t1);
            if (idx < 0) idx = INTRO_SHOTS.length - 1;
            const s = INTRO_SHOTS[idx];
            if (state.introShotIdx !== idx) {
              state.introShotIdx = idx;
              state.modeIdx = s.modeIdx;
              if (s.onEnter) s.onEnter();
              if ($("cinema-shot-kicker")) $("cinema-shot-kicker").textContent = s.kicker;
              if ($("cinema-shot-line")) $("cinema-shot-line").textContent = s.line;
            }
            const u = smooth(0, 1, clamp((state.introT - s.t0) / Math.max(.01, s.t1 - s.t0), 0, 1));
            tmpCamPos.set(lerp(s.fromPos[0], s.toPos[0], u), lerp(s.fromPos[1], s.toPos[1], u), lerp(s.fromPos[2], s.toPos[2], u));
            tmpCamLook.set(lerp(s.fromLook[0], s.toLook[0], u), lerp(s.fromLook[1], s.toLook[1], u), lerp(s.fromLook[2], s.toLook[2], u));
            applyLevelChaseCamera(tmpCamPos, tmpCamLook);
            state.focusDist = lerp(s.focus0, s.focus1, u);
            if ($("cinema-shot-bar")) $("cinema-shot-bar").style.width = `${clamp((state.introT / INTRO_DURATION) * 100, 0, 100)}%`;
          }
        }
      } else if (machinima && machinima.isActive()) {
        machinima.stepCamera(dt, nowSec, { fwdInput, sideInput, turbo });
      } else if (state.gliding) {
        if (stepGlide(dt, fwdInput, sideInput, turbo, flowSpeedMult)) {
          const g = state.glide, withWagon = state.donkeyOnRoof;
          state.glideOpen = lerp(state.glideOpen, 1, 1 - Math.exp(-dt * 11));
          donkeyGlider.scale.setScalar(state.glideOpen);
          poseGlider(dt);

          wingTipL.getWorldPosition(tmpTipL);
          wingTipR.getWorldPosition(tmpTipR);
          contrailL.line.visible = contrailR.line.visible = true;
          contrailL.pts.pop(); contrailL.pts.unshift(tmpTipL.clone());
          contrailR.pts.pop(); contrailR.pts.unshift(tmpTipR.clone());
          for (let i = 0; i < TRAIL_N; i++) {
            const pL = contrailL.pts[i], pR = contrailR.pts[i];
            contrailL.pos[i * 3] = pL.x; contrailL.pos[i * 3 + 1] = pL.y; contrailL.pos[i * 3 + 2] = pL.z;
            contrailR.pos[i * 3] = pR.x; contrailR.pos[i * 3 + 1] = pR.y; contrailR.pos[i * 3 + 2] = pR.z;
          }
          contrailL.line.geometry.attributes.position.needsUpdate = true;
          contrailR.line.geometry.attributes.position.needsUpdate = true;

          const camDist = state.chaseZoom * (withWagon ? 1.34 : .82) * portPull;
          const lookHdg = g.heading + state.cartYawOffset;
          const camX = g.x - Math.sin(lookHdg) * camDist, camZ = g.z - Math.cos(lookHdg) * camDist;
          const camY = g.y + (withWagon ? 5.5 : 3.0) + portLift + state.cartPitchOffset * 4.5;
          tmpCamPos.set(camX, Math.max(driveSurfaceAt(camX, camZ) + 1.8, camY), camZ);
          tmpCamLook.set(g.x + Math.sin(g.heading) * 14, g.y + (withWagon ? 3.3 : 1.1 + portLift * .88), g.z + Math.cos(g.heading) * 14);
          const follow = lerp(9.5, 32, smooth(45, 240, g.speed));
          state.chaseCamPos.lerp(tmpCamPos, 1 - Math.exp(-dt * follow));
          state.chaseLookAt.lerp(tmpCamLook, 1 - Math.exp(-dt * (follow + 1.5)));
          applyLevelChaseCamera(state.chaseCamPos, state.chaseLookAt);
          state.x = g.x; state.z = g.z; state.y = g.y;
          state.yaw = lookHdg + Math.PI;
        }
      } else if (state.drivingCart) {
        /* --- CRUISER WOODY STATION WAGON (60 Hz 4-WHEEL SUSPENSION, SLOPE GRAVITY & DAMAGE) --- */
        if (vehPhys) {
          vehPhys.step(dt, {
            fwd: fwdInput,
            side: sideInput,
            brake: brakeInput,
            turbo,
            flowSpeedMult,
            waterLiters: state.waterLiters
          }, driveSurfaceAt, worldObstacles, worldBoundsClamp, onVehicleImpact);
          applyWagonVisuals();
          for (const w of wagon.wheels) {
            w.spin.rotation.x -= (wagon.speed * dt) / .394;
          }
          if (vehPhys.integrity < 50 && physParticles) {
            smokeClock += dt;
            if (smokeClock > 0.14) {
              smokeClock = 0;
              const sinH = Math.sin(wagon.heading), cosH = Math.cos(wagon.heading);
              physParticles.spawnSmoke(wagon.x + sinH * 1.9, wagon.y + 1.35, wagon.z + cosH * 1.9, 1);
            }
          }
        }
        // Keep Mistletoe strictly terrain-grounded beside the vehicle (NEVER perched on car roof)
        if (NP_PHYS) {
          NP_PHYS.keepCompanionGrounded(donkey, wagon, dt, driveSurfaceAt, worldBoundsClamp);
        }

        if (lookPointer === null && Math.abs(wagon.speed) > .5) {
          state.cartYawOffset = lerp(state.cartYawOffset, 0, 1 - Math.exp(-dt * 2.4));
        }
        const revAmt = smooth(-.2, -14.0, wagon.speed);
        const lookHdg = wagon.heading + state.cartYawOffset;
        const wZoom = Math.max(5.0, state.chaseZoom * portPull - revAmt * 2.6);
        const lookAhead = lerp(10.0, 3.8, revAmt);
        const followRate = lerp(9.5, 5.4, revAmt);
        const camX = wagon.x - Math.sin(lookHdg) * wZoom, camZ = wagon.z - Math.cos(lookHdg) * wZoom;
        tmpCamPos.set(camX, Math.max(driveSurfaceAt(camX, camZ) + 2.0, wagon.y + 4.35 + portLift + state.cartPitchOffset * 4.2), camZ);
        tmpCamLook.set(wagon.x + Math.sin(wagon.heading) * lookAhead, wagon.y + 2.4, wagon.z + Math.cos(wagon.heading) * lookAhead);
        state.chaseCamPos.lerp(tmpCamPos, 1 - Math.exp(-dt * followRate));
        state.chaseLookAt.lerp(tmpCamLook, 1 - Math.exp(-dt * (followRate + 1.5)));
        applyLevelChaseCamera(state.chaseCamPos, state.chaseLookAt);
        state.x = wagon.x; state.z = wagon.z; state.y = wagon.y + 2.0;
        state.yaw = lookHdg + Math.PI;
      } else if (state.riding) {
        /* --- 3RD-PERSON LEVEL TRAIL CAMERA RIDING MISTLETOE (FIXES SIDEWAYS VIEW) --- */
        const stepFn = (x, z) => driveSurfaceAt(x, z);
        const effThrottle = state.donkeyCollapsed ? 0 : fwdInput;
        donkey.update(dt, { throttle: effThrottle, steer: -sideInput, pace: turbo ? 2 : state.gaitIdx, near: 0, drop: 0 }, stepFn);
        [donkey.state.x, donkey.state.z] = worldBoundsClamp(donkey.state.x, donkey.state.z);
        donkey.state.y = driveSurfaceAt(donkey.state.x, donkey.state.z);
        donkey.group.position.set(donkey.state.x, donkey.state.y, donkey.state.z);

        const aheadX = donkey.state.x + Math.sin(donkey.state.heading) * 2.5, aheadZ = donkey.state.z + Math.cos(donkey.state.heading) * 2.5;
        if (!state.donkeyCollapsed && donkey.group.position.y - driveSurfaceAt(aheadX, aheadZ) > 4.5 && fwdInput > .15) {
          toggleGlide({ x: donkey.state.x, z: donkey.state.z, boostY: 2.0, heading: donkey.state.heading, name: "Cliff Edge Auto-Launch!" });
        } else {
          const lookHdg = donkey.state.heading + state.cartYawOffset;
          const distBack = 5.4 * portPull * (useFieldLayout() ? state.chaseZoom / 9.2 : 1);
          const camX = donkey.state.x - Math.sin(lookHdg) * distBack, camZ = donkey.state.z - Math.cos(lookHdg) * distBack;
          tmpCamPos.set(camX, Math.max(driveSurfaceAt(camX, camZ) + 1.5, donkey.group.position.y + 2.35 + portLift * .7 + state.cartPitchOffset * 2.6), camZ);
          tmpCamLook.set(donkey.state.x + Math.sin(donkey.state.heading) * 8.0, donkey.group.position.y + 1.35, donkey.state.z + Math.cos(donkey.state.heading) * 8.0);
          state.chaseCamPos.lerp(tmpCamPos, 1 - Math.exp(-dt * 11));
          state.chaseLookAt.lerp(tmpCamLook, 1 - Math.exp(-dt * 13));
          applyLevelChaseCamera(state.chaseCamPos, state.chaseLookAt);
          state.x = donkey.state.x; state.z = donkey.state.z; state.y = donkey.group.position.y + 1.65;
          state.yaw = lookHdg + Math.PI;
        }
      } else {
        /* --- ON FOOT (GRAVITY, TERRAIN-SOLE GROUNDING & 0-40 kg WATER-LOAD WEIGHT) + LEADING MISTLETOE --- */
        // Human pace on foot: 1.3 m/s walking, 3.4 m/s running (Shift, or the stick pushed to its rim).
        // Input is camera-relative: the body turns to face where it walks (see avatarHeading) and, unless you are
        // dragging to look, the camera swings in behind it slowly, so steering never fights the view.
        const third = state.cameraMode === "third" && !state.introActive;
        const backing = false;
        const stickRun = stickPointer !== null && Math.hypot(stickX, stickY) > .93;
        const sx = Math.sin(state.yaw), cz = Math.cos(state.yaw);
        const lockMove = DEMO && demo.handoff ? 0 : 1;                       // a handoff holds you in place until the can has changed hands
        const moveDirX = (-sx * fwdInput + cz * sideInput) * lockMove;
        const moveDirZ = (-cz * fwdInput - sx * sideInput) * lockMove;
        // A body has to come round before it can go: while it faces away from where you push, it slows into a pivot.
        const faceErr = third && state.avatarHeading != null && Math.hypot(moveDirX, moveDirZ) > .1
          ? Math.abs(Math.atan2(Math.sin(Math.atan2(moveDirX, moveDirZ) - state.avatarHeading), Math.cos(Math.atan2(moveDirX, moveDirZ) - state.avatarHeading))) : 0;
        const baseSpeed = (turbo || stickRun ? 3.4 : 1.3) * Math.min(1.25, flowSpeedMult || 1) * (1 - .7 * clamp((faceErr - .45) / 1.5, 0, 1));
        if (third && Math.hypot(moveDirX, moveDirZ) > .2 && performance.now() - (state.lookDragAt || 0) > 1400) {
          const want = Math.atan2(-moveDirX, -moveDirZ), d = Math.atan2(Math.sin(want - state.yaw), Math.cos(want - state.yaw));
          const w = Math.min(1, Math.abs(sideInput) * 1.3) * (fwdInput < -.3 ? .25 : 1);   // walking at the camera barely turns it
          state.yaw += d * w * (1 - Math.exp(-dt * 1.6));
        }
        const footPrevX = state.x, footPrevZ = state.z;
        if (carrierPhys) {
          carrierPhys.stepFoot(state, dt, moveDirX, moveDirZ, baseSpeed, state.waterLiters, driveSurfaceAt, worldBoundsClamp, onCarrierPhysicsEvent);
          if (DEMO) {
            const r = demoResolve(state.x, state.z, .35);
            state.x = r[0]; state.z = r[1];
            state.y = Math.max(state.y, driveSurfaceAt(state.x, state.z) + 1.68);   // keep jumps and falls; just never below the ground
          }
        } else {
          let fnx = state.x + moveDirX * baseSpeed * dt, fnz = state.z + moveDirZ * baseSpeed * dt;
          [state.x, state.z] = worldBoundsClamp(fnx, fnz);
          state.y = driveSurfaceAt(state.x, state.z) + 1.68;
        }
        // The body's real velocity, from where it actually went (after weight, slope and collisions). The avatar's
        // walk, facing and footsteps all read this, so they agree with what you see.
        if (dt > 1e-4) {
          const mvx = (state.x - footPrevX) / dt, mvz = (state.z - footPrevZ) / dt, k = 1 - Math.exp(-dt * 12);
          state.vx = Math.hypot(mvx, mvz) > 12 ? 0 : (state.vx || 0) + (mvx - (state.vx || 0)) * k;
          state.vz = Math.hypot(mvx, mvz) > 12 ? 0 : (state.vz || 0) + (mvz - (state.vz || 0)) * k;
          state.backing = backing;
        }
        const dx = state.x - donkey.state.x, dz = state.z - donkey.state.z, dist = Math.hypot(dx, dz);
        const stepFn = (x, z) => driveSurfaceAt(x, z);
        if (state.donkeyCollapsed || state.pourAnim) {
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, stepFn);
        } else if (state.leadMode === "lead" && dist > 3.6) {
          const want = Math.atan2(dx, dz), df = Math.atan2(Math.sin(want - donkey.state.heading), Math.cos(want - donkey.state.heading));
          donkey.update(dt, { throttle: clamp((dist - 3.0) * .55, 0, 1), steer: clamp(df * 1.4, -1, 1), pace: dist > 10 ? 1 : 0, near: 1, drop: 0 }, stepFn);
        } else {
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: dist < 3.5 ? 1 : 0, drop: 0 }, stepFn);
        }
        donkey.state.y = driveSurfaceAt(donkey.state.x, donkey.state.z);
        donkey.group.position.set(donkey.state.x, donkey.state.y, donkey.state.z);

        // Always-playable 3rd-Person / 1st-Person Camera on foot
        const footY = state.y - 1.68;
        if (state.cameraMode === "third" && !state.introActive) {
          const camDist = 4.35;
          const camPitch = clamp(state.pitch || 0, -0.55, 0.55);
          const camX = state.x + Math.sin(state.yaw) * camDist * Math.cos(camPitch);
          const camZ = state.z + Math.cos(state.yaw) * camDist * Math.cos(camPitch);
          const desiredCamY = footY + 2.18 - Math.sin(camPitch) * 2.2;
          const safeCamY = Math.max(driveSurfaceAt(camX, camZ) + 0.65, desiredCamY);
          tmpCamPos.set(camX, safeCamY, camZ);
          tmpCamLook.set(state.x - Math.sin(state.yaw) * 1.8, footY + 1.38 + Math.sin(camPitch) * 0.9, state.z - Math.cos(state.yaw) * 1.8);
          if (DEMO && demo.shot) { tmpCamPos.copy(demo.shot.pos); tmpCamLook.copy(demo.shot.look); }   // the handoff two-shot
          state.chaseCamPos.lerp(tmpCamPos, 1 - Math.exp(-dt * (DEMO && demo.shot ? 4 : 14)));
          state.chaseLookAt.lerp(tmpCamLook, 1 - Math.exp(-dt * 16));
          applyLevelChaseCamera(state.chaseCamPos, state.chaseLookAt);
        } else {
          applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
        }
      }

      if (throwAnimTimer > 0) throwAnimTimer = Math.max(0, throwAnimTimer - dt);
      if (projPool) projPool.update(dt, driveSurfaceAt, onProjectileBounce);
      for (const r of relays) {
        if (r.covRing && r.covRing.line && r.covRingExpandT > 0 && r.covRingExpandT < 1) {
          r.covRingExpandT = Math.min(1, r.covRingExpandT + dt * 0.85);
          const sc = lerp(0.35, 1.32, 1 - Math.pow(1 - r.covRingExpandT, 3));
          r.covRing.line.scale.set(sc, 1, sc);
        }
      }

      /* --- Parked Wagon 4-Wheel Slope Alignment + Water Slosh & Spill Physics --- */
      if (vehPhys && !state.drivingCart && !state.gliding) {
        vehPhys.stepParked(dt, driveSurfaceAt, worldBoundsClamp);
        applyWagonVisuals();
        if (vehPhys.integrity < 50 && physParticles) {
          smokeClock += dt;
          if (smokeClock > 0.24) {
            smokeClock = 0;
            const sinH = Math.sin(wagon.heading), cosH = Math.cos(wagon.heading);
            physParticles.spawnSmoke(wagon.x + sinH * 1.9, wagon.y + 1.35, wagon.z + cosH * 1.9, 1);
          }
        }
      }
      if (waterSlosh && !state.introActive) {
        const sloshDrive = state.drivingCart && vehPhys
          ? { accelFwd: vehPhys.accelFwd, accelLat: vehPhys.accelLat, pitch: vehPhys.pitch, roll: vehPhys.roll }
          : carrierPhys
            ? { accelFwd: carrierPhys.accelZ, accelLat: carrierPhys.accelX, pitch: carrierPhys.grade * 0.45, roll: 0 }
            : { accelFwd: 0, accelLat: 0, pitch: 0, roll: 0 };
        const sRes = waterSlosh.step(dt, sloshDrive, state.waterLiters);
        state.sloshPct = sRes.pct;
        state.sloshSpilling = sRes.spilling;
        if (sRes.spilledL > 0) {
          state.waterLiters = Math.max(0, state.waterLiters - sRes.spilledL);
          state.donkeyWater = clamp(state.donkeyWater - sRes.spilledL * 0.012, 0, 1);
          if (window.HighlandSoundscape && typeof window.HighlandSoundscape.playWaterSpill === "function") {
            window.HighlandSoundscape.playWaterSpill(clamp(sRes.spilledL * 8, 0.2, 1));
          }
          if (physParticles) {
            const sx = state.drivingCart ? wagon.x : donkey.state.x;
            const sy = state.drivingCart ? wagon.y + 2.35 : donkey.group.position.y + 1.12;
            const sz = state.drivingCart ? wagon.z : donkey.state.z;
            const bvx = state.drivingCart && vehPhys ? vehPhys.vx : (state.vx || 0);
            const bvz = state.drivingCart && vehPhys ? vehPhys.vz : (state.vz || 0);
            physParticles.spawnSpill(sx, sy, sz, bvx, bvz, 3);
          }
        }
      }
      if (physParticles) physParticles.update(dt, driveSurfaceAt);

      /* --- HighlandSoundscape Spatial Audio + 4-Station Radio Bridge --- */
      // In the Ahiya demo the field mixer (ahiya-sound.js) carries the world's sound, so this bridge stands down there.
      if (window.HighlandSoundscape && !DEMO) {
        const HS = window.HighlandSoundscape;
        if (!window._npSoundscapeState) {
          window._npSoundscapeState = { ready: false, radioMounted: false, stepDist: 0, lastX: state.x, lastZ: state.z, donkeyTimer: 11 };
          const mountNpRadio = () => {
            const host = document.getElementById("np-radio-host");
            if (host && !window._npSoundscapeState.radioMounted && typeof HS.mountRadioHUD === "function") {
              try { HS.mountRadioHUD(host); window._npSoundscapeState.radioMounted = true; } catch (e) {}
            }
          };
          const unlockNpAudio = () => {
            try {
              if (typeof HS.init === "function") HS.init({ basePath: "../audio/" });
              if (typeof HS.unlock === "function") HS.unlock();
              mountNpRadio();
              window._npSoundscapeState.ready = typeof HS.isReady === "function" ? Boolean(HS.isReady()) : true;
            } catch (e) {}
          };
          mountNpRadio();
          window.addEventListener("pointerdown", unlockNpAudio, { once: true, passive: true });
          window.addEventListener("keydown", unlockNpAudio, { once: true, passive: true });
        }
        const nss = window._npSoundscapeState;
        if (!nss.radioMounted && typeof HS.mountRadioHUD === "function") {
          const host = document.getElementById("np-radio-host");
          if (host) { try { HS.mountRadioHUD(host); nss.radioMounted = true; } catch (e) {} }
        }
        const camPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
        const camFwd = { x: -Math.sin(state.yaw), y: 0, z: -Math.cos(state.yaw) };
        if (typeof HS.updateListener === "function") HS.updateListener(camPos, camFwd);
        const nearWell = Math.hypot(state.x - well.x, state.z - well.z) < 28;
        const biome = state.gliding || state.y > 42 ? "highland_cliff" : (nearWell ? "courtyard" : (state.y < 3.5 ? "gorge_water" : "valley_village"));
        if (typeof HS.setBiome === "function") HS.setBiome(biome, state.y);
        const moved = Math.hypot(state.x - nss.lastX, state.z - nss.lastZ);
        nss.lastX = state.x; nss.lastZ = state.z;
        if (!state.drivingCart && !state.riding && !state.gliding && moved > 0.001 && moved < 4) {
          nss.stepDist += moved;
          if (nss.stepDist >= 0.82) {
            nss.stepDist = 0;
            const surf = state.y < 2.2 ? "water" : (nearWell ? "stone" : (Math.abs(state.x) < 18 ? "gravel" : "grass"));
            if (typeof HS.playFootstep === "function") HS.playFootstep(surf, state.waterLiters);
          }
        }
        if (typeof HS.updateVehicleAudio === "function") {
          const spd = state.drivingCart ? Math.abs(wagon.speed || 0) : 0;
          const rpm01 = state.drivingCart ? clamp(0.18 + spd / 18, 0, 1) : 0;
          const integrity01 = vehPhys ? clamp(vehPhys.integrity / 100, 0, 1) : 1;
          HS.updateVehicleAudio({ x: wagon.x, y: wagon.y, z: wagon.z }, spd, rpm01, integrity01);
        }
        if (typeof HS.updatePumpAudio === "function") {
          HS.updatePumpAudio({ x: well.x, y: well.y || 0, z: well.z }, state.pumpFlow > 0.05, 0.92);
        }
        nss.donkeyTimer -= dt;
        if (nss.donkeyTimer <= 0) {
          nss.donkeyTimer = 19 + Math.random() * 15;
          if (Math.hypot(state.x - donkey.state.x, state.z - donkey.state.z) < 55 && typeof HS.playDonkeyCall === "function") {
            HS.playDonkeyCall({ x: donkey.state.x, y: donkey.group.position.y + 1.1, z: donkey.state.z });
          }
        }
        nss.ready = typeof HS.isReady === "function" ? Boolean(HS.isReady()) : nss.ready;
      }

      /* --- Animated Pouring & Sequential Jerrycan Filling + Eskista Dance --- */
      if (state.pourAnim) {
        const pa = state.pourAnim, r = pa.relay;
        pa.t += dt;
        const p = clamp(pa.t / pa.dur, 0, 1);
        const aimAng = Math.atan2(r.x - donkey.state.x, r.z - donkey.state.z);
        donkey.state.heading = lerp(donkey.state.heading, aimAng, clamp(dt * 8, 0, 1));
        donkey.group.rotation.y = donkey.state.heading;
        donkey.group.rotation.x += Math.sin(p * Math.PI) * .28;
        donkeyRig.rotation.x = Math.sin(p * Math.PI) * .16;

        pourGroup.visible = true;
        const basinPos = new T.Vector3(r.x, r.y + .35, r.z);
        const sinH = Math.sin(donkey.state.heading), cosH = Math.cos(donkey.state.heading);
        const spoutL = new T.Vector3(donkey.state.x - cosH * .38 + sinH * .32, donkey.group.position.y + 1.05, donkey.state.z + sinH * .38 + cosH * .32);
        const spoutR = new T.Vector3(donkey.state.x + cosH * .38 + sinH * .32, donkey.group.position.y + 1.05, donkey.state.z - sinH * .38 + cosH * .32);
        const midL = spoutL.clone().lerp(basinPos, .5).add(new T.Vector3(0, .55, 0));
        const midR = spoutR.clone().lerp(basinPos, .5).add(new T.Vector3(0, .55, 0));
        const aimTube = (m, a, b) => {
          const dv = b.clone().sub(a), l = Math.max(.08, dv.length());
          m.position.copy(a).lerp(b, .5); m.scale.set(1, l, 1);
          m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dv.normalize());
        };
        aimTube(pourMeshL, spoutL, midL);
        aimTube(pourMeshR, spoutR, midR);
        aimTube(pourMeshL2, midL, basinPos);
        aimTube(pourMeshR2, midR, basinPos);
        // Update pool & sequentially fill depot's jerrycans!
        if (r.poolMesh) { r.poolMesh.material = cyanWaterMat; r.poolMesh.position.y = lerp(.08, .42, p); }
        const nC = r.cans.length;
        for (let ci = 0; ci < nC; ci++) {
          const cf = clamp((p * (nC + 1) - ci), 0, 1);
          r.cans[ci].userData.setFill(cf);
        }
        const cIdx = Math.floor(p * 6);
        if (cIdx > pa.lastChime) { pa.lastChime = cIdx; audio.pourSplash(cIdx); }
        for (let si = 0; si < splashDrops.length; si++) {
          const spPh = fract(nowSec * 2.4 + si / splashDrops.length);
          const srcPt = si % 2 ? midL : midR;
          const pt = srcPt.clone().lerp(basinPos, spPh);
          pt.y += Math.sin(spPh * Math.PI) * .45;
          splashDrops[si].position.copy(pt);
        }
        if (pa.t >= pa.dur) {
          pourGroup.visible = false;
          donkeyRig.rotation.x = 0;
          state.pourAnim = null;
          state.waterLiters = Math.max(0, state.waterLiters - 6.0);
          finishRelayIgnition(r);
        }
      } else {
        pourGroup.visible = false;
        donkeyRig.rotation.x = lerp(donkeyRig.rotation.x, 0, clamp(dt * 8, 0, 1));
      }

      state.danceTimer = Math.max(0, state.danceTimer - dt);
      if (state.danceTimer > 0 && !state.donkeyCollapsed && !state.drivingCart && !state.gliding) {
        const ph = nowSec * 9.8; // 6/8 Cosmic Addis Eskista tempo
        donkey.group.position.y += Math.abs(Math.sin(ph)) * .22;
        donkey.group.rotation.y += Math.sin(ph * .5) * .36;
        donkey.group.rotation.z += Math.sin(ph) * .16;
        donkeyRig.rotation.z = Math.sin(ph * 2.0) * .18;
        donkeyRig.rotation.y = Math.cos(ph) * .14;
      } else {
        donkeyRig.rotation.z = lerp(donkeyRig.rotation.z, 0, clamp(dt * 8, 0, 1));
        donkeyRig.rotation.y = lerp(donkeyRig.rotation.y, 0, clamp(dt * 8, 0, 1));
      }

      /* --- Donkey Hydration Survival ("the donkey must have water or it will die") --- */
      const nearWell = Math.hypot(well.x - donkey.state.x, well.z - donkey.state.z) < 16;
      const inRiver = donkey.state.x < 280 && mw.wet(donkey.state.x, donkey.state.z) > -1.2;
      const inAbyssSanctuary = Math.hypot(donkey.state.x - ABYSS_OX, donkey.state.z - ABYSS_OZ) < 175;
      const nearLitCistern = relays.some(r => r.lit && Math.hypot(r.x - donkey.state.x, r.z - donkey.state.z) < 24);
      if (nearWell || inRiver || inAbyssSanctuary || nearLitCistern || onResonantPath || !!state.pourAnim) {
        if (!state.donkeyCollapsed) state.donkeyWater = clamp(state.donkeyWater + dt * .42, 0, 1);
      } else if (!state.introActive && !state.donkeyCollapsed) {
        const moveEffort = state.gliding ? .0035 :
          (state.drivingCart || Math.abs(donkey.state.speed) > 1.2 || fwdInput !== 0) ? .011 : .0045;
        state.donkeyWater = clamp(state.donkeyWater - moveEffort * dt, 0, 1);
      }
      if (state.donkeyWater <= 0.18 && !state.donkeyCollapsed) {
        if (state.gliding) landGlide(false);
        state.donkeyCollapsed = true;
        donkey.state.collapsed = true;
        donkey.state.downWant = true;
        donkey.state.stamina = .05;
        donkey.state.speed = 0;
        state.riding = false; state.drivingCart = false; state.wagonCruise = 0; state.donkeyOnRoof = false;
        wagon.speed = 0;
        if (state.cameraMode !== "third") applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
        toast("EMERGENCY: Mistletoe collapsed from thirst! Press P or F to give water!", "Mistletoe needs water");
        updateHUD();
      } else if (state.donkeyCollapsed && state.donkeyWater > .22) {
        state.donkeyCollapsed = false;
        donkey.state.collapsed = false;
        donkey.state.downWant = false;
        donkey.state.stamina = 1.0;
        updateHUD();
      }

      /* --- Physical Mistletoe Thirst Collapse Pose (unmistakably down on side/knees in the dirt) --- */
      const wantCollapsed = Boolean(state.donkeyCollapsed || state.donkeyWater <= 0.18);
      state.collapseBlend = lerp(state.collapseBlend || 0, wantCollapsed ? 1 : 0, clamp(dt * 3.8, 0, 1));
      if (state.collapseBlend > 0.002) {
        const cb = state.collapseBlend;
        const smoothCb = cb * cb * (3 - 2 * cb);
        donkey.state.speed = 0;
        if (wantCollapsed) {
          donkey.state.collapsed = true;
          donkey.state.downWant = true;
          donkey.state.stamina = 0.05;
        }
        donkey.group.position.y -= smoothCb * 0.42;
        donkey.group.rotation.z = lerp(donkey.group.rotation.z, 1.08, smoothCb);
        donkey.group.rotation.x = lerp(donkey.group.rotation.x, 0.14, smoothCb);
        donkeyRig.rotation.x = lerp(donkeyRig.rotation.x, 0.28, smoothCb);
      } else if (!state.drivingCart && !state.gliding && state.danceTimer <= 0) {
        donkey.group.rotation.z = lerp(donkey.group.rotation.z, 0, clamp(dt * 6, 0, 1));
      }
      updateContextualActions();

      /* --- Update 3D Spatial Donkey Radio & Speaker Cones --- */
      camera.getWorldDirection(tmpCamFwd);
      audio.updateSpatial(camera.position, tmpCamFwd, donkey.group.position);
      const fo = audio.getDistFalloff();
      state.audioDistMeters = fo.distMeters;
      state.audioFalloffDb = fo.falloffDb;
      for (const sc of speakerCones) {
        const scScl = 1.0 + state.beatPulse * .06;
        sc.scale.setScalar(scScl);
        sc.material.emissiveIntensity = .82 + state.beatPulse * .12;
      }

      /* Elevation & Live WiFi Field */
      state.region = regionAt(donkey.state.x, donkey.state.z);
      const floorY = state.region === "ridge" ? 148.0 : state.region === "abyss" ? 48.0 : 65.5;
      state.antennaElev = donkey.group.position.y + 2.35;
      state.relElev = Math.max(0, state.antennaElev - floorY);
      const pingBoost = state.pingTimer > 0 ? 1.25 : 1.0;
      const syncBoost = state.zoneSynced ? 55 : 0;
      state.signalRadius = clamp((28 + Math.min(220, state.relElev * 1.25) + syncBoost) * (.72 + .28 * state.wifiCharge) * pingBoost, 24, 245);

      checkForestUnlocks();
      for (const g of forestGroves) {
        g.grow = lerp(g.grow, g.unlocked ? 1.0 : .22, 1 - Math.exp(-dt * 2.2));
        for (let t = 0; t < g.meshes.length; t++) {
          const item = g.meshes[t];
          const scl = g.grow * item.targetH;
          item.mesh.scale.setScalar(scl);
          item.mesh.rotation.z = g.unlocked ? .035 * Math.sin(nowSec * .9 + item.phase) : 0;
          if (g.tips[t]) { g.tips[t].position.y = scl * 18.5 + .45; g.tips[t].rotation.y = nowSec * (g.unlocked ? 1.8 : .4); }
        }
        if (g.unlocked) {
          for (const fr of g.fronds) {
            fr.mesh.rotation.x = fr.basePitch + Math.sin(nowSec * 1.85 + fr.phase) * (.08 + .07 * state.beatPulse);
            fr.mesh.rotation.z = Math.cos(nowSec * 1.35 + fr.phase * 1.4) * .06;
          }
          for (let b = 0; b < g.banners.length; b++) {
            g.banners[b].rotation.x = Math.sin(nowSec * 1.15 + b * 1.3) * .05;
          }
        }
      }

      // Animate Song-Resonant Flow Conduits & Chevrons
      for (const fc of flowConduits) {
        const isRes = fc.epochIdx === state.songEpochIdx;
        fc.mat.opacity = isRes ? (.48 + (state.zoneSynced ? .14 : 0)) : (state.lidarOn ? .36 : .14);
        fc.mat.color.setHex(isRes ? (state.zoneSynced ? 0x54ecff : 0x18b4ff) : 0x0052cc);
        for (const ch of fc.chevs) {
          const u = fract(nowSec * (isRes ? .18 : .08) + ch.offset);
          const pos = fc.curve.getPointAt(u), tan = fc.curve.getTangentAt(u);
          ch.mesh.position.copy(pos);
          ch.mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), tan);
          const s = isRes ? 1.15 : .85;
          ch.mesh.scale.setScalar(s);
        }
      }

      // Auto-pour when arriving right beside an unlit cistern with free water above the 4 L chalk mark
      if (!state.pourAnim && !state.donkeyCollapsed && npCarrier().liters > npCarrier().reserve) {
        if (interruptedRelay && Math.hypot(interruptedRelay.x - donkey.state.x, interruptedRelay.z - donkey.state.z) >= 8) interruptedRelay = null;
        for (const r of relays) {
          if (r.lit || r === interruptedRelay) continue;
          if (Math.hypot(r.x - donkey.state.x, r.z - donkey.state.z) < 6.0) { startPourAnim(r); break; }
        }
      }

      // Calm Donkey WiFi Rings & Slow Mist Arcs
      const beatMul = 1.0 + state.beatPulse * .04;
      donkeyRings[0].radius = state.signalRadius * .28 * beatMul;
      donkeyRings[1].radius = state.signalRadius * .62 * beatMul;
      donkeyRings[2].radius = state.signalRadius * beatMul;
      for (const rg of donkeyRings) updateTerrainRing(rg, donkey.state.x, donkey.state.z, .25);
      for (const wv of waveArcs) {
        const p = fract(nowSec * .12 + wv.phase);
        const rad = lerp(1.0, Math.min(28.0, state.signalRadius * .48 * beatMul), p);
        wv.mesh.position.set(donkey.state.x, donkey.group.position.y + 2.0 + p * 2.1, donkey.state.z);
        wv.mesh.scale.set(rad, 1, rad);
        wv.mesh.material.opacity = (1 - p) * .18 * (.6 + .4 * state.wifiCharge);
      }
      whip.rotation.z = Math.sin(nowSec * 3.1) * (.08 + .08 * state.beatPulse);

      if (state.pumpFlow > .05) {
        state.pumpFlow = Math.max(.22, state.pumpFlow - dt * .04);
        state.pumpLeverPhase += dt * 4.5;
        well.leverPivot.rotation.z = Math.sin(state.pumpLeverPhase) * .35 * smooth(.22, .65, state.pumpFlow);
      }
      well.stream.visible = state.pumpFlow > .25;
      well.stream.scale.set(state.pumpFlow, 1, state.pumpFlow);
      well.pool.position.y = .21 + Math.sin(nowSec * 4.0) * .012;

      /* --- WIFI WATER RAIN FALLS STRICTLY INSIDE ACTIVE WIFI DONKEY REACH + FRUSTUM AUDIO --- */
      const emitters = sampleWifiEmitters();
      const rainBeatSpd = 1.0 + state.beatPulse * .10;
      const rainLen = .92;
      camera.updateMatrixWorld();
      camProjScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      camFrustum.setFromProjectionMatrix(camProjScreen);
      let frustumRainHits = 0;
      for (let i = 0; i < RAIN_N; i++) {
        rainY[i] -= rainSpd[i] * rainBeatSpd * dt;
        const surf = driveSurfaceAt(rainX[i], rainZ[i]);
        if (rainY[i] < surf || !inWifiReach(rainX[i], rainZ[i], emitters)) respawnRaindrop(i, emitters);
        const rx = rainX[i], ry = rainY[i], rz = rainZ[i], base = i * 6;
        rainPos[base] = rx; rainPos[base + 1] = ry; rainPos[base + 2] = rz;
        rainPos[base + 3] = rx; rainPos[base + 4] = ry + rainLen; rainPos[base + 5] = rz;
        if ((i & 3) === 0) {
          _frustPt.set(rx, ry, rz);
          if (camFrustum.containsPoint(_frustPt)) {
            const dCam = _frustPt.distanceTo(camera.position);
            if (dCam < 55) frustumRainHits += (1 - dCam / 55);
          }
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
      const targetRain01 = clamp(frustumRainHits / 14, 0, 1);
      state.rainInFrustum01 = lerp(state.rainInFrustum01, targetRain01, clamp(dt * 4.5, 0, 1));
      const playerSpdNow = Math.hypot(state.vx || 0, state.vz || 0);
      state.wind01 = clamp(0.18 + Math.max(0, state.y - 12) / 140 + playerSpdNow / 24, 0.15, 1.0);
      _frustPt.set(well.x, driveSurfaceAt(well.x, well.z) + 1.1, well.z);
      const wellDist = _frustPt.distanceTo(camera.position);
      const wellInView = camFrustum.containsPoint(_frustPt) ? clamp(1 - wellDist / 48, 0, 1) : clamp(0.25 * (1 - wellDist / 26), 0, 0.25);
      state.wellFocus01 = lerp(state.wellFocus01, wellInView, clamp(dt * 4, 0, 1));
      const riverPtY = Math.min(state.y, 3.0);
      _frustPt.set(state.x * 0.4, riverPtY, state.z * 0.4);
      const riverInView = (state.y < 24 && camFrustum.containsPoint(_frustPt)) ? clamp(1 - state.y / 24, 0.1, 0.9) : 0.08;
      state.riverFocus01 = lerp(state.riverFocus01, riverInView, clamp(dt * 3, 0, 1));
      let crowdInView = 0;
      if (cast && Array.isArray(cast.list)) {
        for (let ci = 0; ci < cast.list.length; ci++) {
          const ch = cast.list[ci];
          if (!ch || !ch.group || !ch.group.visible || ch === activeAvatar) continue;
          _frustPt.set(ch.group.position.x, ch.group.position.y + 1.2, ch.group.position.z);
          if (camFrustum.containsPoint(_frustPt)) {
            const dc = _frustPt.distanceTo(camera.position);
            if (dc < 30) crowdInView += (1 - dc / 30) * 0.35;
          }
        }
      }
      if (window.HighlandSoundscape) {
        const HS = window.HighlandSoundscape;
        if (typeof HS.updateWeatherAudio === "function") HS.updateWeatherAudio(state.rainInFrustum01, state.wind01);
        if (typeof HS.updateFrustumFocus === "function") HS.updateFrustumFocus(state.wellFocus01, state.riverFocus01, clamp(crowdInView, 0, 1));
      }

      /* --- Living World: WiFi Water Squirt Gun, Donkey Drink & Dialogue Auto-Hide --- */
      stepWaterSquirt(dt, nowSec);
      if (donkey.drinkTimer > 0) {
        donkey.drinkTimer = Math.max(0, donkey.drinkTimer - dt);
        const drinkEnv = Math.sin(clamp(donkey.drinkTimer / 2.4, 0, 1) * Math.PI);
        if (donkey.group) donkey.group.rotation.x = lerp(donkey.group.rotation.x, 0.14 * drinkEnv, clamp(dt * 8, 0, 1));
        if (donkeyRig) donkeyRig.rotation.x = lerp(donkeyRig.rotation.x, 0.18 * drinkEnv, clamp(dt * 8, 0, 1));
      }
      if (_speechState.hideTimer > 0) {
        _speechState.hideTimer = Math.max(0, _speechState.hideTimer - dt);
        if (_speechState.hideTimer <= 0) closeDialogue();
      }

      leadRope.visible = !state.riding && !state.drivingCart && !state.gliding && !state.donkeyCollapsed && !(machinima && machinima.isActive());
      if (leadRope.visible) {
        donkey.halterRing(halterOut);
        donkeyHand.set(state.x + Math.cos(state.yaw) * .35, state.y - .42, state.z - Math.sin(state.yaw) * .35);
        const posArr = ropeGeo.attributes.position.array, sag = clamp(halterOut.distanceTo(donkeyHand) * .14, .1, 1.1);
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          posArr[i * 3] = lerp(donkeyHand.x, halterOut.x, u);
          posArr[i * 3 + 1] = lerp(donkeyHand.y, halterOut.y, u) - Math.sin(u * Math.PI) * sag;
          posArr[i * 3 + 2] = lerp(donkeyHand.z, halterOut.z, u);
        }
        ropeGeo.attributes.position.needsUpdate = true;
      }

      if (DEMO) demoTick(dt);
      if (cast) {
        cast.update(dt, nowSec, {
          state, donkey, wagon, camera, fieldRigGroup,
          machinimaActive: Boolean(machinima && machinima.isActive()),
          hideLabels: Boolean(machinima && machinima.areCaptionsHidden())
        });
        updateNpcJobs(dt, nowSec);
        if (worldBridge && Array.isArray(cast.list)) {
          const dancingGlobal = state.danceTimer > 0;
          const playerSpeed = Math.hypot(state.vx || 0, state.vz || 0);
          const carryingCan = Boolean((npCarrier && npCarrier().liters > 0) || state.carryingCan);
          for (let ci = 0; ci < cast.list.length; ci++) {
            const ch = cast.list[ci];
            if (!ch || !ch.group || !ch.group.visible) continue;
            const st = ch.state || {};
            const cid = st.id || `cast_${ci}`;
            const pose = String(st.pose || "idle");
            // Preserve exact prop/pump/saddle IK poses untouched
            if (pose === "pump" || pose === "heaveSaddle20kg" || pose === "childReceive20kg" || pose === "unloadHandoff" || pose === "pourBowl" || pose === "kneelPour" || pose === "convoyPhoneWalk" || pose === "ride" || pose === "driving") {
              worldBridge.setActorLocomotion(cid, { blend: 0 });
              continue;
            }
            const isCarrier = cid === "imani" || st.role === "carrier";
            const distCam = Math.hypot((st.x || 0) - camera.position.x, (st.z || 0) - camera.position.z);
            if (distCam > 85) continue;
            const isPlayer = ch === activeAvatar;
            const speedMps = isPlayer || isCarrier ? playerSpeed : (st.speed || (pose === "walk" ? 1.14 : pose === "jog" ? 3.4 : 0));
            const isDance = dancingGlobal || pose === "eskista" || pose === "dance";
            const isGreet = pose === "greeting" || pose === "wave" || (!isCarrier && !isDance && distCam < 5.5 && ((Math.floor(nowSec * 0.25) + ci) % 5 === 0));
            const isTalk = Boolean(st.speaking) || pose === "talk" || (!isCarrier && !isDance && !isGreet && distCam < 24);
            worldBridge.setActorLocomotion(cid, {
              speedMps,
              carrying: isCarrier ? carryingCan : Boolean(st.carryCan),
              dancing: isDance,
              greeting: isGreet,
              talking: isTalk,
              sitting: pose === "sit" || pose === "seated",
              crouching: pose === "crouch",
              backwards: isPlayer && state.backing,
              blend: isPlayer ? 1 : 0.84
            });
          }
          worldBridge.update(dt);
        }
        if (NP_PHYS && Array.isArray(cast.list)) {
          NP_PHYS.groundCastList(cast.list, driveSurfaceAt, carrierPhys ? carrierPhys.carryLeanRad : 0);
        }
        // Living NPC talk/cheer/phone animation, Front/Side-Hip Jerrycan Carry Fix & Bump/Knockdown Collisions
        if (Array.isArray(cast.list)) {
          const pSpeed = Math.hypot(state.vx || 0, state.vz || 0);
          const wSpeed = Math.abs(wagon.speed || 0);
          for (let ci = 0; ci < cast.list.length; ci++) {
            const ch = cast.list[ci];
            if (!ch || !ch.group || !ch.group.visible) continue;
            const ud = ch.group.userData || (ch.group.userData = {});
            const isPlayer = (ch === activeAvatar);
            if (!isPlayer) {
              ensureNpcSmartphone(ch);
              if (ud.talkTimer > 0) {
                ud.talkTimer = Math.max(0, ud.talkTimer - dt);
                if (ch.state) ch.state.speaking = ud.talkTimer > 0;
                // Gentle expressive head nod while speaking (never bone[9], which is B_CLAV_L!)
                if (ch.bones && ch.bones[8]) {
                  ch.bones[8].rotation.x += Math.sin(nowSec * 7.2 + ci) * 0.045;
                }
              }
              if (ud.cheerTimer > 0) {
                ud.cheerTimer = Math.max(0, ud.cheerTimer - dt);
                if (ud.livingPhoneGrp) {
                  ud.livingPhoneGrp.position.y = 1.16 + Math.sin(nowSec * 12 + ci) * 0.05;
                }
              } else if (ud.livingPhoneGrp) {
                ud.livingPhoneGrp.position.y = 1.12 + Math.sin(nowSec * 2.2 + ci) * 0.012;
              }
              // Bump / Knockdown checks: sprinting player, driving wagon, or thrown jerrycan
              const dxP = ch.group.position.x - state.x, dzP = ch.group.position.z - state.z;
              const distP = Math.hypot(dxP, dzP);
              if (!state.drivingCart && pSpeed > 3.8 && distP < 1.15) {
                bumpNpc(ch, dxP, dzP, clamp(pSpeed * 1.15, 4.5, 9.0));
              } else if (state.drivingCart && wSpeed > 2.0) {
                const dxW = ch.group.position.x - wagon.x, dzW = ch.group.position.z - wagon.z;
                if (Math.hypot(dxW, dzW) < 2.2) {
                  bumpNpc(ch, dxW, dzW, clamp(wSpeed * 1.4, 5.5, 10.5));
                }
              }
              if (projPool && Array.isArray(projPool.items)) {
                for (let pi = 0; pi < projPool.items.length; pi++) {
                  const pr = projPool.items[pi];
                  if (!pr || !pr.alive) continue;
                  const dxPr = ch.group.position.x - pr.x, dzPr = ch.group.position.z - pr.z;
                  if (Math.hypot(dxPr, dzPr) < 1.05 && Math.abs(pr.y - (ch.group.position.y + 0.95)) < 1.25) {
                    bumpNpc(ch, pr.vx || dxPr, pr.vz || dzPr, 6.2);
                    pr.vx *= -0.35; pr.vz *= -0.35;
                    break;
                  }
                }
              }
              if (NP_PHYS && typeof NP_PHYS.stepNpcKnockdown === "function") {
                NP_PHYS.stepNpcKnockdown(ch, dt, driveSurfaceAt, worldBoundsClamp);
              }
            }
            enforceFrontHipJerrycanCarry(ch, nowSec, isPlayer ? pSpeed : (ch.state ? (ch.state.speed || 0) : 0), isPlayer && state.squirtActive);
          }
        }
        // Position & pose active playable character for 3rd-person view (with ragdoll tumble!)
        if (activeAvatar && activeAvatar.group && !state.drivingCart && !state.gliding && !state.riding) {
          const showThird = state.cameraMode === "third" && !state.introActive;
          activeAvatar.group.visible = showThird;
          if (showThird) {
            const footY = driveSurfaceAt(state.x, state.z);                          // the soles on the real ground, not a smoothed eye height
            const tumbling = carrierPhys && carrierPhys.tumbleTimer > 0;
            activeAvatar.group.position.set(state.x, tumbling ? footY + 0.35 : footY, state.z);
            const spd = Math.hypot(state.vx || 0, state.vz || 0);
            // face where you are going, turning at a human rate; walking backwards keeps facing forward; standing keeps the last facing
            const want = state.backing ? state.yaw + Math.PI : spd > 0.25 ? Math.atan2(state.vx, state.vz) : (state.avatarHeading ?? state.yaw + Math.PI);
            const cur = state.avatarHeading ?? want, dh = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
            state.avatarHeading = cur + clamp(dh, -5.2 * dt, 5.2 * dt);
            const targetHeading = state.avatarHeading;
            activeAvatar.group.rotation.y = targetHeading;
            activeAvatar.group.rotation.x = tumbling ? carrierPhys.tumblePitch : (throwAnimTimer > 0 ? Math.sin(throwAnimTimer * Math.PI * 2) * 0.25 : 0);
            activeAvatar.group.rotation.z = tumbling ? carrierPhys.tumbleRoll : 0;
            if (activeAvatar.state) {
              activeAvatar.state.x = state.x;
              activeAvatar.state.y = footY;
              activeAvatar.state.z = state.z;
              activeAvatar.state.heading = targetHeading;
              activeAvatar.state.speed = spd;
            }
          }
        }
        // Foot-plant grounding. A clip's hips decide how high its feet are (the jog runs 30 cm in the air on these
        // bodies), so for each clip-driven person near the camera we track the lowest foot over the last gait cycle and
        // move the body so that foot meets the ground. Bob and the run's flight phase stay; hovering and sinking go.
        if (activeAvatar && activeAvatar.label && activeAvatar.label.sprite) activeAvatar.label.sprite.visible = false;   // no nameplate over yourself
        if (DEMO && (demo.line || demo.handoff)) for (const c of cast.list) if (c.label && c.label.sprite) c.label.sprite.visible = false;   // the bubble names who speaks
        if (worldBridge) for (const ch of cast.list) {
          if (!ch || !ch.group || !ch.group.visible) continue;
          const pose = String((ch.state && ch.state.pose) || "");
          if (pose === "ride" || pose === "driving" || pose === "glide" || pose === "sit" || pose === "seated" || ch.state.scripted || /Handoff|Receive|pour|Pour|pump/.test(pose)) { if (ch.__feet) ch.__feet.corr = 0; continue; }   // posed by IK to a can or lever: leave it where the IK put it
          if (Math.hypot(ch.group.position.x - camera.position.x, ch.group.position.z - camera.position.z) > 60) continue;
          const fp = ch.__feet || (ch.__feet = (() => { const f = []; ch.group.traverse(o => { if (o.isBone && /^foot_[LR]$/i.test(o.name)) f.push(o); }); return { b: f.length === 2 ? f : null, win: [], corr: 0 }; })());
          if (!fp.b) continue;
          ch.group.updateMatrixWorld(true);
          let lo = 9; for (const b of fp.b) { b.getWorldPosition(plantV); lo = Math.min(lo, plantV.y - driveSurfaceAt(plantV.x, plantV.z)); }
          fp.win.push(lo); if (fp.win.length > 22) fp.win.shift();          // ~0.7 s: one walk cycle, two jog strides
          const want = clamp(.085 - Math.min(...fp.win), -.45, .12);
          fp.corr += (want - fp.corr) * (1 - Math.exp(-dt * 6));
          if (!(carrierPhys && ch === activeAvatar && carrierPhys.tumbleTimer > 0)) ch.group.position.y += fp.corr;
        }
      }

      // Sync 2086 Mistletoe 20L chalk-marked saddle cans + screening cues + station proximity
      const npC = npCarrier();
      const canFrac = clamp(npC.liters / 20, 0, 1);
      for (const sc of saddleCans) { sc.userData.setFill(canFrac); sc.userData.setDull(npC.liters <= 0); }
      if (npScreeningMode && $("np-prog-cue")) {
        npScreenTimer += dt;
        const tails = npCharter().tailWords;
        const idx = clamp(Math.floor((npScreenTimer % 8.4) / 2.8), 0, tails.length - 1);
        setText("np-prog-cue", `“${tails[idx]}”`);
      }
      if (!state.introActive && !state.gliding && !(machinima && machinima.isActive()) && npC.phase === "ground") {
        let nearId = null, bestD = 32;
        for (const [sid, pos] of Object.entries(NP_STATIONS)) {
          if (npWorld.places[sid]?.circuit !== npState.active) continue;
          const d = Math.hypot(state.x - pos.x, state.z - pos.z);
          if (d < bestD) { bestD = d; nearId = sid; }
        }
        if (nearId && nearId !== npC.place) {
          if (nearId !== "oxbow" && nearId !== "compound") closeScreeningCard();
          npC.place = nearId;
          if (!npC.visited.includes(nearId)) npC.visited.push(nearId);
          npState.rev++; saveNpState();
        }
      }

      meterClock += dt;
      if (meterClock > .12) {
        meterClock = 0; sampleMeter();
        $("thought").textContent = state.donkeyCollapsed
          ? "ALERT · Mistletoe collapsed from dehydration — press P to give emergency water!"
          : state.pourAnim
            ? `Pouring cyan WiFi water at ${state.pourAnim.relay.name} (${state.pourAnim.relay.cans.length} jerrycans filling)…`
            : state.glide.cruising
              ? `Teton Range · ${(Math.hypot(mw.tetonRange.x - state.x, mw.tetonRange.z - state.z) / 1000).toFixed(1)} km`
              : state.gliding
                ? `${state.donkeyOnRoof ? "Wagon flight · Mistletoe aboard" : "Mistletoe gliding"} · Alt ${fmtElev(state.antennaElev)}`
                : state.drivingCart
                  ? `Cruiser Woody (Chassis ${vehPhys ? Math.round(vehPhys.integrity) : 100}% · Load ${state.waterLiters.toFixed(1)} kg) · Cans ${state.filledCans}/${state.totalCans} · Next ${state.nextRelayName.split(" ")[0]} ${Math.round(state.nextRelayDist)}m.`
                  : `Unified World (${state.region === "ridge" ? "Half Dome" : state.region === "abyss" ? "Abyssal Sanctuary" : "Grand Teton"}) · Song ${SONG_EPOCHS[state.songEpochIdx].hint}`;
        if (!useFieldLayout() && (!audioEl.paused || audioEl.currentTime > 0)) {
          const curT = audioEl.currentTime, dur = Number.isFinite(audioEl.duration) ? audioEl.duration : 283;
          $("tape-time").textContent = `${formatMMSS(curT)} / ${formatMMSS(dur)}`;
          if ($("tape-fill")) $("tape-fill").style.width = `${clamp((curT / dur) * 100, 0, 100)}%`;
          $("ppc-timecode").textContent = `01:${String(12 + Math.floor(curT / 60)).padStart(2, "0")}:${String(Math.floor(curT % 60)).padStart(2, "0")}`;
          let line = LYRICS[0][1]; for (const [ts, txt] of LYRICS) if (curT >= ts) line = txt;
          $("lyric-line").textContent = line;
        } else if (!useFieldLayout()) $("ppc-timecode").textContent = `01:14:${String(17 + (Math.floor(nowSec) % 42)).padStart(2, "0")}`;
        updateHUD();
      }
      // Legacy audio.tick oscillator clock removed; ambience comes from HighlandSoundscape + tape playback.
    }

    if (!state.introActive) placeAtNpStation(npCarrier().place || "overlook");
    if (window.createMachinimaDirector) {
      machinima = window.createMachinimaDirector({
        T, canvas, camera, state, donkey, wagon, cast, relays, forestGroves,
        fieldRigGroup, pourGroup, donkeyGlider, contrailL, contrailR,
        audio, audioEl, keys, driveSurfaceAt, setRegion, initRain,
        applyLevelChaseCamera, applyLevelFPSCamera, poseRoofRider, poseGlider,
        toggleInWorldVideo, finishIntro, updateHUD, toast, hasAhiya: true
      });
      if ($("intro-trailer")) $("intro-trailer").addEventListener("click", () => machinima.start("trailer", 0));
      if ($("intro-mv")) $("intro-mv").addEventListener("click", () => machinima.start("musicvideo", 0));
      if ($("tape-trailer-btn")) $("tape-trailer-btn").addEventListener("click", () => machinima.toggle("trailer"));
      if ($("field-trailer-btn")) $("field-trailer-btn").addEventListener("click", () => machinima.toggle("trailer"));
      if (urlParams.get("trailer") === "1") machinima.start("trailer", 0);
      else if (urlParams.get("musicvideo") === "1") machinima.start("musicvideo", 0);
      else if (urlParams.get("machinima") === "1") machinima.start("dolly", 0);
    }
    // Register solid world obstacles (wellhead, cistern pedestals, forest trunks) for vehicle collision physics
    worldObstacles.push({ x: well.x, z: well.z, r: 1.6, kind: "wellhead" });
    for (const r of relays) worldObstacles.push({ x: r.x, z: r.z, r: 2.2, kind: "cistern" });
    for (const g of forestGroves) {
      if (g.meshes) {
        for (const item of g.meshes) {
          if (item && item.mesh) {
            worldObstacles.push({ x: g.x + item.mesh.position.x, z: g.z + item.mesh.position.z, r: 1.1, kind: "tree" });
          }
        }
      }
    }
    initRain();
    syncIntroUI();
    step(.016);
    sampleMeter();
    updateHUD();
    renderFrame(.016);
    document.body.classList.add("field-ready");
    const loaderEl = $("world-loader");
    if (loaderEl && !contextLost) {
      loaderEl.classList.add("fade-out");
      setTimeout(() => { if (!contextLost) loaderEl.hidden = true; }, 580);
    }

    function loop(now) {
      if (contextLost) return;
      if (lastT === null) lastT = now - 16;
      const dt = clamp((now - lastT) / 1000, .001, .05); lastT = now;
      step(dt); renderFrame(now * .001); requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    window.__nightPost = window.__zones = {
      isReady: () => state.ready,
      stepOnce: dt => { step(dt || .05); sampleMeter(); updateHUD(); renderFrame(performance.now() * .001); },
      getState: () => {
        const emitters = sampleWifiEmitters();
        let rainOutsideWifi = 0;
        for (let i = 0; i < RAIN_N; i++) if (!inWifiReach(rainX[i], rainZ[i], emitters)) rainOutsideWifi++;
        const rollDeg = +(camera.rotation.z * 180 / Math.PI).toFixed(3);
        const npC = npCarrier();
        return {
          ready: true,
          circuit: npState.active,
          carrier: npCharter().carrier,
          place: npC.place,
          watch: npC.watch,
          clock: npEngine.clock(npC.watch),
          day: npC.day,
          liters: npC.liters,
          reserve: npC.reserve,
          freeLiters: npEngine.free(npC),
          strength: npC.strength,
          wet: [...npC.wet],
          phone: [...npC.phone],
          flags: { ...npC.flags },
          ledger: { ...npC.ledger },
          ledgerValid: npEngine.validate(npState),
          screeningActive: Boolean(npScreeningMode),
          dispatchOpen: Boolean($("np-dispatch-modal") && !$("np-dispatch-modal").hidden),
          inWorldVideoMode,
          activeScreenId,
          introActive: state.introActive,
          introPhase: state.introPhase,
          introShotIdx: state.introShotIdx,
          region: state.region,
          mode: MODES[state.modeIdx].id,
          soloLook: state.soloLook,
          focusLook: LOOKS[state.focusLook].id,
          focusDist: state.focusDist,
          stop: STOPS[state.stopIdx].name,
          filter: FILTERS[state.filterIdx].name,
          currentZone: state.currentZone,
          meteredZone: state.meteredZone,
          x: +state.x.toFixed(2), z: +state.z.toFixed(2), y: +state.y.toFixed(2),
          groundY: +groundAt(state.x, state.z).toFixed(2),
          cameraRollDeg: rollDeg,
          mobileUI: useFieldLayout(),
          fov: +camera.fov.toFixed(1),
          dpr: renderer.getPixelRatio(),
          fieldBand: fieldGroups[fieldToolIndex].name,
          fieldSetting: fieldSetting().name,
          bandPickerOpen: !fieldBandPicker.hidden,
          wagon: { x: wagon.x, z: wagon.z, y: wagon.y, heading: +wagon.heading.toFixed(4), speed: wagon.speed, steerAngle: wagon.steerAngle, roll: wagon.roll, pitch: +wagon.pitch.toFixed(3) },
          wagonCruise: state.wagonCruise,
          nextRelayAzDeg: +state.nextRelayAzDeg.toFixed(1),
          mapTargetPx: state.mapTargetPx ?? null,
          mapTargetPy: state.mapTargetPy ?? null,
          mapTargetRelDeg: state.mapTargetRelDeg ?? null,
          donkeyOnRoof: state.donkeyOnRoof,
          gliding: state.gliding,
          glide: { x: state.glide.x, y: state.glide.y, z: state.glide.z, speed: +state.glide.speed.toFixed(1), vy: +state.glide.vy.toFixed(1),
            withWagon: state.gliding && state.donkeyOnRoof, landing: state.glide.landing, cruising: state.glide.cruising },
          drivingCart: state.drivingCart,
          riding: state.riding,
          donkeyWater: +state.donkeyWater.toFixed(3),
          donkeyCollapsed: state.donkeyCollapsed,
          pouring: !!state.pourAnim,
          dancing: state.danceTimer > 0,
          filledCans: state.filledCans,
          totalCans: state.totalCans,
          lidarOn: state.lidarOn,
          songEpoch: state.songEpochIdx,
          resonantZone: state.resonantZone,
          zoneSynced: state.zoneSynced,
          spatialAudio: state.spatialAudio,
          audioDistMeters: +state.audioDistMeters.toFixed(1),
          audioFalloffDb: state.audioFalloffDb,
          beatPulse: +state.beatPulse.toFixed(2),
          filmStripFrames: state.filmStripFrames,
          rigDeployed: state.rigDeployed,
          antennaElev: +state.antennaElev.toFixed(1),
          relElev: +state.relElev.toFixed(1),
          signalRadius: +state.signalRadius.toFixed(1),
          frameWifiPct: state.frameWifiPct,
          unlockedGroves: state.unlockedGroves,
          totalGroves: forestGroves.length,
          unlockedTrees: state.unlockedTrees,
          rainCount: RAIN_N,
          rainOutsideWifi,
          signalDbm: state.signalDbm,
          litRelays: state.litRelays,
          totalRelays: relays.length,
          coveragePct: state.coveragePct,
          plates: state.plates.length,
          audioReady: audioEl.readyState >= 1 || Boolean(window.HighlandSoundscape),
          soundscapeReady: Boolean(window.HighlandSoundscape && (typeof window.HighlandSoundscape.isReady === "function" ? window.HighlandSoundscape.isReady() : true)),
          radioMounted: Boolean(window._npSoundscapeState && window._npSoundscapeState.radioMounted),
          castCount: cast ? cast.list.length : 0,
          worldBridgeLoadedClips: worldBridge ? worldBridge.getLoadedClips() : [],
          worldBridgeActors: worldBridge && cast ? cast.list.slice(0, 6).map((c, i) => {
            const id = (c.state && c.state.id) || `cast_${i}`;
            const as = worldBridge.getActorState(id);
            return as ? { id, clip: as.clip, loaded: as.loaded, blend: +as.blend.toFixed(2) } : null;
          }).filter(Boolean) : [],
          machinima: machinima ? machinima.getState() : null,
          cameraMode: state.cameraMode,
          playAs: state.playAs,
          activeAvatarVisible: Boolean(activeAvatar && activeAvatar.group && activeAvatar.group.visible),
          bigMapOpen: state.bigMapOpen,
          throwCount: state.throwCount,
          worldWaterDeliveredL: state.worldWaterDeliveredL,
          sprintToggle: state.sprintToggle,
          squirtActive: state.squirtActive,
          carryCanLocalZ: +state.carryCanLocalZ.toFixed(3),
          rainInFrustum01: +state.rainInFrustum01.toFixed(3),
          wind01: +state.wind01.toFixed(3),
          wellFocus01: +state.wellFocus01.toFixed(3),
          riverFocus01: +state.riverFocus01.toFixed(3),
          npcBumpCount: state.npcBumpCount,
          lastDialogue: state.lastDialogue,
          dialogueOpen: Boolean($("dialogue-card") && !$("dialogue-card").hidden),
          nearestInteractable: (() => {
            const t = findNearestInteractable(NPC_INTERACT_RADIUS);
            return t ? { kind: t.kind, id: t.id, name: t.name, jobTitle: t.jobTitle, dist: +t.dist.toFixed(2) } : null;
          })(),
          npcJobs: cast && Array.isArray(cast.list) ? cast.list
            .filter(c => c && c.group && c.group.userData && c.group.userData.npcJob && c.group.userData.npcJob.spec)
            .map(c => {
              const j = c.group.userData.npcJob;
              return { id: j.id, name: j.displayName, job: j.jobTitle, mode: j.mode, station: j.currentStation, status: j.currentStatus, x: +j.x.toFixed(2), z: +j.z.toFixed(2) };
            }) : [],
          quests: state.quests,
          physics: {
            gravity: NP_PHYS ? NP_PHYS.GRAVITY : 22.0,
            wagonUnderbodySamples: vehPhys ? vehPhys.underbodySamples : 0,
            wagonMaxSampledHeight: vehPhys ? +vehPhys.maxSampledHeight.toFixed(3) : 0,
            wagonRideClearance: vehPhys ? vehPhys.rideClearance : 0,
            wagonClearanceDelta: vehPhys ? +(vehPhys.y - vehPhys.maxSampledHeight).toFixed(3) : 0,
            carrierGrounded: carrierPhys ? carrierPhys.grounded : true,
            carrierTumbling: carrierPhys ? carrierPhys.tumbleTimer > 0 : false,
            activeProjectiles: projPool ? projPool.activeCount : 0,
            waterLiters: +state.waterLiters.toFixed(2),
            waterKg: +state.waterLiters.toFixed(2),
            sloshX: waterSlosh ? +waterSlosh.sloshX.toFixed(3) : 0,
            sloshZ: waterSlosh ? +waterSlosh.sloshZ.toFixed(3) : 0,
            sloshMag: waterSlosh ? +waterSlosh.magnitude.toFixed(3) : 0,
            sloshPct: state.sloshPct,
            spilling: state.sloshSpilling,
            totalSpilledL: waterSlosh ? +waterSlosh.totalSpilledL.toFixed(3) : 0,
            integrity: vehPhys ? +vehPhys.integrity.toFixed(1) : 100,
            bumperDent: vehPhys ? +vehPhys.bumperDent.toFixed(3) : 0,
            hoodTilt: vehPhys ? +vehPhys.hoodTilt.toFixed(3) : 0,
            airborne: vehPhys ? vehPhys.airborne : false,
            slopeDeg: vehPhys ? +(vehPhys.slopeAngle * 180 / Math.PI).toFixed(2) : 0,
            wheelOffsets: vehPhys ? vehPhys.wheelOffsets.map(v => +v.toFixed(3)) : [0, 0, 0, 0],
            carryLeanRad: carrierPhys ? +carrierPhys.carryLeanRad.toFixed(3) : 0,
            carrierSpeedMult: carrierPhys ? +carrierPhys.speedMult.toFixed(3) : 1,
            donkeyGroundGap: +(donkey.group.position.y - driveSurfaceAt(donkey.state.x, donkey.state.z)).toFixed(3),
            obstacleCount: worldObstacles.length,
            particleCount: physParticles ? physParticles.activeCount : 0
          }
        };
      },
      triggerSquirt: (dur = 2.0) => { triggerSquirtBurst(dur); return state.squirtBurstTimer; },
      triggerTalk: () => interactTalk(),
      triggerNpcBump: () => {
        if (!cast || !Array.isArray(cast.list)) return false;
        const target = cast.list.find(c => c && c.group && c.group.visible && c !== activeAvatar);
        return target ? bumpNpc(target, 1, 0.4, 6.8) : false;
      },
      castWorld: () => cast.list.filter(c => /ahiya/.test(c.state.circuit || '') || DEMO_STOP_OF[c.state.id]).map(c => { const w = c.group.getWorldPosition(new T.Vector3()); return { id: c.state.id, pose: c.state.pose, sx: +c.state.x.toFixed(2), sz: +c.state.z.toFixed(2), wx: +w.x.toFixed(2), wz: +w.z.toFixed(2), parent: c.group.parent && c.group.parent.name || c.group.parent && c.group.parent.type }; }),
      getCast: () => cast ? cast.list.map(c => ({
        id: c.state.id, name: c.state.name, role: c.state.role,
        x: +c.state.x.toFixed(1), z: +c.state.z.toFixed(1), pose: c.state.pose, visible: c.group.visible
      })) : [],
      getRelays: () => relays.map(r => ({ id: r.id, name: r.name, lit: r.lit, cans: r.cans.length, filled: r.cans.filter(c => (c.userData.fill || 0) >= .95).length })),
      getForest: () => forestGroves.map(g => ({ id: g.id, region: g.region, name: g.name, minRelAlt: g.minRelAlt, unlocked: g.unlocked })),
      getSummits: () => SUMMITS.map(s => ({ id: s.id, region: s.region, name: s.name, x: s.x, z: s.z })),
      setMode: id => { const i = MODES.findIndex(m => m.id === id); if (i >= 0) { state.modeIdx = i; state.focusPulse = 1; updateHUD(); if (state.trayTab) renderTray(); } },
      setFocus: m => { state.focusDist = clamp(m, 1.2, 900); state.focusPulse = 1; updateHUD(); },
      setStop: i => { state.stopIdx = clamp(i, 0, STOPS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
      setFilter: i => { state.filterIdx = clamp(i, 0, FILTERS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
      setSoloLook: id => { state.soloLook = id ? LOOKS.findIndex(l => l.id === id) : -1; updateHUD(); if (state.trayTab) renderTray(); },
      setDonkeyWater: v => {
        state.donkeyWater = clamp(v, 0, 1);
        if (state.donkeyWater <= 0.18) {
          state.donkeyCollapsed = true; donkey.state.collapsed = true; donkey.state.downWant = true; donkey.state.stamina = .05; donkey.state.speed = 0;
        } else if (state.donkeyWater > 0.22) {
          state.donkeyCollapsed = false; donkey.state.collapsed = false; donkey.state.downWant = false; donkey.state.stamina = 1.0;
        }
        updateHUD();
        updateContextualActions();
      },
      lookAtDonkey: () => {
        if (state.gliding) landGlide(false);
        const dx = donkey.state.x, dz = donkey.state.z;
        state.riding = false; state.drivingCart = false; state.donkeyOnRoof = false;
        state.x = dx - 2.6; state.z = dz + 2.2; state.y = driveSurfaceAt(state.x, state.z) + 1.6;
        state.yaw = Math.atan2(-(dx - state.x), -(dz - state.z));
        state.pitch = -.05; state.focusDist = 4.0;
        applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
        sampleMeter(); updateHUD();
      },
      moveTo: (wx, wz, yaw = Math.PI * .5) => {
        if (state.gliding) landGlide(false);
        state.riding = false; state.drivingCart = false; state.donkeyOnRoof = false;
        [state.x, state.z] = worldBoundsClamp(wx, wz);
        state.y = driveSurfaceAt(state.x, state.z) + 1.68;
        state.yaw = yaw; state.pitch = -.05;
        donkey.place(state.x + 2.2, state.z - 1.2, yaw + Math.PI, (x, z) => driveSurfaceAt(x, z));
        applyLevelFPSCamera(state.x, state.y, state.z, state.yaw, state.pitch);
        initRain(); sampleMeter(); updateHUD(); renderFrame(performance.now() * .001);
      },
      exposePlate, teleportZone, toggleRide, toggleCart, toggleGlide, launchSummit, toggleRegion,
      pumpWell, pourWifi, pingSignal, toggleTape, toggleLidar, syncResonantZone, triggerDance, toggleSpatialAudio, deployRig, seekTape,
      getOptions: () => npEngine.options(npState),
      act: runNpAction,
      switchCircuit: switchNpCircuit,
      moveToStation,
      setWatch: w => { npCarrier().watch = clamp(Math.round(w), 0, 18); npState.rev++; saveNpState(); updateHUD(); renderFrame(performance.now() * .001); },
      openDispatch: openNpDispatch,
      toggleInWorldVideo,
      startMachinima: (m = "trailer", t = 0) => machinima?.start(m, t),
      stopMachinima: () => machinima?.stop(),
      seekMachinima: t => machinima?.seek(t),
      startRecording: () => machinima?.startRecording(),
      stopRecording: () => machinima?.stopRecording(false),
      reset: (circuit = "west") => {
        closeScreeningCard();
        npState = circuit === "ahiya" ? npEngine.switchRoute(npEngine.start(), "ahiya") : npEngine.start();
        saveNpState();
        moveToStation(npCarrier().place || "overlook");
      },
      setTouchStick: (fx, fy) => setStick(clamp(fx, -1, 1), -clamp(fy, -1, 1)),
      playIntro: startPrologue, skipIntro: () => finishIntro(false),
      groundAt: (x, z) => driveSurfaceAt(x, z), ahiyaGround: () => AHIYA_GROUND_MODE,
      npOptions: () => { try { return npEngine.options(npState).map(o => ({ id: o.id, label: o.label, enabled: o.enabled, reason: o.reason })); } catch (e) { return String(e); } },
      handoffDbg: () => demo.handoff ? { u: +(demo.handoff.t / demo.handoff.dur).toFixed(2), can: demo.can.canRoot.position.clone(), gL: hoV.gL.clone(), gR: hoV.gR.clone() } : null,
      dewDbg: () => demo.dew ? { drops: demo.dew.drops.length, beads: demo.dew.beads.length, wisps: demo.dew.wisps.length, rain: +(demo.dew.rain || 0).toFixed(2), glyphs: demo.dew.glyphs.length, gust: +demo.dew.gust.toFixed(2), cloud: demo.dew.clouds.map(c => +c.d.toFixed(1)).join(' '), flare: +demo.dew.flare.toFixed(2), breath: +demo.dew.breath.toFixed(2), running: demo.dew.drops.filter(d => d.state === 'fall').length, big: +Math.max(0, ...demo.dew.drops.map(d => d.r)).toFixed(1) } : null,
      wetDbg: () => ({ live: demo.live ? { kind: demo.live.kind, verb: demo.live.verb, ctx: demo.live.ctx, ask: !!demo.live.ask, dl: demo.live.dl } : null, pos: demo.wetPos }),
      voiceDbg: () => ({ last: demo.lastVoice, man: !!demo.voiceMan, voices: field ? field.voices.length : -1, env: field ? field.voiceEnv : 0, hits: field ? field.hits.filter(h => h.bus === 'voice').length : 0 }),
      demo: () => ({ on: DEMO, solids: demo.solids ? demo.solids.length : (DEMO ? (demoBuildSolids(), demo.solids.length) : 0), withCh: demo.withCh ? demo.withCh.state.id : null, line: demo.line ? demo.line.text : "", pose: demo.withCh ? demo.withCh.state.pose : "",
        speaking: demo.withCh ? Boolean(demo.withCh.state.poseOpts && demo.withCh.state.poseOpts.speaking) : false, signal: demo.signal, thread: demo.thread || [] }),
      demoSay: t => demoSay(t), demoResolve: (x, z, r) => demoResolve(x, z, r || .35), wagonState: () => ({ x: wagon.x, z: wagon.z, speed: wagon.speed, heading: wagon.heading }),
      setKey: (code, down) => { keys[code] = !!down; }, toggleCart: () => toggleCart(), field: () => field, startField: () => startField(), avatar: () => activeAvatar, mode3: () => state.cameraMode, simOnce: dt => step(dt || .05),
      repairWagon: () => repairWagonAtStation(),
      triggerImpact: (sev = 22, type = "rock") => { if (vehPhys) { vehPhys.applyImpact(sev, type, onVehicleImpact); applyWagonVisuals(); updateHUD(); } },
      setCameraMode: m => { setCameraMode(m); step(0.05); renderFrame(performance.now() * 0.001); },
      setPlayAs: id => { setPlayAs(id); step(0.05); renderFrame(performance.now() * 0.001); },
      throwObject: k => throwObject(k),
      jumpPlayer: () => jumpPlayer(),
      triggerTumble: i => triggerPlayerTumble(i),
      openBigMap: (open = true) => setBigMapOpen(open),
      teleportToWorld: (x, z, lbl) => teleportToWorld(x, z, lbl),
      finishRelay: idx => { if (relays[idx]) finishRelayIgnition(relays[idx]); },
      triggerSlosh: (ix = 4.2, iz = 3.2) => { if (waterSlosh) waterSlosh.impulse(ix, iz); },
      setWaterLiters: L => { state.waterLiters = clamp(L, 0, 40); updateHUD(); },
      placeWagon: (wx, wz, hdg) => {
        wagon.x = wx; wagon.z = wz; wagon.heading = hdg ?? wagon.heading;
        wagon.y = driveSurfaceAt(wx, wz);
        if (vehPhys) { vehPhys.syncFrom(wagon.x, wagon.y, wagon.z, wagon.heading, driveSurfaceAt); applyWagonVisuals(); }
      }
    };
  }

  boot().catch(err => {
    showWorldFault("The expedition could not load. Retry or return to the index.", err);
  });
})();
