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

  const ridgeFragment = `
varying vec3 vWorld,vNormal;
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
  vec3 p=vWorld,n=normalize(vNormal);
  float d=length(cameraPosition-p), slope=1.-n.y;
  vec2 field=(p.xz-uAerialBounds.xy)*uAerialBounds.zw;
  float mapped=step(0.,field.x)*step(field.x,1.)*step(0.,field.y)*step(field.y,1.);
  vec3 relief=texture2D(uRelief,field).rgb;
  float airborne=fbm(p.xz*.006);
  vec3 slabs=faces(uRock,p/132.,n);
  vec3 grains=faces(uRock,p/14.,n);
  vec3 grit=texture2D(uGround,p.xz*.23).rgb;
  float aerial=texture2D(uAerial,field).r;
  float cliff=smoothstep(.16,.47,slope)*.75+.25*smoothstep(230.,1000.,p.y);
  float stone=(.077+.27*slabs.r)*(.66+.68*grains.r);
  float soil=(.026+.117*grit.r)*(.69+.46*grit.b);
  float wood=mix(.56,.94,airborne);
  float key=max(0.,dot(n,sun));
  float value=mix(soil*wood,stone,clamp(cliff,0.,1.));
  value*=mix(1.,.57+.81*aerial,mapped*.75);
  value*=.22+1.25*key*lightWindow(p.xz);
  value*=mix(1.,.49+.66*relief.g+.22*relief.r,mapped*cliff*.64);
  float flakes=smoothstep(850.,1550.,p.y)*smoothstep(.32,.72,relief.r+airborne*.35)*(1.-smoothstep(.45,.88,slope));
  value=mix(value,(.16+.66*key)*(.62+.45*grains.r),flakes*.64);
  float haze=(1.-exp(-d*.00018))*(1.-smoothstep(90.,1500.,p.y)*.65);
  value=mix(value,.20,haze*.48);
  gl_FragColor=vec4(vec3(paper(film(value))),1.);
}`;

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

    const tetonGround = (x, z) => {
      for (const h of [heights.detail, heights.reach, heights.near]) if (inside(h.bounds, x, z)) return h.at(x, z);
      return heights.far.at(x, z);
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
    const ridge = makeRegionScene();

    const tetonMaterials = {
      ...lighting, uUnlit: { value: 0 }, uSky: U("sky-plate"),
      uRock: U("rock"), uGround: U("ground"), uScree: U("scree"), uCobbles: U("cobbles"),
      uFlow: U("flow"), uGravel: U("gravel"), uCanopy: U("canopy"), uGeology: U("geology"),
      uMountainRelief: U("mountain-relief"),
      uGeoBounds: { value: textureBounds(config.far.bounds) }, uFlowBounds: { value: textureBounds(config.river.bounds) },
      uCanopyBounds: { value: textureBounds(config.canopy.bounds) }, uMountainBounds: { value: textureBounds(config.mountainRelief) }
    };
    const trim = (box, n) => [box[0] + n, box[1] - n, box[2] + n, box[3] - n];
    function tetonLayer(k, width, height, cuts, texName, uvBounds, order) {
      const layer = heights[k];
      const mat = new T.ShaderMaterial({
        uniforms: { ...tetonMaterials, uSurface: U(texName) },
        vertexShader: meshVertex, fragmentShader: printTerrainFragment,
        polygonOffset: order > 0, polygonOffsetFactor: -order, polygonOffsetUnits: -order
      });
      const m = new T.Mesh(rasterMesh(layer.at, layer.bounds, width, height, { cuts, uvBounds }), mat);
      m.renderOrder = order;
      tetons.world.add(m);
    }
    tetonLayer("far", 295, 479, [trim(config.near.bounds, 120)], "far-surface", config.far.bounds, 0);
    tetonLayer("near", 321, 341, [trim(config.detail.bounds, 17), trim(config.reach.bounds, 19)], "near-surface", config.near.bounds, 1);
    tetonLayer("reach", 500, 207, [], "near-surface", config.near.bounds, 2);
    tetonLayer("detail", 161, 161, [], "detail-surface", config.detail.bounds, 3);

    const ridgeMaterial = new T.ShaderMaterial({
      uniforms: {
        ...lighting, uSky: U("sky-plate"), uGround: U("ground"), uRock: U("rock"), uScree: U("scree"),
        uAerial: U("half-ground"), uRelief: U("half-relief"), uAerialBounds: { value: textureBounds([-3000, 3900, -600, 7200]) }
      },
      vertexShader: meshVertex, fragmentShader: ridgeFragment, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    });
    const ridgeLocal = [-135, 240, -110, 195];
    const ridgeMid = [-680, 980, -700, 1120];
    const addRidge = (geo, ord) => { const m = new T.Mesh(geo, ridgeMaterial); m.renderOrder = ord; ridge.world.add(m); };
    addRidge(rasterMesh(halfGrid.at, halfGrid.bounds, 455, 455, { cuts: [trim(ridgeMid, 35)] }), 0);
    addRidge(rasterMesh(ridgeGround, ridgeMid, 220, 240, { cuts: [trim(ridgeLocal, 14)] }), 1);
    addRidge(rasterMesh(ridgeGround, ridgeLocal, 198, 172), 2);

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
      if (clock - lastReflection < .14 && reflectedEye.distanceToSquared(viewCam.position) < 4.0) return;
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
    const line = (grp, mat, a, b, th) => {
      const p = new T.Vector3(...a), q = new T.Vector3(...b), v = q.clone().sub(p), j = p.clone().lerp(q, .5);
      const m = addMesh(grp, cylinder, mat, j.x, j.y, j.z, th, v.length(), th);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
      return m;
    };

    // Snake River Overlook Survey Deck + Ramp
    const DECK_Y = 156.31;
    const deckGroup = new T.Group();
    tetons.world.add(deckGroup);
    box(deckGroup, wood, -36.5, DECK_Y - .14, 1.35, 23.6, .24, 7.8);
    for (let i = 0; i < 14; i++) box(deckGroup, walnutMat, -47.8 + i * 1.75, DECK_Y - .01, 1.35, .12, .03, 7.7);
    for (const z of [-2.4, 5.1]) box(deckGroup, wood, -36.5, DECK_Y + .04, z, 23.6, .09, .16);
    box(deckGroup, wood, -48.25, DECK_Y + .04, 1.35, .16, .09, 7.8);
    for (const x of [-47.4, -40, -32.5, -25.4]) for (const z of [-2.1, 4.8]) {
      const gy = tetonGround(x, z) - 1.2, h = Math.max(1, DECK_Y - gy);
      box(deckGroup, iron, x, gy + h / 2, z, .26, h, .26);
    }
    const ramp = box(deckGroup, wood, -22.2, 155.8, 1.35, 5.5, .22, 7.6);
    ramp.rotation.z = -.18;

    // Instanced Trees (7,400+ Tetons + 4,400+ Half Dome)
    const random = seedRandom(77269);
    function addTrees(worldScene, data) {
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
      worldScene.add(mesh);
    }

    const forest = [];
    for (let i = 0; i < crownPositions.length; i += 5) {
      const [x, , z, raw, cover] = crownPositions.subarray(i, i + 5);
      if (wet(x, z) > .4 || random() < .19) continue;
      if (x > -450 && x < -205 && Math.abs(z + 54) < 9) continue;
      if (x > -120 && x < -12 && z > -180 && z < 15) continue;
      const bar = maskAt(covers, x, z, 0) / 255;
      if (bar > .29 && random() < .81) continue;
      const h = Math.min(raw, 27) * (bar > .19 ? .43 : .86 + .13 * random());
      const id = h > 10 ? (random() < .70 ? 0 : 3) : h > 6 ? (random() < .51 ? 10 : 6) : 8;
      forest.push([x, tetonGround(x, z), z, h, h * config.crownRatios[id] * (.71 + cover * .19), id + random() * .995]);
    }
    for (let i = 0; i < 7400; i++) {
      const x = -720 + random() * 444, z = -168 + random() * 344;
      const bar = maskAt(covers, x, z, 0) / 255;
      if (bar < .08 || wet(x, z) > -1.6 || Math.abs(z + 55) < 4.5 || random() > (maskAt(covers, x, z, 1) / 255) * .48) continue;
      const h = .40 + 4.3 * random() ** 1.4;
      forest.push([x, tetonGround(x, z), z, h, h * 1.38, 8 + random() * 1.98]);
    }
    addTrees(tetons.world, forest);

    const grove = [];
    for (let i = 0; i < 4400; i++) {
      const x = -2050 + random() * 5150, z = -1970 + random() * 2200, y = ridgeGround(x, z);
      if (y > 700 || (x > 58 && x < 98 && z > -102 && z < 44)) continue;
      const grade = Math.abs(ridgeGround(x + 6, z) - y) + Math.abs(ridgeGround(x, z + 6) - y);
      if (grade > 6 || random() < .23) continue;
      const h = 4.7 + 20 * random() ** 1.5;
      grove.push([x, y, z, h, h * (.48 + .31 * random()), (random() < .71 ? 0 : 10) + random() * 1.91]);
    }
    addTrees(ridge.world, grove);

    function stones(worldScene, ground, count, bounds) {
      const [x0, x1, z0, z1] = bounds;
      const mesh = new T.InstancedMesh(boulderGeo, rockMaterial, count);
      const o = new T.Object3D(), col = new T.Color();
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 6) {
        tries++;
        const x = lerp(x0, x1, random()), z = lerp(z0, z1, random());
        const s = .073 + (random() ** 3.3) * .84;
        if (worldScene === tetons.world && (wet(x, z) > -.5 || (x > -52 && x < -14 && z > -10 && z < 12))) continue;
        if (worldScene === ridge.world && x > 67 && x < 83 && z > -32 && z < 5) continue;
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
      worldScene.add(mesh);
    }
    stones(tetons.world, tetonGround, 850, [-460, -200, -114, 22]);
    stones(tetons.world, tetonGround, 1100, [-960, -15, -220, 230]);
    stones(ridge.world, ridgeGround, 720, [37, 118, -119, 61]);
    stones(ridge.world, ridgeGround, 950, [-280, 460, -340, 210]);

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
    ridge.world.add(cloudBridge);

    for (const [cx, cz] of [[-246, -54.8], [-518, 94], [-790, -35]]) {
      const cy = tetonGround(cx, cz), g = new T.Group();
      g.position.set(cx, cy, cz); tetons.world.add(g);
      rock(g, rockMaterial, 0, .19, 0, .55, .37, .45, .5);
      addMesh(g, cylinder, metal, 0, 1.05, 0, .075, .42, .075);
      const r = addMesh(g, ringGeo, metal, 0, 1.45, 0, .30, .30, .30); r.rotation.y = .7;
    }
    for (const [cx, cz] of [[75, 8], [75, -88], [220, -45]]) {
      const cy = ridgeGround(cx, cz), g = new T.Group();
      g.position.set(cx, cy, cz); ridge.world.add(g);
      rock(g, rockMaterial, 0, .19, 0, .55, .37, .45, .5);
      addMesh(g, cylinder, metal, 0, 1.05, 0, .075, .42, .075);
      const r = addMesh(g, ringGeo, metal, 0, 1.45, 0, .30, .30, .30); r.rotation.y = .7;
    }

    const gate = new T.Group();
    gate.position.set(75, ridgeGround(75, -49), -49);
    ridge.world.add(gate);
    for (const side of [-1, 1]) {
      rock(gate, rockMaterial, side * 3.25, 1.58, 0, 1.23, 2.34, 1.4, .4);
      box(gate, iron, side * 2.65, 1.56, 0, .19, 3.38, .19);
    }

    // Survey cairns at the Silver Ford posts for landmarks
    for (const x of [-274, -367]) for (const z of [-60, -50]) {
      const y = tetonGround(x, z);
      box(tetons.world, dark, x, y + .46, z, .14, .94, .14);
      box(tetons.world, pale, x, y + .87, z, .185, .14, .184);
    }

    // Find dramatic high summits dynamically in Teton & Half Dome DEMs for instant Base-Jump launch!
    let bestTetonPeak = { x: -180, z: -260, y: tetonGround(-180, -260) };
    for (let x = -480; x <= 60; x += 28) {
      for (let z = -340; z <= 320; z += 28) {
        const y = tetonGround(x, z);
        if (y > bestTetonPeak.y && Math.hypot(x + 260, z + 30) > 130) bestTetonPeak = { x, z, y };
      }
    }
    let bestHalfDomePeak = { x: -260, z: -30, y: ridgeGround(-260, -30) };
    for (let x = -540; x <= -160; x += 20) {
      for (let z = -220; z <= 120; z += 20) {
        const y = ridgeGround(x, z);
        if (y >= 320 && y <= 540 && Math.hypot(x - 75, z + 15) < Math.hypot(bestHalfDomePeak.x - 75, bestHalfDomePeak.z + 15) + 80) {
          if (y > bestHalfDomePeak.y || bestHalfDomePeak.y < 300) bestHalfDomePeak = { x, z, y };
        }
      }
    }

    if (loaderMsg) loaderMsg.textContent = "Rigging 1940s Woody Wagon, Mistletoe Sawbuck & Donkey Glider…";
    return {
      tetons: tetons.world, ridge: ridge.world, tetonLight: tetons.light, ridgeLight: ridge.light,
      coatTextures, time, glass, sun,
      skyUniforms, waterUniforms, updateSkyBasis, renderReflection,
      tetonGround, ridgeGround, water: (x, z) => water.at(x, z), wet,
      fordPatch, bridgeMat, bridgeHeight, DECK_Y,
      bestTetonPeak, bestHalfDomePeak
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
    { z: 0, region: "tetons", look: 0, refl: .05, name: "Overlook Rim Shadow", swatch: "#080809", x: -45, pz: 1.4, desc: "West rail of Adams’s 1942 Overlook Deck plunging into the river bend." },
    { z: 1, region: "tetons", look: 1, refl: .11, name: "Upper Moraine Timber", swatch: "#15161a", x: -22, pz: -52, desc: "Shadowed lodgepole pines above the Snake River drop." },
    { z: 2, region: "ridge", look: 2, refl: .18, name: "Half Dome Cloud Notch", swatch: "#262328", x: 75, pz: 16, desc: "Yosemite granite notch & cloud span below Half Dome." },
    { z: 3, region: "tetons", look: 3, refl: .27, name: "Bluff Switchback Pines", swatch: "#393734", x: -48, pz: -168, desc: "Mid-bluff hairpin overlooking cottonwood gravel bars." },
    { z: 4, region: "tetons", look: 13, refl: .38, name: "Snake River Overlook", swatch: "#54524a", x: -20, pz: 1.4, desc: "Overlook Wellhead pump, Woody Wagon & Mistletoe facing the Cathedral Group." },
    { z: 5, region: "tetons", look: 5, refl: .50, name: "Juniper Sage Bench", swatch: "#76746b", x: -162, pz: -112, desc: "Open moraine shelf sweeping down toward the Snake River." },
    { z: 6, region: "tetons", look: 6, refl: .64, name: "The Silver Ford", swatch: "#96948a", x: -248, pz: -55, desc: "Glinting glacial cobble bar & Survey Posts across the Snake." },
    { z: 7, region: "tetons", look: 7, refl: .74, name: "Cottonwood Oxbow Kiosk", swatch: "#b5b2a6", x: -518, pz: 94, desc: "Upstream horseshoe bend, cassette kiosk awning & WiFi relay." },
    { z: 8, region: "tetons", look: 8, refl: .83, name: "Braided Bar Terrace", swatch: "#cfcbb9", x: -655, pz: 62, desc: "White river cobbles gleaming below the Teton foothills." },
    { z: 9, region: "ridge", look: 9, refl: .90, name: "East Granite Apron", swatch: "#e4e3d8", x: 185, pz: -38, desc: "Sweeping Yosemite granite bowl under Half Dome’s northwest face." },
    { z: 10, region: "tetons", look: 10, refl: .96, name: "Far-Bank Highland Pueblo", swatch: "#f6f4ec", x: -780, pz: -35, desc: "14-building Adobe Pueblo & Blue-Lit Sanctuary Steps facing the Grand Tetons." }
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

  const STORAGE_KEY = "make-photo-zones-v4";
  const urlMode = new URLSearchParams(location.search).get("mode");
  const initModeIdx = urlMode && MODES.some(m => m.id === urlMode) ? MODES.findIndex(m => m.id === urlMode) : 0;

  /* ---------- WebAudio ---------- */
  const audio = (() => {
    let ctx = null, master = null, enabled = false, analyser = null, freqData = null, tapeConnected = false;
    const clocks = [{ period: 1.0, acc: 0, ratio: 1.0, pan: -.45 }, { period: 1.37, acc: .35, ratio: 1.25, pan: 0 }, { period: 1.73, acc: .8, ratio: 1.5, pan: .45 }];
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = .5; master.connect(ctx.destination);
      }
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      return true;
    }
    function connectTape(el) {
      if (tapeConnected || !el || !ensure()) return;
      try {
        const src = ctx.createMediaElementSource(el);
        analyser = ctx.createAnalyser(); analyser.fftSize = 128; freqData = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser); analyser.connect(ctx.destination); tapeConnected = true;
      } catch {}
    }
    function sampleTape() {
      if (!analyser || !freqData) return { bass: 0, high: 0 };
      analyser.getByteFrequencyData(freqData);
      let b = 0, hi = 0;
      for (let i = 0; i < 6; i++) b += freqData[i];
      for (let i = 18; i < 36; i++) hi += freqData[i];
      return { bass: b / (6 * 255), high: hi / (18 * 255) };
    }
    function tone(freq, dur, vol, type = "triangle", pan = 0, force = false) {
      if ((!enabled && !force) || !ensure()) return;
      const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      o.type = type; o.frequency.setValueAtTime(freq, t0); o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * .96), t0 + dur);
      g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .012); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      if (p) { p.pan.value = pan; o.connect(g); g.connect(p); p.connect(master); } else { o.connect(g); g.connect(master); }
      o.start(t0); o.stop(t0 + dur + .02);
    }
    return {
      toggle() { enabled = !enabled; if (enabled) ensure(); return enabled; },
      isOn: () => enabled, connectTape, sampleTape,
      shutter() { tone(190, .06, .18, "square", 0, true); setTimeout(() => tone(840, .04, .09, "triangle", 0, true), 35); },
      pumpClank() { tone(138, .08, .22, "square", .1, true); setTimeout(() => tone(520, .14, .11, "sine", -.15, true), 60); setTimeout(() => tone(690, .18, .09, "sine", .15, true), 130); },
      relayChime(isP) { (isP ? [293.66, 392, 440, 587.33, 783.99] : [293.66, 440, 587.33]).forEach((f, idx) => setTimeout(() => tone(f, .42, .12, "triangle", (idx - 1) * .25, true), idx * 95)); },
      forestChime(g) { const b = 329.63 * Math.pow(1.06, g);[1, 1.25, 1.5, 2].forEach((m, idx) => setTimeout(() => tone(b * m, .48, .10, "sine", (idx - 1.5) * .22, true), idx * 75)); },
      glideWhoosh() { tone(140, .42, .16, "sine", 0, true); setTimeout(() => tone(290, .35, .11, "triangle", 0, true), 80); },
      step(leg, gait) { if (enabled) tone((gait > 1 ? 128 : 92) + leg * 11, .055, gait > 1 ? .08 : .045, "triangle", leg % 2 ? .28 : -.28); },
      tick(dt, zoneIdx) {
        if (!enabled) return;
        const baseFreq = 165 * Math.pow(2, zoneIdx * .07);
        for (const c of clocks) { c.acc += dt; if (c.acc >= c.period) { c.acc -= c.period; tone(baseFreq * c.ratio, .34, .06, zoneIdx < 3 ? "sine" : "triangle", c.pan); } }
      }
    };
  })();

  /* ---------- Renderer & Post-Processing Pipeline ---------- */
  const canvas = $("view");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  const phone = matchMedia("(pointer:coarse)").matches || Math.min(innerWidth, innerHeight) < 560;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.toneMapping = T.NoToneMapping;

  const NEAR = 0.35, FAR = 48000;
  const camera = new T.PerspectiveCamera(47, 1, NEAR, FAR);

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
    loft(body, coach, [[-2.6, .91, .045, .026], [-2.46, 1.04, .43, .22], [-2.14, 1.14, .58, .215], [-1.65, 1.22, .62, .214],
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
    billet(body, nickel, 0, .467, -2.59, 1.77, .121, .17);
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
      uInvProjView: { value: new T.Matrix4() },
      uWifi: { value: Array.from({ length: 8 }, () => new T.Vector4(0, 0, 0, 0)) },
      uWifiPing: { value: 0.0 }
    },
    vertexShader: VS,
    fragmentShader: `
      uniform sampler2D tScene, tDepth, tTrail, tFilm;
      uniform vec2 uRes;
      uniform float uT, uNear, uFar, uFocusDist, uDofOctaves, uTilt, uStrataLock, uFocusPulse, uJerikanFilter, uAudioBass, uAudioHigh, uWifiPing;
      uniform int uRouteMode, uSoloLook, uFocusLook;
      uniform vec3 uFilter;
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
          float spk = smoothstep(0.992, 1.0, h(floor(px / 2.2) + floor(uT * 6.0) * 3.1));
          vec3 em = mix(raw * 0.35, tr, 0.65) * smoothstep(0.14, 0.85, l);
          col = mix(silverBase * 0.48, em * vec3(1.12, 0.68, 0.34) + spk * vec3(1.0, 0.75, 0.4), 0.72);
        } else if (mode == 1) {
          float rows = 320.0;
          vec2 g = vec2(uv.x, (floor(uv.y * rows) + 0.5) / rows);
          float ls = lum(texture2D(tScene, clamp(g, 0.0, 1.0)).rgb);
          float line = 0.80 + 0.20 * sin(uv.y * rows * 6.2832);
          float sweep = smoothstep(0.05, 0.0, abs(fract(uv.y - uT * 0.11) - 0.5) - 0.45) * 0.12;
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
          float flutter = step(0.992, h(vec2(floor(uv.y * 190.0), floor(uT * 11.0)))) * uAudioHigh * 0.22;
          return silverBase * (0.95 + 0.05 * vg) + vec3(0.16, 0.72, 1.0) * flutter;
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
          float rad = uWifi[i].w;
          if (rad > 0.5) {
            float dw = length(wPos.xz - uWifi[i].xz);
            float f = smoothstep(rad, rad * 0.14, dw) * isGeo;
            wifiField = max(wifiField, f);
            float bnd = smoothstep(1.8, 0.0, abs(dw - rad)) * isGeo;
            wifiEdge = max(wifiEdge, bnd);
            float ringW = sin(dw * 0.72 - uT * 4.4);
            wifiWave = max(wifiWave, f * smoothstep(0.92, 0.99, ringW));
          }
        }
        wifiField = clamp(wifiField * (1.0 + 0.35 * uWifiPing), 0.0, 1.0);

        vec3 raw = texture2D(tScene, uv).rgb;
        float rawL = clamp(dot(raw, vec3(0.299, 0.587, 0.114)), 0.0, 1.0);
        float l = lum(raw);

        float rawX = dot(texture2D(tScene, uv + vec2(1.2, 0.0) * e).rgb, vec3(0.30, 0.59, 0.11))
                   - dot(texture2D(tScene, uv - vec2(1.2, 0.0) * e).rgb, vec3(0.30, 0.59, 0.11));
        float rawY = dot(texture2D(tScene, uv + vec2(0.0, 1.2) * e).rgb, vec3(0.30, 0.59, 0.11))
                   - dot(texture2D(tScene, uv - vec2(0.0, 1.2) * e).rgb, vec3(0.30, 0.59, 0.11));
        float ed = length(vec2(rawX, rawY)) * 2.5;
        // Preserve authentic MONOLITH-3 silver-gelatin tonal scale instead of washing out distant Tetons
        vec3 silverBase = raw;
        vec3 tr = texture2D(tTrail, uv).rgb;
        float vg = smoothstep(1.36, 0.34, length((uv - 0.5) * vec2(1.10, 1.0)) * 1.48);

        float zoneEff = clamp(l + wifiField * 0.25, 0.0, 1.0);
        vec3 outCol;
        if (uSoloLook >= 0) {
          outCol = evalLook(uSoloLook, uv, raw, silverBase, tr, zoneEff, ed, vg);
        } else if (uRouteMode == 0) {
          vec3 jk = evalLook(13, uv, raw, silverBase, tr, l, ed, vg);
          vec3 fLook = evalLook(uFocusLook, uv, raw, silverBase, tr, zoneEff, ed, vg);
          float focalBand = 1.0 - smoothstep(0.45, 1.15, abs(coc));
          outCol = mix(jk, fLook, focalBand * 0.35);
          float heroCut = smoothstep(2.4, 6.0, length(wPos.xz - uWifi[0].xz));
          vec3 wifiWorld = mix(evalLook(9, uv, raw, silverBase, tr, zoneEff, ed, vg),
                               evalLook(10, uv, raw, silverBase, tr, zoneEff, ed, vg),
                               smoothstep(0.05, 0.25, ed) + 0.30 * sin(wPos.y * 0.25 + uT));
          outCol = mix(outCol, mix(wifiWorld, vec3(0.04, 0.58, 0.98) * (0.45 + 0.72 * rawL), 0.28), wifiField * 0.74 * heroCut);
          float cyanWave = smoothstep(0.16, 0.0, abs(abs(coc) - 0.86)) * (0.10 + 0.72 * uFocusPulse);
          outCol = mix(outCol, vec3(0.06, 0.78, 1.0), clamp(cyanWave * 0.50 + wifiWave * 0.45 * heroCut + wifiEdge * 0.86, 0.0, 0.92));
        } else if (uRouteMode == 1) {
          float zBand = clamp(zoneEff * 10.0 + coc * 2.1 + wifiField * 2.2, 0.0, 10.0);
          vec3 strataCol = evalByFloat(zBand, uv, raw, silverBase, tr, zoneEff, ed, vg);
          vec3 focalCol = evalLook(uFocusLook, uv, raw, silverBase, tr, zoneEff, ed, vg);
          float sharp = 1.0 - smoothstep(0.45, 1.15, abs(coc));
          outCol = mix(strataCol, focalCol, sharp * (1.0 - uStrataLock));
          outCol = mix(outCol, vec3(0.06, 0.80, 1.0), clamp(wifiWave * 0.42 + wifiEdge * 0.80, 0.0, 0.88));
        } else if (uRouteMode == 2) {
          float shellZ = clamp(5.0 + coc * 2.4 + wifiField * 2.0, 0.0, 10.0);
          outCol = evalByFloat(shellZ, uv, raw, silverBase, tr, zoneEff, ed, vg);
          float bound = smoothstep(0.09, 0.0, abs(fract(shellZ + 0.5) - 0.5)) * (0.14 + 0.45 * uFocusPulse);
          outCol = mix(outCol, vec3(0.10, 0.80, 1.0), clamp(bound + wifiWave * 0.42 + wifiEdge * 0.78, 0.0, 0.9));
        } else {
          outCol = evalByFloat(zoneEff * 10.0 + wifiField * 2.4, uv, raw, silverBase, tr, zoneEff, ed, vg);
          outCol = mix(outCol, vec3(0.08, 0.78, 1.0), clamp(wifiWave * 0.42 + wifiEdge * 0.78, 0.0, 0.88));
        }

        if (uJerikanFilter > 0.5 || uRouteMode == 0 || uSoloLook == 13) {
          float maxRG = max(raw.r, raw.g);
          float blueDom = (raw.b - maxRG) / max(raw.b, 0.035);
          float cyanMask = smoothstep(0.18, 0.46, blueDom) * smoothstep(0.03, 0.10, raw.b);
          float cyanShade = clamp(0.48 + 0.82 * raw.b - raw.r * 0.15, 0.44, 1.30);
          vec3 cyanGlow = mix(vec3(0.0, 0.50, 0.96), vec3(0.32, 0.92, 1.0), smoothstep(0.16, 0.86, raw.b)) * cyanShade * (0.95 + 0.24 * uAudioBass);
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
      donkeyOnRoof: false,
      roofMountT: 0,
      roofJumpStart: new T.Vector3(),
      gliding: false,
      glideOpen: 0,
      glide: { x: -48, y: 162, z: 1.35, heading: -Math.PI * .45, vx: 0, vy: 0, vz: 0, speed: 24, bank: 0, time: 0 },
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
      antennaElev: 158.0,
      relElev: 92.5,
      signalRadius: 120.0,
      pingTimer: 0,
      signalDbm: -34,
      frameWifiPct: 50,
      litRelays: 1,
      coveragePct: 20,
      unlockedGroves: 1,
      unlockedTrees: 4,
      meteredZone: 4,
      currentZone: 4,
      plates: [],
      chaseCamPos: new T.Vector3(-11, 160, 4),
      chaseLookAt: new T.Vector3(-36, 156, 1.35)
    };
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && Array.isArray(saved.plates)) state.plates = saved.plates;
    } catch {}

    function groundAt(x, z, rgn = state.region) {
      return rgn === "ridge" ? mw.ridgeGround(x, z) : mw.tetonGround(x, z);
    }

    function driveSurfaceAt(x, z, rgn = state.region) {
      if (rgn === "ridge") {
        const g = mw.ridgeGround(x, z);
        if (x >= 70.2 && x <= 79.8 && z >= -34.2 && z <= 5.5) return Math.max(g, mw.bridgeHeight(x, z));
        return g;
      }
      const g = mw.tetonGround(x, z);
      // Snake River Overlook Deck & East Ramp
      if (x >= -48.6 && x <= -24.7 && z >= -2.7 && z <= 5.4) return Math.max(g, mw.DECK_Y);
      if (x > -24.7 && x <= -19.2 && z >= -2.7 && z <= 5.4) {
        const t = (x - (-24.7)) / 5.5;
        return Math.max(g, lerp(mw.DECK_Y, g, smooth(0, 1, t)));
      }
      // Smooth River-Skimming Surface across Snake River channels (Collisions OFF!)
      if (mw.wet(x, z) > -0.5) return Math.max(g, mw.water(x, z) - 0.08);
      return g;
    }

    function activeWorld() { return state.region === "ridge" ? mw.ridge : mw.tetons; }

    /* Shared Dynamic Actors Group re-parented between Grand Teton and Half Dome scenes */
    const actorRoot = new T.Group();
    mw.tetons.add(actorRoot);
    const hemiFill = new T.HemisphereLight(0xf6f4ee, 0x3b3c39, .55);
    actorRoot.add(hemiFill);

    function setRegion(next) {
      if (next === state.region) return;
      state.region = next;
      activeWorld().add(actorRoot);
      const btn = $("btn-region");
      if (btn) {
        btn.setAttribute("aria-pressed", String(next === "ridge"));
        btn.textContent = next === "ridge" ? "Half Dome → Tetons (R)" : "Tetons ↔ Half Dome (R)";
      }
    }

    /* Wagon + Mistletoe + Sawbuck Pack + Donkey Base-Jump Glider Wing */
    const wagon = buildWagon();
    actorRoot.add(wagon.group);
    wagon.x = -23.0; wagon.z = 4.6;
    wagon.y = driveSurfaceAt(wagon.x, wagon.z, "tetons");
    wagon.heading = -Math.PI * .52;
    wagon.group.position.set(wagon.x, wagon.y, wagon.z);
    wagon.group.rotation.y = wagon.heading;

    const donkey = window.makeDonkey({
      assetPath: "../donkey/",
      textures: mw.coatTextures,
      shells: phone ? 6 : 11,
      monochrome: true,
      contactShadow: true,
      alwaysHalter: true
    });
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
    for (const sgn of [-1, 1]) {
      addPackBar(donkeyRig, [sgn * .21, 1.14, -.21], [sgn * .21, 1.14, .29], .015, sawWoodMat);
      const jc = makeJerikan(1.0);
      jc.position.set(sgn * .305, .86, .04); jc.rotation.y = sgn * Math.PI * .5; jc.rotation.z = sgn * .12;
      donkeyRig.add(jc);
      const cb1 = new T.Mesh(new T.BoxGeometry(.024, .34, .036), leatherMat); cb1.position.set(sgn * .29, 1.04, -.04); cb1.rotation.z = sgn * .12; donkeyRig.add(cb1);
      const cb2 = new T.Mesh(new T.BoxGeometry(.024, .34, .036), leatherMat); cb2.position.set(sgn * .29, 1.04, .12); cb2.rotation.z = sgn * .12; donkeyRig.add(cb2);
      const cn = new T.Mesh(new T.BoxGeometry(.25, .036, .045), leatherMat); cn.position.set(sgn * .32, 1.01, .04); cn.rotation.z = sgn * .12; donkeyRig.add(cn);
      const bk = new T.Mesh(new T.BoxGeometry(.032, .052, .056), brassMat); bk.position.set(sgn * .40, 1.01, .04); donkeyRig.add(bk);
      const hPts = [new T.Vector3(sgn * .31, 1.24, .11), new T.Vector3(sgn * .20, 1.34, .09), new T.Vector3(sgn * .09, 1.30, .06)];
      donkeyRig.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(hPts), 10, .013, 6, false), beaconCyanMat));
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

    /* ---------- Sculpted Electric-Cyan & Sprocket Film Rogallo Glider Wing + Contrails ---------- */
    const donkeyGlider = new T.Group();
    donkeyGlider.position.set(0, 1.35, .06);
    donkeyGlider.visible = false;
    donkeyRig.add(donkeyGlider);
    const sailDarkMat = new T.MeshStandardMaterial({ color: 0x16181c, roughness: .6, side: T.DoubleSide });
    const sailFilmMat = new T.MeshStandardMaterial({ map: forestFilmTex, color: 0x006eff, emissive: 0x0044c4, emissiveIntensity: .9, roughness: .35, side: T.DoubleSide });
    const wingCellCount = 7, span = 5.2, halfSpan = span * .5;
    for (let c = 0; c < wingCellCount; c++) {
      const u0 = -1 + (c / wingCellCount) * 2, u1 = -1 + ((c + 1) / wingCellCount) * 2;
      const x0 = u0 * halfSpan, x1 = u1 * halfSpan, xm = (x0 + x1) * .5;
      const archY0 = 1.48 - u0 * u0 * .34, archY1 = 1.48 - u1 * u1 * .34;
      const sweepZ0 = -Math.abs(u0) * .72, sweepZ1 = -Math.abs(u1) * .72;
      const chord0 = 1.68 * (1 - Math.abs(u0) * .36), chord1 = 1.68 * (1 - Math.abs(u1) * .36);
      const verts = new Float32Array([
        x0, archY0, .75 + sweepZ0,
        x1, archY1, .75 + sweepZ1,
        x0, archY0 - .05, .75 + sweepZ0 - chord0,
        x1, archY1 - .05, .75 + sweepZ1 - chord1
      ]);
      const uvs = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.BufferAttribute(verts, 3));
      g.setAttribute("uv", new T.BufferAttribute(uvs, 2));
      g.setIndex([0, 1, 2, 1, 3, 2]);
      g.computeVertexNormals();
      const mat = c === 3 ? sailFilmMat : (c % 2 === 0 ? beaconCyanMat.clone() : sailDarkMat);
      mat.side = T.DoubleSide;
      donkeyGlider.add(new T.Mesh(g, mat));
      addPackBar(donkeyGlider, [xm, (archY0 + archY1) * .5 - .04, .18 + (sweepZ0 + sweepZ1) * .35], [c > 3 ? .18 : c < 3 ? -.18 : 0, .02, 0], .006, brassMat);
    }
    addPackBar(donkeyGlider, [-halfSpan, 1.14, .03], [0, 1.48, .75], .024, sawWoodMat);
    addPackBar(donkeyGlider, [halfSpan, 1.14, .03], [0, 1.48, .75], .024, sawWoodMat);
    addPackBar(donkeyGlider, [-halfSpan * .74, 1.24, .12], [halfSpan * .74, 1.24, .12], .020, sawWoodMat);
    addPackBar(donkeyGlider, [0, 1.48, .75], [0, 1.38, -.92], .022, sawWoodMat);
    const wingTipL = new T.Object3D(), wingTipR = new T.Object3D();
    wingTipL.position.set(-halfSpan, 1.12, -.12);
    wingTipR.position.set(halfSpan, 1.12, -.12);
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

    /* Region-Specific Props: Overlook Wellhead, Kiosk Awning, Highland Pueblo, 5 Cistern Relays, 8 Filmstrip Forest Groves & 3 Summit Launch Decks */
    const tetonProps = new T.Group(), ridgeProps = new T.Group();
    mw.tetons.add(tetonProps);
    mw.ridge.add(ridgeProps);

    const midRockMat = new T.MeshStandardMaterial({ color: 0x6c6b64, roughness: .88 });
    const dryWaterMat = new T.MeshStandardMaterial({ color: 0x2a2926, roughness: .95 });
    const relayRingMat = new T.LineBasicMaterial({ color: 0x0080ff, transparent: true, opacity: .86 });

    // 1) Cast-Iron Wellhead Pump & Cyan Washbasin at Snake River Overlook (-22.2, -3.8)
    const well = (() => {
      const wx = -22.2, wz = -3.8, wy = mw.tetonGround(wx, wz);
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
      tetonProps.add(g);
      return { x: wx, z: wz, y: wy, leverPivot, stream, pool: cyanPool };
    })();

    // 2) Far-Bank Highland Pueblo Plaza + Kiosk Awning + Blue-Lit Sanctuary Steps facing the Grand Tetons
    const puebloDarkWinMat = new T.MeshStandardMaterial({ color: 0x101214, emissive: 0x001018, emissiveIntensity: .2 });
    const puebloGlowWinMat = new T.MeshStandardMaterial({ color: 0x006eff, emissive: 0x0048dd, emissiveIntensity: 1.35, roughness: .2 });
    const puebloWinMeshes = [], puebloDishes = [];
    (() => {
      const adobe1 = new T.MeshStandardMaterial({ color: 0x9b9689, roughness: .92 });
      const adobe2 = new T.MeshStandardMaterial({ color: 0x7b776c, roughness: .94 });
      const vigaWood = new T.MeshStandardMaterial({ color: 0x3b3328, roughness: .88 });
      const PuebloHouses = [
        [-770, -20, 5.2, 3.8, 4.6, .35, true], [-768, -42, 4.8, 3.4, 4.2, -.2, false], [-782, -16, 5.8, 4.2, 4.8, .12, true],
        [-796, -24, 6.2, 4.8, 5.2, -.45, true], [-798, -44, 5.4, 3.9, 4.6, .55, false], [-784, -48, 4.9, 3.3, 4.4, -.12, true],
        [-764, -32, 4.6, 3.2, 4.2, .7, false], [-804, -35, 5.5, 4.0, 4.5, .25, false], [-792, -56, 5.1, 4.3, 4.6, .18, true],
        [-772, -52, 4.4, 3.1, 4.0, -.42, false], [-808, -22, 5.6, 4.5, 4.8, .62, true], [-776, -12, 4.8, 3.4, 4.2, -.15, false],
        [-790, -10, 4.7, 3.6, 4.1, .31, false], [-775, -60, 5.0, 3.8, 4.3, -.55, true]
      ];
      for (const [hx, hz, w, h, d, ry, twoStory] of PuebloHouses) {
        const hy = mw.tetonGround(hx, hz);
        const grp = new T.Group(); grp.position.set(hx, hy, hz); grp.rotation.y = ry;
        const body = new T.Mesh(new T.BoxGeometry(w, h, d), twoStory ? adobe1 : adobe2);
        body.position.y = h * .5 - .2; grp.add(body);
        for (let i = -1; i <= 1; i++) {
          const vig = new T.Mesh(new T.CylinderGeometry(.09, .09, d + .9, 6), vigaWood);
          vig.rotation.x = Math.PI / 2; vig.position.set(i * w * .28, h - .65, 0); grp.add(vig);
        }
        if (twoStory) {
          const top = new T.Mesh(new T.BoxGeometry(w * .62, h * .68, d * .64), adobe2);
          top.position.set(-.3, h + h * .34 - .25, .2); grp.add(top);
          const pole = new T.Mesh(new T.CylinderGeometry(.04, .05, 1.4, 6), antennaMat);
          pole.position.set(.4, h + h * .68 + .4, -.3); grp.add(pole);
          const orb = new T.Mesh(new T.SphereGeometry(.14, 10, 8), puebloDarkWinMat);
          orb.position.set(.4, h + h * .68 + 1.15, -.3); grp.add(orb);
          puebloDishes.push(orb);
        }
        for (const sgn of [-1, 1]) {
          const win = new T.Mesh(new T.BoxGeometry(.78, .92, .12), puebloDarkWinMat);
          win.position.set(sgn * w * .24, h * .48, d * .5 + .03); grp.add(win); puebloWinMeshes.push(win);
        }
        const door = new T.Mesh(new T.BoxGeometry(1.1, 1.9, .14), puebloDarkWinMat);
        door.position.set(0, .95, d * .5 + .03); grp.add(door); puebloWinMeshes.push(door);
        tetonProps.add(grp);
      }

      // Sanctuary Steps & Blue-Lit Door on Far-Bank Terrace
      const sx = -812, sz = -34, sy = mw.tetonGround(sx, sz);
      const dg = new T.Group(); dg.position.set(sx, sy, sz); dg.rotation.y = Math.PI * .5;
      const stMat = new T.MeshStandardMaterial({ color: 0x3b3b3c, roughness: .92 });
      for (let i = 0; i < 8; i++) {
        const st = new T.Mesh(new T.BoxGeometry(3.4, .28, .75), stMat); st.position.set(0, .14 + i * .26, 3.6 - i * .58); dg.add(st);
      }
      const lintel = new T.Mesh(new T.BoxGeometry(4.2, .9, 1.4), stMat); lintel.position.set(0, 5.4, -.5); dg.add(lintel);
      for (const s of [-1.7, 1.7]) { const c = new T.Mesh(new T.BoxGeometry(.85, 5.2, 1.3), stMat); c.position.set(s, 2.6, -.5); dg.add(c); }
      const bdoor = new T.Mesh(new T.BoxGeometry(2.5, 4.4, .28), beaconCyanMat); bdoor.position.set(0, 2.5, -.5); dg.add(bdoor);
      tetonProps.add(dg);

      // Kiosk Awning at Cottonwood Oxbow (-514, 90)
      const kx = -514, kz = 90, ky = mw.tetonGround(kx, kz);
      const kg = new T.Group(); kg.position.set(kx, ky, kz); kg.rotation.y = 1.1;
      const stall = new T.Mesh(new T.BoxGeometry(3.8, 2.4, 2.4), adobe2); stall.position.y = 1.15; kg.add(stall);
      const awning = new T.Mesh(new T.BoxGeometry(4.4, .12, 2.9), adobe1); awning.position.set(0, 2.52, .85); awning.rotation.x = .24; kg.add(awning);
      const deck = new T.Mesh(new T.BoxGeometry(1.0, .34, .45), beaconCyanMat); deck.position.set(0, 1.22, 1.18); kg.add(deck);
      for (const [cx, cz, ry] of [[-1.5, 1.4, .2], [1.4, 1.3, -.4]]) {
        const cj = makeJerikan(.92); cj.position.set(cx, 0, cz); cj.rotation.y = ry; kg.add(cj);
      }
      tetonProps.add(kg);
    })();

    // 3) 5 Cistern Relays across Grand Teton (Wellhead -> Switchback -> Silver Ford -> Oxbow -> Far-Bank Pueblo)
    function makeTerrainRing(radius, segs, mat, parentGrp) {
      const pts = new Float32Array((segs + 1) * 3);
      const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(pts, 3));
      const line = new T.Line(geo, mat); line.frustumCulled = false; parentGrp.add(line);
      return { line, pts, segs, radius };
    }
    function updateTerrainRing(ring, cx, cz, rgn, yOff = .28) {
      const { pts, segs, radius } = ring;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * TAU, x = cx + Math.cos(a) * radius, z = cz + Math.sin(a) * radius;
        pts[i * 3] = x; pts[i * 3 + 1] = driveSurfaceAt(x, z, rgn) + yOff; pts[i * 3 + 2] = z;
      }
      ring.line.geometry.attributes.position.needsUpdate = true;
    }

    const relayDefs = [
      { id: "wellhead", region: "tetons", name: "Overlook Wellhead", x: -22.2, z: -3.8, lit: true },
      { id: "switchback", region: "tetons", name: "Moraine Switchback Cistern", x: -48, z: -168, lit: false },
      { id: "ford", region: "tetons", name: "Silver Ford Relay", x: -248, z: -55, lit: false },
      { id: "oxbow", region: "tetons", name: "Cottonwood Oxbow Kiosk", x: -518, z: 94, lit: false },
      { id: "pueblo", region: "tetons", name: "Highland Pueblo Plaza", x: -780, z: -35, lit: false }
    ];
    const relays = [];
    for (let i = 0; i < relayDefs.length; i++) {
      const d = relayDefs[i], gy = driveSurfaceAt(d.x, d.z, d.region);
      const grp = new T.Group(); grp.position.set(d.x, gy, d.z);
      let poolMesh = null, beaconRing = null, arcLine = null, covRing = null;
      if (i > 0) {
        const wall = new T.Mesh(new T.CylinderGeometry(1.55, 1.75, .56, 20, 1, true), midRockMat); wall.position.y = .26; grp.add(wall);
        const base = new T.Mesh(new T.CircleGeometry(1.55, 20), dryWaterMat); base.rotation.x = -Math.PI / 2; base.position.y = .04; grp.add(base);
        poolMesh = new T.Mesh(new T.CircleGeometry(1.48, 22), d.lit ? cyanWaterMat : dryWaterMat); poolMesh.rotation.x = -Math.PI / 2; poolMesh.position.y = .40; grp.add(poolMesh);
        const mast = new T.Mesh(new T.CylinderGeometry(.05, .07, 4.2, 8), antennaMat); mast.position.set(1.6, 2.0, 0); grp.add(mast);
        beaconRing = new T.Mesh(new T.TorusGeometry(.52, .065, 8, 24), d.lit ? beaconCyanMat : dryWaterMat);
        beaconRing.rotation.x = Math.PI / 2; beaconRing.position.set(1.6, 4.1, 0); grp.add(beaconRing);
      }
      tetonProps.add(grp);
      covRing = makeTerrainRing(28, 48, relayRingMat, tetonProps);
      updateTerrainRing(covRing, d.x, d.z, "tetons", .25);
      covRing.line.visible = d.lit;
      if (i > 0) {
        const prev = relayDefs[i - 1], py = driveSurfaceAt(prev.x, prev.z, "tetons");
        const curve = new T.CatmullRomCurve3([
          new T.Vector3(prev.x, py + 4.2, prev.z),
          new T.Vector3((prev.x + d.x) * .5, Math.max(py, gy) + 26, (prev.z + d.z) * .5),
          new T.Vector3(d.x, gy + 4.2, d.z)
        ]);
        arcLine = new T.Mesh(new T.TubeGeometry(curve, 24, .18, 6, false), beaconCyanMat);
        arcLine.visible = d.lit; tetonProps.add(arcLine);
      }
      relays.push({ ...d, y: gy, group: grp, poolMesh, beaconRing, covRing, arcLine });
    }

    // 4) 8 Elevation-Gated Filmstrip Forest Groves across Grand Teton (6) & Yosemite Half Dome (2)
    const forestGroveDefs = [
      { id: 0, region: "tetons", name: "Overlook Rim Sprocket Stand", x: -34, z: -26, minRelAlt: 15, trees: 4, unlocked: true },
      { id: 1, region: "tetons", name: "Bluff Switchback Celluloid Grove", x: -64, z: -146, minRelAlt: 42, trees: 5, unlocked: false },
      { id: 2, region: "tetons", name: "Moraine Bench Ribbon Wood", x: -150, z: -84, minRelAlt: 68, trees: 4, unlocked: false },
      { id: 3, region: "tetons", name: "Silver Ford Island Canopy", x: -240, z: -32, minRelAlt: 88, trees: 5, unlocked: false },
      { id: 4, region: "tetons", name: "Cottonwood Oxbow Film Forest", x: -494, z: 76, minRelAlt: 102, trees: 5, unlocked: false },
      { id: 5, region: "tetons", name: "Cathedral Pueblo High Wood", x: -754, z: -18, minRelAlt: 118, trees: 5, unlocked: false },
      { id: 6, region: "ridge", name: "Half Dome Cloud Notch Stand", x: 60, z: -12, minRelAlt: 24, trees: 4, unlocked: false },
      { id: 7, region: "ridge", name: "Half Dome East Apron Forest", x: 185, z: -36, minRelAlt: 85, trees: 4, unlocked: false }
    ];
    const forestTreeGeo = new T.PlaneGeometry(3.2, 18.5, 2, 10);
    forestTreeGeo.translate(0, 9.25, 0);
    const forestGroves = [];
    for (let gIdx = 0; gIdx < forestGroveDefs.length; gIdx++) {
      const def = forestGroveDefs[gIdx], gy = groundAt(def.x, def.z, def.region);
      const dormantMat = new T.MeshStandardMaterial({ map: filmTex, color: 0x3b3e42, emissive: 0x050910, roughness: .65, side: T.DoubleSide });
      const awakeMat = new T.MeshStandardMaterial({ map: forestFilmTex, color: 0x8cc8ff, emissive: 0x0044b8, emissiveIntensity: .92, roughness: .32, side: T.DoubleSide });
      const grp = new T.Group(); grp.position.set(def.x, gy, def.z);
      const meshes = [], tips = [];
      for (let t = 0; t < def.trees; t++) {
        const a = (t / def.trees) * TAU + gIdx * .55, r = 2.0 + (t % 2) * 2.6;
        const m = new T.Mesh(forestTreeGeo, def.unlocked ? awakeMat : dormantMat);
        m.position.set(Math.cos(a) * r, -.15, Math.sin(a) * r);
        m.rotation.y = a + .6 + t * .3;
        m.scale.set(1, def.unlocked ? 1.0 : .18, 1);
        grp.add(m);
        meshes.push({ mesh: m, phase: t * 1.1 + gIdx * .7, targetH: .95 + (t % 3) * .22 });
        const orb = new T.Mesh(new T.OctahedronGeometry(.36, 0), def.unlocked ? beaconCyanMat : strapMat);
        orb.position.set(Math.cos(a) * r, (def.unlocked ? 1.0 : .18) * 18.5 + .45, Math.sin(a) * r);
        grp.add(orb); tips.push(orb);
      }
      (def.region === "ridge" ? ridgeProps : tetonProps).add(grp);
      forestGroves.push({ ...def, y: gy, grow: def.unlocked ? 1.0 : .18, grp, meshes, tips, dormantMat, awakeMat });
    }

    // 5) 3 Summit Base-Jump Launch Decks (with Cyan Timber Jump Ramps in 3D!)
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
        heading: Math.atan2(75 - mw.bestHalfDomePeak.x, 8 - mw.bestHalfDomePeak.z),
        note: "High Sierra granite shoulder gliding over the Half Dome Cloud Bridge."
      }
    ];
    for (const sm of SUMMITS) {
      const sy = driveSurfaceAt(sm.x, sm.z, sm.region);
      const pad = new T.Group(); pad.position.set(sm.x, sy, sm.z); pad.rotation.y = sm.heading;
      const deck = new T.Mesh(new T.BoxGeometry(3.2, .25, 6.2), sawWoodMat); deck.position.set(0, .2, 1.5); deck.rotation.x = -.14; pad.add(deck);
      for (const sx of [-1.45, 1.45]) {
        const b = new T.Mesh(new T.CylinderGeometry(.05, .05, 1.8, 8), antennaMat); b.position.set(sx, 1.0, 4.2); pad.add(b);
        const orb = new T.Mesh(new T.SphereGeometry(.14, 10, 8), beaconCyanMat); orb.position.set(sx, 1.95, 4.2); pad.add(orb);
      }
      (sm.region === "ridge" ? ridgeProps : tetonProps).add(pad);
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
    const rainMesh = new T.LineSegments(rainGeo, new T.LineBasicMaterial({ color: 0x006eff, transparent: true, opacity: .86 }));
    rainMesh.frustumCulled = false;
    actorRoot.add(rainMesh);

    const activeEmitters = [];
    function sampleWifiEmitters() {
      activeEmitters.length = 0;
      activeEmitters.push({ x: donkey.state.x, z: donkey.state.z, y: donkey.group.position.y + 2.2, r: state.signalRadius });
      for (const r of relays) if (r.lit && r.region === state.region) activeEmitters.push({ x: r.x, z: r.z, y: r.y + 2.5, r: r.id === "pueblo" ? 38 : 28 });
      for (const g of forestGroves) if (g.unlocked && g.region === state.region) activeEmitters.push({ x: g.x, z: g.z, y: g.y + 8.0, r: 24 * g.grow });
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
      const useDonkey = emitters.length <= 1 || Math.random() < .72;
      const em = useDonkey ? emitters[0] : emitters[1 + Math.floor(Math.random() * (emitters.length - 1))];
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

    donkey.place(-26.0, -1.2, -Math.PI * .45, (x, z) => driveSurfaceAt(x, z, "tetons"));
    donkey.update(.016, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, (x, z) => driveSurfaceAt(x, z, "tetons"));
    donkey.state.onStep = (leg, gait) => audio.step(leg, gait);
    state.y = driveSurfaceAt(state.x, state.z) + 1.68;

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

    function toast(msg) {
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

    function updateHUD() {
      const m = MODES[state.modeIdx], st = STOPS[state.stopIdx], fl = FILTERS[state.filterIdx], Z = ZONES[state.currentZone];
      const activeLook = state.soloLook >= 0 ? LOOKS[state.soloLook] : LOOKS[state.focusLook];
      const rTag = state.region === "ridge" ? "YOSEMITE HALF DOME" : "GRAND TETON";
      $("zone-title").textContent = `Zone ${ROMAN[Z.z]} · ${Z.name}`;
      const veh = state.gliding ? `GLIDE ${Math.round(state.glide.speed)} m/s (${state.glide.vy >= 0 ? "+" : ""}${state.glide.vy.toFixed(1)} vy) · `
                : state.drivingCart ? `CRUISER WAGON ${Math.abs(wagon.speed).toFixed(1)} m/s (ROOF BURRO) · ` : "";
      $("hud-sub").textContent = `${rTag} · ${veh}${m.label} · FOCUS ${state.focusDist.toFixed(1)} m · ${fl.name}`;
      $("focus-dist-val").textContent = `${state.focusDist.toFixed(1)} m`;
      $("focus-look-val").textContent = state.soloLook >= 0 ? `SOLO · ${activeLook.name}` : `FOCUS · ${activeLook.name}`;
      $("wedge-caption").textContent = `${rTag} · Meter Z-${ROMAN[state.meteredZone]} · WiFi ${state.frameWifiPct}% · Alt ${fmtElev(state.antennaElev)} · Forest ${state.unlockedGroves}/${forestGroves.length}`;
      $("ppc-wifi").textContent = `(((•))) ${state.signalDbm} dBm · FRAME ${state.frameWifiPct}% · ALT ${fmtElev(state.antennaElev)} · FOREST ${state.unlockedGroves}/${forestGroves.length}`;
      if ($("finder-pct")) $("finder-pct").textContent = `IN-FRAME WIFI ${state.frameWifiPct}%`;
      if ($("finder-alt")) $("finder-alt").textContent = `ALT ${fmtElev(state.antennaElev)} · FOREST ${state.unlockedGroves}/${forestGroves.length}`;
      if ($("finder-bar")) $("finder-bar").style.width = `${clamp(state.frameWifiPct, 4, 100)}%`;
      if ($("cam-frame-tag")) $("cam-frame-tag").textContent = `8×10 WIFI SURVEY · ${state.frameWifiPct}% IN FRAME · ALT ${fmtElev(state.antennaElev)}`;

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
      if ($("btn-glide")) {
        $("btn-glide").setAttribute("aria-pressed", String(state.gliding));
        $("btn-glide").textContent = state.gliding ? "Fold Wing (J)" : "Base Jump / Glide (J)";
      }
      $("btn-ride").setAttribute("aria-pressed", String(state.riding));
      $("btn-jerikan").setAttribute("aria-pressed", String(fl.jerikan === 1));
      $("btn-ppc").setAttribute("aria-pressed", String(state.ppcOn));
      $("ppc-hud").hidden = !state.ppcOn;

      const swans = wedgeEl.querySelectorAll(".swatch"), capSet = new Set(state.plates.map(p => p.zone));
      swans.forEach((b, idx) => { b.classList.toggle("active", idx === state.meteredZone); b.classList.toggle("captured", capSet.has(idx)); });
      updateFocusKnobVisual();

      const u = lookMat.uniforms;
      u.uFocusDist.value = state.focusDist; u.uDofOctaves.value = st.oct; u.uTilt.value = state.tilt;
      u.uStrataLock.value = st.lock; u.uRouteMode.value = state.modeIdx; u.uSoloLook.value = state.soloLook;
      u.uFocusLook.value = state.focusLook; u.uFilter.value.set(fl.rgb[0], fl.rgb[1], fl.rgb[2]);
      u.uJerikanFilter.value = fl.jerikan;
    }

    function renderTray() {
      const tray = $("rack-tray"), tab = state.trayTab;
      ["mode", "look", "lens", "burro"].forEach(k => $("sp-" + k).setAttribute("aria-pressed", String(tab === k)));
      if (!tab) { tray.hidden = true; return; }
      tray.hidden = false;

      if (tab === "mode") {
        tray.innerHTML = `
          <div class="tray-head"><h2>Focus Pull Mode &amp; Summits</h2><button type="button" class="chip" id="tr-close">Done</button></div>
          <p class="tray-note">${MODES[state.modeIdx].desc}</p>
          <div class="chip-grid">${MODES.map((m, i) => `<button type="button" class="chip wide" data-mode="${i}" aria-pressed="${state.modeIdx === i}">${m.label} — ${m.sub}</button>`).join("")}</div>
          <div class="sec-label">Summit Base-Jump Launches (J)</div>
          <div class="chip-grid">${SUMMITS.map((s, idx) => `<button type="button" class="chip wide" data-summit="${idx}">${s.name}</button>`).join("")}</div>
          <div class="sec-label">MONOLITH-3 Zone Vantages</div>
          <div class="chip-grid">${ZONES.map(z => `<button type="button" class="chip" data-tp="${z.z}">Z-${ROMAN[z.z]} ${z.name}</button>`).join("")}</div>`;
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
          <p class="tray-note">Alt ${fmtElev(state.antennaElev)} (+${Math.round(state.relElev)}m above floor) · WiFi Reach ${Math.round(state.signalRadius)}m · Forest ${state.unlockedGroves}/${forestGroves.length}.</p>
          <div class="chip-grid">
            <button type="button" class="chip" id="br-cart" aria-pressed="${state.drivingCart}">${state.drivingCart ? "Exit Wagon (C)" : "Drive Wagon (C)"}</button>
            <button type="button" class="chip" id="br-glide" aria-pressed="${state.gliding}">${state.gliding ? "Fold Wing (J)" : "Base Jump / Glide (J)"}</button>
            <button type="button" class="chip" id="br-ride" aria-pressed="${state.riding}">${state.riding ? "Dismount (V)" : "Ride Mistletoe (V)"}</button>
            <button type="button" class="chip" id="br-region">${state.region === "ridge" ? "To Grand Teton (R)" : "To Half Dome (R)"}</button>
            <button type="button" class="chip" id="br-pour">Pour / Ping WiFi (F)</button>
            <button type="button" class="chip" id="br-pump">Pump Well (P)</button>
          </div>
          <div class="sec-label">Summit Base-Jump Drops</div>
          <div class="chip-grid">${SUMMITS.map((s, idx) => `<button type="button" class="chip wide" data-summit="${idx}">${s.name}</button>`).join("")}</div>
          <div class="sec-label">Signal, Rain Dome &amp; Burro</div>
          ${bar("WiFi Water", state.wifiCharge)}
          ${bar("In-Frame %", state.frameWifiPct / 100)}
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
        tray.querySelectorAll("[data-summit]").forEach(b => b.onclick = () => { launchSummit(+b.dataset.summit); renderTray(); });
        $("br-feed").onclick = () => { donkey.feed(); toast("Mistletoe munches oats gratefully."); renderTray(); };
        $("br-soothe").onclick = () => { donkey.soothe(); toast("A steady hand on Mistletoe’s shoulder."); renderTray(); };
        $("br-bray").onclick = () => { donkey.bray(); toast("Mistletoe brays across the canyon."); };
      }
      const cls = $("tr-close"); if (cls) cls.onclick = () => { state.trayTab = null; renderTray(); };
    }

    ["mode", "look", "lens", "burro"].forEach(k => $("sp-" + k).addEventListener("click", () => { state.trayTab = state.trayTab === k ? null : k; renderTray(); }));
    $("sp-clocks").addEventListener("click", () => {
      const on = audio.toggle(); $("sp-clocks").setAttribute("aria-pressed", String(on));
      toast(on ? "Three Clocks WebAudio engaged." : "Three Clocks muted.");
    });

    /* Cassette Deck */
    const audioEl = $("jerikan-audio");
    function toggleTape() {
      audio.connectTape(audioEl);
      if (audioEl.paused) {
        audioEl.play().catch(() => {}); $("tape-btn").setAttribute("aria-pressed", "true"); $("tape-btn").textContent = "❚❚ Pause Tape";
        document.body.classList.add("tape-playing"); toast("Ferric tape rolling: Cyan Jerikan Over Cosmic Addis.");
      } else {
        audioEl.pause(); $("tape-btn").setAttribute("aria-pressed", "false"); $("tape-btn").textContent = "▶ Play Tape";
        document.body.classList.remove("tape-playing");
      }
    }
    $("tape-btn").addEventListener("click", toggleTape);

    /* ---------- Expedition Actions: Relays, Filmstrip Forest, Cruiser Wagon, Donkey Glider & Region Switch ---------- */
    function igniteRelay(r) {
      if (r.lit) return;
      r.lit = true;
      if (r.poolMesh) r.poolMesh.material = cyanWaterMat;
      if (r.beaconRing) r.beaconRing.material = beaconCyanMat;
      if (r.covRing) r.covRing.line.visible = true;
      if (r.arcLine) r.arcLine.visible = true;
      state.wifiCharge = clamp(state.wifiCharge - .12, .55, 1.0);
      state.litRelays = relays.filter(x => x.lit).length;
      state.coveragePct = Math.round((state.litRelays / relays.length) * 100);
      if (r.id === "pueblo") {
        for (const m of puebloWinMeshes) m.material = puebloGlowWinMat;
        for (const d of puebloDishes) d.material = beaconCyanMat;
        audio.relayChime(true);
        toast("PUEBLO CISTERN FILLED · Electric-cyan WiFi floods the Far-Bank Highland Pueblo!");
      } else {
        audio.relayChime(false);
        toast(`${r.name} energized with Cyan WiFi Water (${state.litRelays}/5 · ${state.coveragePct}%).`);
      }
      updateHUD();
    }

    function unlockForestGrove(g) {
      if (g.unlocked) return;
      g.unlocked = true;
      for (const item of g.meshes) item.mesh.material = g.awakeMat;
      for (const tip of g.tips) tip.material = beaconCyanMat;
      state.unlockedGroves = forestGroves.filter(x => x.unlocked).length;
      state.unlockedTrees = forestGroves.reduce((s, x) => s + (x.unlocked ? x.trees : 0), 0);
      audio.forestChime(g.id);
      toast(`SIGNAL +${Math.round(state.relElev)}m UNLOCKED "${g.name}" (${state.unlockedGroves}/${forestGroves.length} Forest)!`);
      updateHUD();
    }

    function checkForestUnlocks() {
      for (const g of forestGroves) {
        if (g.unlocked || g.region !== state.region) continue;
        const dist = Math.hypot(g.x - donkey.state.x, g.z - donkey.state.z);
        if (state.relElev >= g.minRelAlt && dist <= state.signalRadius * 1.35) unlockForestGrove(g);
      }
    }

    function pingSignal() {
      state.pingTimer = 4.2; state.focusPulse = 1.0;
      audio.relayChime(false); checkForestUnlocks();
      toast(`High-Altitude WiFi Signal Ping! Alt ${fmtElev(state.antennaElev)} · Range ${Math.round(state.signalRadius * 1.25)} m.`);
    }

    function pourWifi() {
      let closest = null, bestD = 1e9;
      for (const r of relays) {
        if (r.lit || r.region !== state.region) continue;
        const d = Math.min(Math.hypot(r.x - state.x, r.z - state.z), Math.hypot(r.x - donkey.state.x, r.z - donkey.state.z));
        if (d < bestD) { bestD = d; closest = r; }
      }
      if (closest && bestD < 36) igniteRelay(closest);
      else if (state.region === "tetons" && Math.hypot(well.x - state.x, well.z - state.z) < 20) { state.wifiCharge = 1.0; pingSignal(); }
      else pingSignal();
    }
    $("btn-pour").addEventListener("click", pourWifi);

    function pumpWell() {
      state.pumpFlow = 1.0; state.pumpLeverPhase = .01; state.wifiCharge = 1.0;
      audio.pumpClank(); donkey.feed(); donkey.soothe();
      toast("Iron lever cracks — cyan WiFi water refills Mistletoe’s 20L jerrycans!");
      if (state.trayTab === "burro") renderTray();
    }
    $("btn-pump").addEventListener("click", pumpWell);

    function toggleCart() {
      state.riding = false;
      if (state.gliding) { state.gliding = false; state.glideOpen = 0; donkeyGlider.visible = false; donkey.group.rotation.set(0, donkey.state.heading, 0); }
      state.drivingCart = !state.drivingCart;
      if (state.drivingCart) {
        state.cartYawOffset = 0; state.cartPitchOffset = 0;
        state.donkeyOnRoof = true; state.roofMountT = 0;
        state.roofJumpStart.set(donkey.state.x, donkey.group.position.y, donkey.state.z);
        state.chaseCamPos.copy(camera.position);
        state.chaseLookAt.set(wagon.x, wagon.y + 1.8, wagon.z);
        toast("Cruiser Woody (Physics & Collisions OFF) · Mistletoe on roof-deck! WASD drive · Shift turbo · J glide.");
      } else {
        wagon.speed = 0; state.donkeyOnRoof = false;
        const dx = wagon.x + Math.cos(wagon.heading) * 2.8, dz = wagon.z - Math.sin(wagon.heading) * 2.8;
        state.x = dx; state.z = dz; state.y = driveSurfaceAt(dx, dz) + 1.68;
        donkey.place(wagon.x - Math.cos(wagon.heading) * 2.4, wagon.z + Math.sin(wagon.heading) * 2.4, wagon.heading, (x, z) => driveSurfaceAt(x, z));
        toast("Parked Cruiser Woody — Mistletoe hops down.");
      }
      updateHUD();
    }
    $("btn-cart").addEventListener("click", toggleCart);

    function toggleGlide(customLaunch = null) {
      if (state.gliding && !customLaunch) {
        state.gliding = false; state.glideOpen = 0; donkeyGlider.visible = false;
        contrailL.line.visible = false; contrailR.line.visible = false;
        donkey.group.rotation.set(0, state.glide.heading, 0);
        const fy = driveSurfaceAt(state.glide.x, state.glide.z);
        state.x = state.glide.x; state.z = state.glide.z; state.y = Math.max(fy + 1.68, state.glide.y);
        donkey.place(state.glide.x, state.glide.z, state.glide.heading, (x, z) => driveSurfaceAt(x, z));
        state.riding = true;
        toast("Wing folded — riding Mistletoe.");
        updateHUD();
        return;
      }
      state.drivingCart = false; state.donkeyOnRoof = false; state.riding = false;
      state.gliding = true; state.cartYawOffset = 0; state.cartPitchOffset = 0;
      const gx = customLaunch ? customLaunch.x : donkey.state.x;
      const gz = customLaunch ? customLaunch.z : donkey.state.z;
      const groundY = driveSurfaceAt(gx, gz);
      const startY = customLaunch ? groundY + customLaunch.boostY : Math.max(donkey.group.position.y + 3.2, groundY + 4.8);
      const hdg = customLaunch ? customLaunch.heading : (state.drivingCart ? wagon.heading : state.yaw + Math.PI);
      const rel = startY - groundY;
      Object.assign(state.glide, {
        x: gx, y: startY, z: gz, heading: hdg,
        speed: customLaunch ? 29.0 : 25.0,
        vy: rel > 10 && !customLaunch ? -1.8 : (customLaunch ? 3.5 : 11.5),
        bank: 0, time: 0
      });
      donkeyGlider.visible = true;
      for (const p of contrailL.pts) p.set(gx, startY + 2.5, gz);
      for (const p of contrailR.pts) p.set(gx, startY + 2.5, gz);
      state.chaseCamPos.set(gx - Math.sin(hdg) * 8.0, startY + 3.4, gz - Math.cos(hdg) * 8.0);
      state.chaseLookAt.set(gx + Math.sin(hdg) * 14, startY + 1.2, gz + Math.cos(hdg) * 14);
      audio.glideWhoosh();
      toast(customLaunch ? `SUMMIT BASE-JUMP! ${customLaunch.name} — W dive · S climb · Shift updraft!`
                         : "Donkey Paraglider unfurled! W dive · S flare · Shift thermal updraft · Space expose!");
      updateHUD();
    }
    if ($("btn-glide")) $("btn-glide").addEventListener("click", () => toggleGlide());

    function launchSummit(idx) {
      const sm = SUMMITS[clamp(idx, 0, SUMMITS.length - 1)];
      setRegion(sm.region);
      state.currentZone = sm.region === "ridge" ? 9 : 4;
      toggleGlide(sm);
      initRain();
    }

    function teleportZone(zoneIdx) {
      const Z = ZONES[clamp(zoneIdx, 0, 10)];
      state.riding = false; state.drivingCart = false; state.donkeyOnRoof = false; state.gliding = false;
      donkeyGlider.visible = false; contrailL.line.visible = false; contrailR.line.visible = false;
      setRegion(Z.region);
      state.x = Z.x - 4.5; state.z = Z.pz + 4.5;
      state.y = driveSurfaceAt(state.x, state.z) + 1.68;
      state.yaw = Math.atan2(-(Z.x - state.x), -(Z.pz - state.z));
      state.pitch = -.04; state.focusDist = 18.0; state.focusLook = Z.look; state.focusPulse = 1.0;
      const wh = Math.atan2(Z.x - wagon.x, Z.pz - wagon.z);
      wagon.x = Z.x + 6.5; wagon.z = Z.pz - 5.5; wagon.y = driveSurfaceAt(wagon.x, wagon.z);
      wagon.heading = state.yaw + Math.PI; wagon.speed = 0;
      wagon.group.position.set(wagon.x, wagon.y, wagon.z); wagon.group.rotation.y = wagon.heading;
      donkey.place(Z.x - 1.5, Z.pz + 2.5, state.yaw + Math.PI, (x, z) => driveSurfaceAt(x, z));
      donkey.group.rotation.set(0, donkey.state.heading, 0);
      initRain(); updateHUD();
      toast(`Arrived at Zone ${ROMAN[Z.z]} · ${Z.name}`);
    }

    function toggleRegion() {
      if (state.region === "tetons") teleportZone(9);
      else teleportZone(4);
    }
    if ($("btn-region")) $("btn-region").addEventListener("click", toggleRegion);

    function toggleRide() {
      if (state.gliding) { toggleGlide(); return; }
      if (state.drivingCart) { state.drivingCart = false; state.donkeyOnRoof = false; }
      if (!state.riding && Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z) > 12) {
        donkey.place(state.x + 1.8, state.z + 1.8, state.yaw + Math.PI, (x, z) => driveSurfaceAt(x, z));
      }
      state.riding = !state.riding; state.leadMode = "lead"; donkey.state.tethered = false;
      if (state.riding) state.yaw = donkey.state.heading + Math.PI;
      updateHUD();
      toast(state.riding ? "Mounted Mistletoe — WASD ride, J Base-Jump & Glide!" : "Dismounted.");
    }
    $("btn-ride").addEventListener("click", toggleRide);

    $("btn-jerikan").addEventListener("click", () => { state.filterIdx = state.filterIdx === 5 ? 0 : 5; updateHUD(); if (state.trayTab === "lens") renderTray(); });
    $("btn-ppc").addEventListener("click", () => { state.ppcOn = !state.ppcOn; updateHUD(); });
    if ($("last-plate-card")) $("last-plate-card").addEventListener("click", () => openPlateBox());

    const invProjView = new T.Matrix4(), projView = new T.Matrix4();
    function renderFrame(nowSec) {
      const w = renderer.domElement.width, h = renderer.domElement.height;
      mw.time.value = 8 + nowSec * .08;
      mw.glass.value = state.filterIdx;
      mw.tetonLight.position.copy(mw.sun.value).multiplyScalar(100);
      mw.ridgeLight.position.set(-mw.sun.value.z, mw.sun.value.y, -mw.sun.value.x).multiplyScalar(100);

      if (state.region === "tetons") {
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
      lookMat.uniforms.uWifiPing.value = state.pingTimer > 0 ? smooth(0, 1.5, state.pingTimer) : 0;

      const uW = lookMat.uniforms.uWifi.value;
      uW[0].set(donkey.state.x, donkey.group.position.y + 2.2, donkey.state.z, state.signalRadius);
      for (let i = 0; i < 5; i++) {
        const r = relays[i];
        if (r && r.lit && r.region === state.region) uW[i + 1].set(r.x, r.y + 2.0, r.z, r.id === "pueblo" ? 38.0 : 28.0);
        else uW[i + 1].set(0, 0, 0, 0);
      }
      const nearGroves = forestGroves.filter(g => g.unlocked && g.region === state.region).sort((a, b) =>
        Math.hypot(a.x - camera.position.x, a.z - camera.position.z) - Math.hypot(b.x - camera.position.x, b.z - camera.position.z));
      for (let k = 0; k < 2; k++) {
        const g = nearGroves[k];
        if (g) uW[6 + k].set(g.x, g.y + 8.0, g.z, 24.0 * g.grow);
        else uW[6 + k].set(0, 0, 0, 0);
      }

      lookMat.uniforms.tTrail.value = rtA.texture;
      lookMat.uniforms.uRes.value.set(w, h);
      postQuad.material = lookMat;
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    }

    const tmpRayDir = new T.Vector3(), tmpSample = new T.Vector3();
    function computeFrameWifiPct() {
      const emitters = sampleWifiEmitters();
      let sum = 0, count = 0;
      const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
      for (let gy = 0; gy < 4; gy++) {
        for (let gx = 0; gx < 5; gx++) {
          const ndcX = lerp(-.68, .68, gx / 4), ndcY = lerp(-.68, .68, gy / 3);
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

    function sampleMeter() {
      const dir = new T.Vector3(); camera.getWorldDirection(dir);
      let hitP = null;
      for (let st = 4; st <= 480; st += 12) {
        const sx = camera.position.x + dir.x * st, sy = camera.position.y + dir.y * st, sz = camera.position.z + dir.z * st;
        if (sy <= driveSurfaceAt(sx, sz) + .25) { hitP = { x: sx, y: sy, z: sz }; break; }
      }
      if (hitP) {
        const base = state.region === "ridge" ? 21.0 : 65.5;
        const elev = clamp((hitP.y - base) / 220, .05, .96);
        const fl = FILTERS[state.filterIdx];
        state.meteredZone = clamp(Math.round(elev * (fl.rgb[0] * .3 + fl.rgb[1] * .59 + fl.rgb[2] * .11) * 10), 0, 10);
      } else state.meteredZone = 8;

      let bestZ = ZONES[4], bestD = 1e9;
      for (const Z of ZONES) {
        if (Z.region !== state.region) continue;
        const d = Math.hypot(Z.x - state.x, Z.pz - state.z);
        if (d < bestD) { bestD = d; bestZ = Z; }
      }
      state.currentZone = bestZ.z;

      const floorY = state.region === "ridge" ? 21.0 : 65.5;
      state.antennaElev = donkey.group.position.y + 2.35;
      state.relElev = Math.max(0, state.antennaElev - floorY);
      const pingBoost = state.pingTimer > 0 ? 1.25 : 1.0;
      state.signalRadius = clamp((26 + Math.min(220, state.relElev * 1.25)) * (.72 + .28 * state.wifiCharge) * pingBoost, 24, 210);

      const dM = Math.hypot(donkey.state.x - state.x, donkey.state.z - state.z);
      state.signalDbm = Math.round(clamp(-30 - dM * .45 + Math.min(28, state.relElev * .18), -90, -24));
      state.litRelays = relays.filter(r => r.lit).length;
      state.coveragePct = Math.round((state.litRelays / relays.length) * 100);
      state.unlockedGroves = forestGroves.filter(g => g.unlocked).length;
      state.unlockedTrees = forestGroves.reduce((s, g) => s + (g.unlocked ? g.trees : 0), 0);
      state.frameWifiPct = computeFrameWifiPct();
    }

    function exposePlate() {
      audio.shutter();
      const fl = $("flash"); fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go");
      sampleMeter(); renderFrame(performance.now() * .001);
      const tmp = document.createElement("canvas"), cw = 640, ch = 512;
      tmp.width = cw; tmp.height = ch;
      const tx = tmp.getContext("2d");
      const sw = canvas.width, sh = canvas.height, aspect = 5 / 4;
      let sx = 0, sy = 0, sWidth = sw, sHeight = sh;
      if (sw / sh > aspect) { sWidth = Math.round(sh * aspect); sx = Math.round((sw - sWidth) / 2); }
      else { sHeight = Math.round(sw / aspect); sy = Math.round((sh - sHeight) / 2); }
      tx.drawImage(canvas, sx, sy, sWidth, sHeight, 0, 0, cw, ch);
      tx.fillStyle = "rgba(10, 15, 22, 0.80)"; tx.fillRect(0, ch - 34, cw, 34);
      tx.fillStyle = "#22d0ff"; tx.font = "700 13px Inter, system-ui, sans-serif";
      tx.fillText(`WIFI IN-FRAME ${state.frameWifiPct}%  ·  ${state.signalDbm} dBm`, 16, ch - 12);
      tx.fillStyle = "#f1eee6"; tx.textAlign = "right"; tx.font = "600 12px Inter, system-ui, sans-serif";
      tx.fillText(`${state.region === "ridge" ? "HALF DOME" : "TETONS"}  ·  Z-${ROMAN[state.meteredZone]}  ·  ALT ${fmtElev(state.antennaElev)}`, cw - 16, ch - 12);
      tx.textAlign = "left";

      const plate = {
        id: state.plates.length + 1, zone: state.meteredZone, roman: ROMAN[state.meteredZone],
        place: ZONES[state.currentZone].name, region: state.region,
        mode: MODES[state.modeIdx].label, look: LOOKS[state.soloLook >= 0 ? state.soloLook : state.focusLook].name,
        focus: state.focusDist.toFixed(1) + " m", stop: STOPS[state.stopIdx].name,
        signalDbm: state.signalDbm, frameWifiPct: state.frameWifiPct, coveragePct: state.coveragePct,
        antennaElev: +state.antennaElev.toFixed(1), unlockedGroves: state.unlockedGroves,
        dataUrl: tmp.toDataURL("image/jpeg", .86)
      };
      state.plates.push(plate);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ plates: state.plates.slice(-22) })); } catch {}
      updateHUD();
      toast(`8×10 Plate #${plate.id} · IN-FRAME WIFI ${plate.frameWifiPct}% · ALT ${fmtElev(state.antennaElev)}`);
    }
    $("expose-btn").addEventListener("click", exposePlate);

    function openPlateBox() {
      const box = $("platebox"), grid = $("pl-grid"), big = $("pl-big"), note = $("pl-note");
      const got = new Set(state.plates.map(p => p.zone));
      note.textContent = `${state.plates.length} WiFi Coverage Plate(s) · ${got.size}/11 Zones · Filmstrip Forest ${state.unlockedGroves}/${forestGroves.length} · Pueblo Mesh ${state.litRelays}/5.`;
      big.hidden = true;
      grid.innerHTML = state.plates.length ? state.plates.slice().reverse().map(p => `
        <button type="button" class="pl-card" data-pid="${p.id}">
          <img src="${p.dataUrl}" alt="Zone ${p.roman} plate">
          <small><strong>#${p.id} · WIFI ${p.frameWifiPct ?? 0}%</strong> (${p.place})<br>Alt ${fmtElev(p.antennaElev ?? 0)} · Forest ${p.unlockedGroves ?? 1}/${forestGroves.length}</small>
        </button>`).join("") : `<p class="tray-note">No coverage plates exposed yet. Press Space or click Expose 8×10.</p>`;
      grid.querySelectorAll("[data-pid]").forEach(btn => {
        btn.onclick = () => { const p = state.plates.find(x => x.id === +btn.dataset.pid); if (p) { big.src = p.dataUrl; big.hidden = false; } };
      });
      box.hidden = false;
    }
    $("sp-plates").addEventListener("click", openPlateBox);
    $("pl-close").addEventListener("click", () => { $("platebox").hidden = true; });

    /* ---------- Input Handling ---------- */
    const keys = Object.create(null);
    addEventListener("keydown", e => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      keys[e.code] = true;
      if (e.code === "BracketLeft") { state.focusDist = clamp(state.focusDist * .86, 1.2, 900); state.focusPulse = 1; updateHUD(); }
      else if (e.code === "BracketRight") { state.focusDist = clamp(state.focusDist * 1.16, 1.2, 900); state.focusPulse = 1; updateHUD(); }
      else if (e.code === "KeyC") toggleCart();
      else if (e.code === "KeyJ") toggleGlide();
      else if (e.code === "KeyR") toggleRegion();
      else if (e.code === "KeyV") toggleRide();
      else if (e.code === "KeyP") pumpWell();
      else if (e.code === "KeyF") pourWifi();
      else if (e.code === "KeyH") { state.ppcOn = !state.ppcOn; updateHUD(); }
      else if (e.code === "KeyG") { state.groundGlass = !state.groundGlass; document.body.classList.toggle("ground-glass", state.groundGlass); }
      else if (e.code === "Space") { e.preventDefault(); exposePlate(); }
      else if (e.code === "KeyQ") { state.tilt = clamp(state.tilt - .16, -.35, .35); updateHUD(); }
      else if (e.code === "KeyE") { state.tilt = clamp(state.tilt + .16, -.35, .35); updateHUD(); }
      else if (e.code >= "Digit1" && e.code <= "Digit6") { state.filterIdx = +e.code.slice(5) - 1; updateHUD(); }
    });
    addEventListener("keyup", e => { keys[e.code] = false; });

    let dragLook = false, lastPX = 0, lastPY = 0;
    canvas.addEventListener("pointerdown", e => { dragLook = true; lastPX = e.clientX; lastPY = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => {
      if (!dragLook) return;
      const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
      lastPX = e.clientX; lastPY = e.clientY;
      if (state.drivingCart || state.gliding) {
        state.cartYawOffset = clamp(state.cartYawOffset - dx * .0045, -1.8, 1.8);
        state.cartPitchOffset = clamp(state.cartPitchOffset - dy * .0035, -.45, .45);
      } else {
        state.yaw -= dx * .0045;
        state.pitch = clamp(state.pitch - dy * .0038, -.82, .82);
      }
    });
    addEventListener("pointerup", () => { dragLook = false; });

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      if (state.drivingCart || state.gliding) {
        state.chaseZoom = clamp(state.chaseZoom * (e.deltaY > 0 ? 1.08 : 0.92), 5.0, 22.0);
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

    function resize() {
      const dpr = renderer.getPixelRatio();
      const w = Math.max(2, Math.floor(innerWidth * dpr)), h = Math.max(2, Math.floor(innerHeight * dpr));
      renderer.setSize(innerWidth, innerHeight, false);
      camera.aspect = innerWidth / Math.max(1, innerHeight); camera.updateProjectionMatrix();
      rtScene.setSize(w, h); rtA.setSize(w, h); rtB.setSize(w, h);
    }
    addEventListener("resize", resize);
    resize();

    /* ---------- Simulation Loop: Collision-Free Cruiser Wagon + Donkey Base-Jump Glider + WiFi-Bounded Rain ---------- */
    const donkeyHand = new T.Vector3(), halterOut = new T.Vector3(), saddlePos = new T.Vector3(), roofWorldPos = new T.Vector3();
    let lastT = null, meterClock = 0;

    function worldBoundsClamp(x, z) {
      if (state.region === "ridge") return [clamp(x, -620, 920), clamp(z, -660, 980)];
      return [clamp(x, -1560, 110), clamp(z, -480, 480)];
    }

    function step(dt) {
      const fwdInput = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const sideInput = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const turbo = keys.ShiftLeft || keys.ShiftRight;
      const brakeInput = keys.KeyX ? 1 : 0;

      if (state.pingTimer > 0) state.pingTimer = Math.max(0, state.pingTimer - dt);

      if (state.gliding) {
        /* --- DONKEY BASE-JUMP & VALLEY PARAGLIDER FLIGHT --- */
        state.glide.time += dt;
        state.glideOpen = lerp(state.glideOpen, 1.0, 1 - Math.exp(-dt * 11));
        donkeyGlider.visible = true;
        donkeyGlider.scale.set(state.glideOpen, state.glideOpen, state.glideOpen);

        const g = state.glide;
        g.heading -= sideInput * 1.75 * dt;
        g.bank = lerp(g.bank, sideInput * .46, 1 - Math.exp(-dt * 8));

        const targetSpd = turbo ? 38.0 : (fwdInput > 0 ? 46.0 : (fwdInput < 0 ? 18.0 : 27.0));
        const targetVy = turbo ? 11.5 : (fwdInput > 0 ? -15.5 : (fwdInput < 0 ? 9.5 : -2.6));
        g.speed = lerp(g.speed, targetSpd, 1 - Math.exp(-dt * 5.0));
        g.vy = lerp(g.vy, targetVy, 1 - Math.exp(-dt * 4.5));

        [g.x, g.z] = worldBoundsClamp(g.x + Math.sin(g.heading) * g.speed * dt, g.z + Math.cos(g.heading) * g.speed * dt);
        g.y += g.vy * dt;

        const surfY = driveSurfaceAt(g.x, g.z);
        if (g.y <= surfY + .45 && g.vy <= 0 && g.time > .45) {
          g.y = surfY;
          state.gliding = false; state.glideOpen = 0; donkeyGlider.visible = false;
          contrailL.line.visible = false; contrailR.line.visible = false;
          donkey.group.rotation.set(0, g.heading, 0);
          donkey.place(g.x, g.z, g.heading, (x, z) => driveSurfaceAt(x, z));
          state.riding = true; state.x = g.x; state.z = g.z; state.y = surfY + 1.65;
          state.yaw = g.heading + Math.PI;
          toast("Touchdown! Mistletoe lands softly on four hooves.");
        } else {
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 0, drop: 0 }, () => g.y + .22);
          donkey.state.x = g.x; donkey.state.y = g.y; donkey.state.z = g.z; donkey.state.heading = g.heading;
          donkey.group.position.set(g.x, g.y, g.z);
          donkey.group.rotation.set(clamp(-g.vy * .022, -.42, .32), g.heading, -g.bank);
          donkey.group.updateMatrixWorld(true);

          // Update Wingtip Cyan Contrails
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
        }

        const camDist = state.chaseZoom * .82, lookHdg = g.heading + state.cartYawOffset;
        const desiredCam = new T.Vector3(
          g.x - Math.sin(lookHdg) * camDist,
          Math.max(driveSurfaceAt(g.x - Math.sin(lookHdg) * camDist, g.z - Math.cos(lookHdg) * camDist) + 1.8, g.y + 3.0 + state.cartPitchOffset * 4.5),
          g.z - Math.cos(lookHdg) * camDist
        );
        const desiredLook = new T.Vector3(g.x + Math.sin(g.heading) * 14, g.y + 1.1, g.z + Math.cos(g.heading) * 14);
        state.chaseCamPos.lerp(desiredCam, 1 - Math.exp(-dt * 9.5));
        state.chaseLookAt.lerp(desiredLook, 1 - Math.exp(-dt * 11));
        camera.position.copy(state.chaseCamPos);
        camera.lookAt(state.chaseLookAt);
        camera.updateMatrixWorld();
        state.x = g.x; state.z = g.z; state.y = g.y;
        state.yaw = lookHdg + Math.PI;
      } else if (state.drivingCart) {
        /* --- CRUISER WOODY STATION WAGON (PHYSICS & COLLISIONS OFF) --- */
        const targetSpeed = brakeInput ? 0 : fwdInput > 0 ? (turbo ? 42.0 : 25.0) : fwdInput < 0 ? -15.0 : 0;
        const accelRate = (fwdInput === 0 || brakeInput) ? 9.5 : 6.8;
        wagon.speed = lerp(wagon.speed, targetSpeed, 1 - Math.exp(-dt * accelRate));
        if (Math.abs(wagon.speed) < .06 && fwdInput === 0) wagon.speed = 0;

        const revFlip = (fwdInput < 0 && wagon.speed < -.5) ? -1 : 1;
        wagon.heading -= sideInput * revFlip * 1.85 * dt;
        wagon.steerAngle = lerp(wagon.steerAngle, -sideInput * .38, 1 - Math.exp(-dt * 12));

        [wagon.x, wagon.z] = worldBoundsClamp(wagon.x + Math.sin(wagon.heading) * wagon.speed * dt, wagon.z + Math.cos(wagon.heading) * wagon.speed * dt);
        const surfY = driveSurfaceAt(wagon.x, wagon.z);
        wagon.y = lerp(wagon.y, surfY, 1 - Math.exp(-dt * 18));

        const sinH = Math.sin(wagon.heading), cosH = Math.cos(wagon.heading);
        const fH = driveSurfaceAt(wagon.x + sinH * 1.65, wagon.z + cosH * 1.65);
        const rH = driveSurfaceAt(wagon.x - sinH * 1.65, wagon.z - cosH * 1.65);
        wagon.pitch = lerp(wagon.pitch, clamp(Math.atan2(fH - rH, 3.30) * .65, -.16, .16), 1 - Math.exp(-dt * 12));
        wagon.roll = 0;

        wagon.group.position.set(wagon.x, wagon.y, wagon.z);
        wagon.group.rotation.y = wagon.heading;
        wagon.chassis.position.y = 0;
        wagon.chassis.rotation.x = wagon.pitch;
        wagon.chassis.rotation.z = 0;

        for (const w of wagon.wheels) {
          w.mount.position.y = .394;
          w.spin.rotation.x -= (wagon.speed * dt) / .394;
          if (w.front) w.mount.rotation.y = wagon.steerAngle;
        }

        // Mistletoe riding centered on the Woody Wagon's 12-plank roof-deck
        wagon.group.updateMatrixWorld(true);
        wagon.roofStandSpot.getWorldPosition(roofWorldPos);
        state.roofMountT = Math.min(1, state.roofMountT + dt * 2.8);
        const hopK = smooth(0, 1, state.roofMountT), arcY = Math.sin(state.roofMountT * Math.PI) * 1.35;
        const dpx = lerp(state.roofJumpStart.x, roofWorldPos.x, hopK);
        const dpy = lerp(state.roofJumpStart.y, roofWorldPos.y, hopK) + arcY;
        const dpz = lerp(state.roofJumpStart.z, roofWorldPos.z, hopK);
        donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, () => dpy);
        donkey.state.x = dpx; donkey.state.y = dpy; donkey.state.z = dpz;
        donkey.state.heading = wagon.heading;
        donkey.group.position.set(dpx, dpy, dpz);
        donkey.group.rotation.set(0, wagon.heading, 0);

        const lookHdg = wagon.heading + state.cartYawOffset;
        const camX = wagon.x - Math.sin(lookHdg) * state.chaseZoom, camZ = wagon.z - Math.cos(lookHdg) * state.chaseZoom;
        const desiredCam = new T.Vector3(camX, Math.max(driveSurfaceAt(camX, camZ) + 2.0, wagon.y + 4.35 + state.cartPitchOffset * 4.2), camZ);
        const desiredLook = new T.Vector3(wagon.x + Math.sin(wagon.heading) * 10, wagon.y + 2.4, wagon.z + Math.cos(wagon.heading) * 10);
        state.chaseCamPos.lerp(desiredCam, 1 - Math.exp(-dt * 9.5));
        state.chaseLookAt.lerp(desiredLook, 1 - Math.exp(-dt * 11));
        camera.position.copy(state.chaseCamPos);
        camera.lookAt(state.chaseLookAt);
        camera.updateMatrixWorld();
        state.x = wagon.x; state.z = wagon.z; state.y = wagon.y + 2.0;
        state.yaw = lookHdg + Math.PI;
      } else if (state.riding) {
        const prevH = donkey.state.heading;
        const stepFn = (x, z) => driveSurfaceAt(x, z);
        donkey.update(dt, { throttle: fwdInput, steer: -sideInput, pace: turbo ? 2 : state.gaitIdx, near: 0, drop: 0 }, stepFn);
        [donkey.state.x, donkey.state.z] = worldBoundsClamp(donkey.state.x, donkey.state.z);
        donkey.group.rotation.set(0, donkey.state.heading, 0);
        state.yaw += Math.atan2(Math.sin(donkey.state.heading - prevH), Math.cos(donkey.state.heading - prevH));
        donkey.saddleAt(saddlePos);
        // Auto Base-Jump launch if galloping off a steep cliff drop (> 4.5 m)!
        const aheadX = donkey.state.x + Math.sin(donkey.state.heading) * 2.5, aheadZ = donkey.state.z + Math.cos(donkey.state.heading) * 2.5;
        if (donkey.group.position.y - driveSurfaceAt(aheadX, aheadZ) > 4.5 && fwdInput > 0) {
          toggleGlide({ x: donkey.state.x, z: donkey.state.z, boostY: 2.0, heading: donkey.state.heading, name: "Cliff Edge Auto-Launch!" });
        } else {
          state.x = donkey.state.x; state.z = donkey.state.z; state.y = saddlePos.y + .72;
          camera.position.set(state.x, state.y, state.z);
          camera.rotation.order = "YXZ"; camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
          camera.updateMatrixWorld();
        }
      } else {
        /* --- ON FOOT (COLLISIONS OFF) + LEADING MISTLETOE --- */
        const speed = turbo ? 16.0 : 7.5;
        const sx = Math.sin(state.yaw), cz = Math.cos(state.yaw);
        [state.x, state.z] = worldBoundsClamp(state.x + (-sx * fwdInput + cz * sideInput) * speed * dt, state.z + (-cz * fwdInput - sx * sideInput) * speed * dt);
        state.y = lerp(state.y, driveSurfaceAt(state.x, state.z) + 1.68, 1 - Math.exp(-dt * 14));
        const dx = state.x - donkey.state.x, dz = state.z - donkey.state.z, dist = Math.hypot(dx, dz);
        const stepFn = (x, z) => driveSurfaceAt(x, z);
        if (state.leadMode === "lead" && dist > 3.6) {
          const want = Math.atan2(dx, dz), df = Math.atan2(Math.sin(want - donkey.state.heading), Math.cos(want - donkey.state.heading));
          donkey.update(dt, { throttle: clamp((dist - 3.0) * .55, 0, 1), steer: clamp(df * 1.4, -1, 1), pace: dist > 10 ? 1 : 0, near: 1, drop: 0 }, stepFn);
        } else {
          donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: dist < 3.5 ? 1 : 0, drop: 0 }, stepFn);
        }
        donkey.group.rotation.set(0, donkey.state.heading, 0);
        camera.position.set(state.x, state.y, state.z);
        camera.rotation.order = "YXZ"; camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
        camera.updateMatrixWorld();
      }

      /* Elevation & Live WiFi Field */
      const floorY = state.region === "ridge" ? 21.0 : 65.5;
      state.antennaElev = donkey.group.position.y + 2.35;
      state.relElev = Math.max(0, state.antennaElev - floorY);
      const pingBoost = state.pingTimer > 0 ? 1.25 : 1.0;
      state.signalRadius = clamp((26 + Math.min(220, state.relElev * 1.25)) * (.72 + .28 * state.wifiCharge) * pingBoost, 24, 210);

      checkForestUnlocks();
      const nowSec = performance.now() * .001;
      for (const g of forestGroves) {
        g.grow = lerp(g.grow, g.unlocked ? 1.0 : .18, 1 - Math.exp(-dt * 2.2));
        for (let t = 0; t < g.meshes.length; t++) {
          const item = g.meshes[t];
          item.mesh.scale.set(1, g.grow * item.targetH, 1);
          item.mesh.rotation.z = g.unlocked ? .05 * Math.sin(nowSec * 1.1 + item.phase) : 0;
          if (g.tips[t]) { g.tips[t].position.y = g.grow * item.targetH * 18.5 + .45; g.tips[t].rotation.y = nowSec * (g.unlocked ? 1.8 : .4); }
        }
      }

      for (const r of relays) {
        if (r.lit || r.region !== state.region) continue;
        if (Math.hypot(r.x - donkey.state.x, r.z - donkey.state.z) < 22.0) igniteRelay(r);
      }

      // Live Donkey WiFi Rings & Expanding 3D Wavefront Arcs
      donkeyRings[0].radius = state.signalRadius * .28;
      donkeyRings[1].radius = state.signalRadius * .62;
      donkeyRings[2].radius = state.signalRadius;
      for (const rg of donkeyRings) updateTerrainRing(rg, donkey.state.x, donkey.state.z, state.region, .25);
      for (const wv of waveArcs) {
        const p = fract(nowSec * .42 + wv.phase);
        const rad = lerp(1.0, Math.min(26.0, state.signalRadius * .48), p);
        wv.mesh.position.set(donkey.state.x, donkey.group.position.y + 2.0 + p * 2.1, donkey.state.z);
        wv.mesh.scale.set(rad, 1, rad);
        wv.mesh.material.opacity = (1 - p) * .84 * (.6 + .4 * state.wifiCharge);
      }
      whip.rotation.z = Math.sin(nowSec * 3.1) * .08;

      if (state.pumpFlow > .05) {
        state.pumpFlow = Math.max(.22, state.pumpFlow - dt * .04);
        state.pumpLeverPhase += dt * 4.5;
        well.leverPivot.rotation.z = Math.sin(state.pumpLeverPhase) * .35 * smooth(.22, .65, state.pumpFlow);
      }
      well.stream.visible = state.pumpFlow > .25;
      well.stream.scale.set(state.pumpFlow, 1, state.pumpFlow);
      well.pool.position.y = .21 + Math.sin(nowSec * 4.0) * .012;

      /* --- WIFI WATER RAIN FALLS STRICTLY INSIDE ACTIVE WIFI DONKEY REACH --- */
      const emitters = sampleWifiEmitters();
      for (let i = 0; i < RAIN_N; i++) {
        rainY[i] -= rainSpd[i] * dt;
        const surf = driveSurfaceAt(rainX[i], rainZ[i]);
        if (rainY[i] < surf || !inWifiReach(rainX[i], rainZ[i], emitters)) respawnRaindrop(i, emitters);
        const rx = rainX[i], ry = rainY[i], rz = rainZ[i], base = i * 6;
        rainPos[base] = rx; rainPos[base + 1] = ry; rainPos[base + 2] = rz;
        rainPos[base + 3] = rx; rainPos[base + 4] = ry + .85; rainPos[base + 5] = rz;
      }
      rainGeo.attributes.position.needsUpdate = true;

      leadRope.visible = !state.riding && !state.drivingCart && !state.gliding;
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

      const sp = audio.sampleTape();
      lookMat.uniforms.uAudioBass.value = lerp(lookMat.uniforms.uAudioBass.value, sp.bass, clamp(dt * 10, 0, 1));
      lookMat.uniforms.uAudioHigh.value = lerp(lookMat.uniforms.uAudioHigh.value, sp.high, clamp(dt * 10, 0, 1));
      lookMat.uniforms.uT.value = nowSec;
      state.focusPulse = Math.max(0, state.focusPulse - dt * 1.4);
      lookMat.uniforms.uFocusPulse.value = state.focusPulse;

      meterClock += dt;
      if (meterClock > .12) {
        meterClock = 0; sampleMeter();
        $("thought").textContent = state.gliding
          ? `DONKEY BASE-JUMP GLIDE! Alt ${fmtElev(state.antennaElev)} · WiFi Reach ${Math.round(state.signalRadius)}m — cyan rain falls under your wing.`
          : state.donkeyOnRoof
            ? `Cruiser Woody (Physics & Collisions OFF) · Roof Mistletoe +${Math.round(state.relElev)}m · Reach ${Math.round(state.signalRadius)}m!`
            : `MONOLITH-3 (${state.region === "ridge" ? "Half Dome" : "Grand Teton"}) · Alt ${fmtElev(state.antennaElev)} · Cyan rain falls inside WiFi dome.`;
        if (!audioEl.paused || audioEl.currentTime > 0) {
          const curT = audioEl.currentTime, dur = Number.isFinite(audioEl.duration) ? audioEl.duration : 283;
          $("tape-time").textContent = `${formatMMSS(curT)} / ${formatMMSS(dur)}`;
          $("ppc-timecode").textContent = `01:${String(12 + Math.floor(curT / 60)).padStart(2, "0")}:${String(Math.floor(curT % 60)).padStart(2, "0")}`;
          let line = LYRICS[0][1]; for (const [ts, txt] of LYRICS) if (curT >= ts) line = txt;
          $("lyric-line").textContent = line;
        } else $("ppc-timecode").textContent = `01:14:${String(17 + (Math.floor(nowSec) % 42)).padStart(2, "0")}`;
        updateHUD();
      }
      audio.tick(dt, state.meteredZone);
    }

    initRain();
    sampleMeter();
    updateHUD();
    const loaderEl = $("world-loader");
    if (loaderEl) loaderEl.hidden = true;

    function loop(now) {
      if (lastT === null) lastT = now - 16;
      const dt = clamp((now - lastT) / 1000, .001, .05); lastT = now;
      step(dt); renderFrame(now * .001); requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    window.__zones = {
      isReady: () => state.ready,
      getState: () => {
        const emitters = sampleWifiEmitters();
        let rainOutsideWifi = 0;
        for (let i = 0; i < RAIN_N; i++) if (!inWifiReach(rainX[i], rainZ[i], emitters)) rainOutsideWifi++;
        return {
          ready: true,
          region: state.region,
          mode: MODES[state.modeIdx].id,
          soloLook: state.soloLook,
          focusLook: LOOKS[state.focusLook].id,
          focusDist: state.focusDist,
          stop: STOPS[state.stopIdx].name,
          filter: FILTERS[state.filterIdx].name,
          currentZone: state.currentZone,
          meteredZone: state.meteredZone,
          x: state.x, z: state.z, y: state.y,
          wagon: { x: wagon.x, z: wagon.z, y: wagon.y, speed: wagon.speed, steerAngle: wagon.steerAngle, roll: wagon.roll, pitch: +wagon.pitch.toFixed(3) },
          donkeyOnRoof: state.donkeyOnRoof,
          gliding: state.gliding,
          glide: { x: state.glide.x, y: state.glide.y, z: state.glide.z, speed: +state.glide.speed.toFixed(1), vy: +state.glide.vy.toFixed(1) },
          drivingCart: state.drivingCart,
          riding: state.riding,
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
          coveragePct: state.coveragePct,
          plates: state.plates.length,
          audioReady: audioEl.readyState >= 1
        };
      },
      getRelays: () => relays.map(r => ({ id: r.id, name: r.name, lit: r.lit })),
      getForest: () => forestGroves.map(g => ({ id: g.id, region: g.region, name: g.name, minRelAlt: g.minRelAlt, unlocked: g.unlocked })),
      getSummits: () => SUMMITS.map(s => ({ id: s.id, region: s.region, name: s.name, x: s.x, z: s.z })),
      setMode: id => { const i = MODES.findIndex(m => m.id === id); if (i >= 0) { state.modeIdx = i; state.focusPulse = 1; updateHUD(); if (state.trayTab) renderTray(); } },
      setFocus: m => { state.focusDist = clamp(m, 1.2, 900); state.focusPulse = 1; updateHUD(); },
      setStop: i => { state.stopIdx = clamp(i, 0, STOPS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
      setFilter: i => { state.filterIdx = clamp(i, 0, FILTERS.length - 1); updateHUD(); if (state.trayTab) renderTray(); },
      setSoloLook: id => { state.soloLook = id ? LOOKS.findIndex(l => l.id === id) : -1; updateHUD(); if (state.trayTab) renderTray(); },
      lookAtDonkey: () => {
        const dx = donkey.state.x, dz = donkey.state.z;
        state.riding = false; state.drivingCart = false; state.donkeyOnRoof = false; state.gliding = false;
        state.x = dx - 2.6; state.z = dz + 2.2; state.y = driveSurfaceAt(state.x, state.z) + 1.6;
        state.yaw = Math.atan2(-(dx - state.x), -(dz - state.z));
        state.pitch = -.05; state.focusDist = 4.0;
        camera.position.set(state.x, state.y, state.z);
        camera.rotation.order = "YXZ"; camera.rotation.y = state.yaw; camera.rotation.x = state.pitch;
        camera.updateMatrixWorld(); sampleMeter(); updateHUD();
      },
      exposePlate, teleportZone, toggleRide, toggleCart, toggleGlide, launchSummit, toggleRegion, pumpWell, pourWifi, pingSignal, toggleTape
    };
  }

  boot().catch(err => {
    console.error("THRESHOLD MONOLITH-3 boot error:", err);
    const msg = $("world-loader-msg");
    if (msg) msg.textContent = "Error loading MONOLITH-3 terrain: " + (err && err.message ? err.message : String(err));
  });
})();
