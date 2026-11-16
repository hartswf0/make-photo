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
}
`;

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
}
`;

const meshVertex = `
varying vec3 vWorld, vNormal;
varying vec2 vUV;
void main() {
  vWorld = (modelMatrix * vec4(position,1.)).xyz;
  vNormal = mat3(modelMatrix) * normal;
  vUV = uv;
  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld,1.);
}
`;

const skyVertex = `
varying vec2 vUV;
void main() {
  vUV = uv;
  gl_Position = vec4(position.xy, .999995, 1.);
}
`;

const skyFragment = `
varying vec2 vUV;
uniform float uUnlit;
${noiseGLSL}
${stormGLSL}
void main() {
  if(uUnlit > .5) {
    gl_FragColor = vec4(.12,.12,.12,1.);
    return;
  }
  vec2 plate = vec2(vUV.x, clamp((vUV.y-.48)/.52,0.,1.));
  float light = skyPlate(plate);
  float floorHaze = 1. - smoothstep(.55,.78,vUV.y);
  float gray = paper(mix(light,.53 - vUV.x * .055,.38*floorHaze));
  gl_FragColor = vec4(vec3(gray),1.);
}
`;

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
}
`;

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
  if (uUnlit > .5) {
    float gray = .27 + .57*max(0.,dot(n,normalize(vec3(.40,.64,-.65))));
    gl_FragColor = vec4(vec3(gray),1.);
    return;
  }
#ifdef PRINT_BLUFF
  vec3 litter=texture2D(uGround,p.xz*.14 + p.y*.026).rgb;
  vec3 stone=triplanar(uScree,p/7.5,n);
  float low=fbm(p.xz*.064 + vec2(p.y*.043,-p.y*.047));
  float lit=max(0.,dot(n,sun));
  float detail=mix(litter.r,stone.r,smoothstep(.44,.72,low)*.43);
  float shade=(.006 + .048*pow(detail,1.7))*(.49+.54*low)*(.67+.51*lit);
  gl_FragColor=vec4(vec3(paper(film(shade))),1.);
  return;
#endif
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
}
`;

const riverFragment = `
varying vec3 vWorld;
varying vec2 vUV;
uniform sampler2D uFlowCoordinates;
uniform vec3 uForward, uRight, uUp;
uniform vec2 uShift;
uniform float uTan, uAspect, uUnlit;
uniform vec2 uView, uReflectionSize, uBedSize;
uniform sampler2D uBankReflection, uReachBed;
uniform vec4 uReachBounds;
uniform mat4 uProjectionInverse, uReflectionCamera;
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
  if(uUnlit > .5) {
    gl_FragColor = vec4(vec3(.84),coverage);
    return;
  }
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
}
`;

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
}
`;

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
  float stone=(.077+.27*slabs.r)*( .66+.68*grains.r);
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
}
`;

const focusFragment = `
varying vec2 vUV;
uniform sampler2D uImage,uDepth;
uniform mat4 uInverseViewProjection;
uniform vec4 uPlane;
uniform vec2 uPixel;
void main(){
  float depth=texture2D(uDepth,vUV).r;
  vec4 p=uInverseViewProjection*vec4(vUV*2.-1.,depth*2.-1.,1.);
  float off=abs(dot(uPlane.xyz,p.xyz/p.w)+uPlane.w);
  float blur=smoothstep(.83,4.7,off)*3.8*step(depth,.99992);
  vec2 s=uPixel*blur;
  vec3 color=texture2D(uImage,vUV).rgb*.40;
  color+=.15*texture2D(uImage,vUV+vec2(s.x,s.y*.4)).rgb;
  color+=.15*texture2D(uImage,vUV-vec2(s.x,s.y*.4)).rgb;
  color+=.15*texture2D(uImage,vUV+vec2(-s.x*.4,s.y)).rgb;
  color+=.15*texture2D(uImage,vUV+vec2(s.x*.4,-s.y)).rgb;
  gl_FragColor=vec4(color,1.);
}
`;

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
}
`;

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
}
`;

const el = id => document.getElementById(id);
const asset = id => el(id).textContent.trim();
const config = JSON.parse(asset('terrain-data'));
const survey = JSON.parse(asset('half-survey'));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a,b,t) => a+(b-a)*t;
function smooth(a,b,x) {
  const t=clamp((x-a)/(b-a),0,1);
  return t*t*(3-2*t);
}
function seedRandom(seed) {
  return () => {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
    return seed/4294967296;
  };
}
function rawBytes(text) {
  return Uint8Array.from(atob(text), value => value.charCodeAt(0));
}
async function inflate(text) {
  const stream = new Blob([rawBytes(text)]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function inflateText(id) {
  const node=el(id), text=node.textContent.trim();
  if(node.dataset.encoding!=='deflate'&&(text.startsWith('/*')||text.startsWith('import')||text.startsWith('export')))return text;
  return new TextDecoder().decode(await inflate(text));
}
async function loadFloatAsset(id) {
  const node=el(id), text=node.textContent.trim();
  const bytes=node.dataset.encoding==='deflate'?await inflate(text):rawBytes(text);
  const aligned=bytes.byteOffset%4===0?bytes:bytes.slice();
  return new Float32Array(aligned.buffer,aligned.byteOffset,aligned.byteLength/4);
}
async function loadThree() {
  const blob = code => URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  const [coreCode, mainCode] = await Promise.all([inflateText('three-core'), inflateText('three-module')]);
  const core=blob(coreCode);
  const main=blob(mainCode.replaceAll('./three.core.min.js',core));
  try { return await import(main); }
  finally { URL.revokeObjectURL(main); URL.revokeObjectURL(core); }
}
async function loadImage(id) {
  const image = new Image();
  image.src=asset(id);
  await image.decode();
  return image;
}
function pixels(image) {
  const surface=document.createElement('canvas');
  surface.width=image.width;
  surface.height=image.height;
  const ctx=surface.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0);
  return ctx.getImageData(0,0,image.width,image.height);
}
function imageGrid(image,bounds) {
  const {width,height,data}=pixels(image);
  const values=new Float32Array(width*height);
  for(let i=0;i<values.length;i++) {
    const j=i*4;
    values[i]=(data[j]*256+data[j+1])*.1+data[j+2]*.02-120;
  }
  return makeGrid(width,height,values,bounds);
}
function inside(bounds,x,z) {
  const [west,east,south,north]=bounds;
  return x>=west&&x<=east&&z>=-north&&z<=-south;
}
function makeGrid(width,height,values,bounds) {
  const [west,east,south,north]=bounds;
  return {
    width,height,values,bounds,
    at(x,z) {
      const u=clamp((x-west)/(east-west),0,1)*(width-1);
      const v=clamp((z+north)/(north-south),0,1)*(height-1);
      const i=Math.min(width-2,Math.floor(u)),j=Math.min(height-2,Math.floor(v));
      const p=u-i,q=v-j;
      const k=j*width+i;
      const a=values[k],b=values[k+1],c=values[k+width],d=values[k+width+1];
      return p+q<=1?a+(b-a)*p+(c-a)*q:d+(c-d)*(1-p)+(b-d)*(1-q);
    }
  };
}
function textureBounds(T,bounds) {
  const [west,east,south,north]=bounds;
  return new T.Vector4(west,-south,1/(east-west),-1/(north-south));
}
function rasterMesh(T,at,bounds,columns,rows,{cuts=[],uvBounds=bounds}={}) {
  const [west,east,south,north]=bounds;
  const p=new Float32Array(columns*rows*3);
  const uv=new Float32Array(columns*rows*2);
  const indices=new Uint32Array((columns-1)*(rows-1)*6);
  for(let j=0,k=0;j<rows;j++){
    const z=mix(-north,-south,j/(rows-1));
    for(let i=0;i<columns;i++,k++){
      const x=mix(west,east,i/(columns-1));
      p[k*3]=x;p[k*3+1]=at(x,z);p[k*3+2]=z;
      uv[k*2]=(x-uvBounds[0])/(uvBounds[1]-uvBounds[0]);
      uv[k*2+1]=(-z-uvBounds[2])/(uvBounds[3]-uvBounds[2]);
    }
  }
  let used=0;
  for(let j=0;j<rows-1;j++)for(let i=0;i<columns-1;i++){
    const x=mix(west,east,(i+.5)/(columns-1));
    const z=mix(-north,-south,(j+.5)/(rows-1));
    if(cuts.some(cut=>inside(cut,x,z)))continue;
    const a=j*columns+i;
    indices[used++]=a;indices[used++]=a+columns;indices[used++]=a+1;
    indices[used++]=a+1;indices[used++]=a+columns;indices[used++]=a+columns+1;
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.BufferAttribute(p,3));
  geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
  geometry.setIndex(new T.BufferAttribute(indices.subarray(0,used),1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

async function loadWorld() {
  const T=await loadThree();
  const renderer=new T.WebGLRenderer({canvas:el('world'),antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setClearColor(0x222222);
  renderer.toneMapping=T.NoToneMapping;
  renderer.debug.onShaderError=(gl,program,vs,fs)=>{
    console.error(gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs));
  };
  const camera=new T.PerspectiveCamera(47,1,0.18,48000);
  const time={value:8}, glass={value:0}, sun={value:new T.Vector3(.31,.51,.802).normalize()};
  const lighting = {uTime:time,uGlass:glass,sun};
  const images={};
  const ids=['near-height','far-height','reach-height','detail-height','near-surface','far-surface','detail-surface',
    'sky-plate','flow','gravel','cobbles','mountain-relief','canopy','geology','rock','ground','scree','crowns','half-ground','half-relief',
    'prop-rock','prop-ground'];
  const coatIds=['coat-side','coat-top','coat-front','coat-rear','coat-head'];
  const [loaded,coatLoaded,coords,half,riverLevelData,crownPositions] = await Promise.all([
    Promise.all(ids.map(loadImage)),
    Promise.all(coatIds.map(loadImage)),
    inflate(asset('flow-coordinates')),
    inflate(survey.data),
    loadFloatAsset('river-level'),
    loadFloatAsset('crown-positions')
  ]);
  ids.forEach((id,i)=>{images[id]=loaded[i];});
  const coatTextures={
    'coat_side.jpg':coatLoaded[0],
    'coat_top.jpg':coatLoaded[1],
    'coat_front.jpg':coatLoaded[2],
    'coat_rear.jpg':coatLoaded[3],
    'coat_head.jpg':coatLoaded[4]
  };
  function texture(name,repeat=false,packed=false) {
    const t=new T.Texture(images[name]);
    t.colorSpace=T.NoColorSpace;
    t.wrapS=t.wrapT=repeat?T.RepeatWrapping:T.ClampToEdgeWrapping;
    t.generateMipmaps=!packed;
    t.minFilter=packed?T.LinearFilter:T.LinearMipmapLinearFilter;
    t.magFilter=T.LinearFilter;
    t.anisotropy=Math.min(6,renderer.capabilities.getMaxAnisotropy());
    t.needsUpdate=true;
    return t;
  }
  const tex=Object.fromEntries(ids.filter(id=>!id.endsWith('height')||id==='reach-height').map(id=>[
    id,texture(id,id.startsWith('prop-')||['rock','ground','scree','cobbles'].includes(id),['flow','reach-height'].includes(id))
  ]));
  const U=name=>({value:tex[name]});
  const coordTexture=new T.DataTexture(coords,...config.river.flowSize,T.RGBAFormat);
  coordTexture.flipY=true;
  coordTexture.minFilter=coordTexture.magFilter=T.LinearFilter;
  coordTexture.needsUpdate=true;
  const heights=Object.fromEntries(['detail','reach','near','far'].map(k=>[k,imageGrid(images[k+'-height'],config[k].bounds)]));
  const [rw,rh]=config.river.grid;
  const water=makeGrid(rw,rh,riverLevelData,config.river.bounds);
  const riverMask=pixels(images.flow);
  const covers=pixels(images.gravel);
  const halfValues=new Float32Array(survey.size**2);
  const halfBytes=new DataView(half.buffer,half.byteOffset,half.byteLength);
  for(let i=0;i<halfValues.length;i++)halfValues[i]=survey.meters*(survey.low+survey.range*halfBytes.getUint16(i*2,true)/65535);
  const halfSize=survey.span*survey.meters/2;
  const halfCenter=survey.center*survey.meters;
  const halfGrid=makeGrid(survey.size,survey.size,halfValues,[-halfSize,halfSize,-halfCenter-halfSize,-halfCenter+halfSize]);
  const tetonGround=(x,z)=> {
    for(const h of [heights.detail,heights.reach,heights.near])if(inside(h.bounds,x,z))return h.at(x,z);
    return heights.far.at(x,z);
  };
  function ridgeGround(x,z) {
    const original=halfGrid.at(x,z);
    const onPass=smooth(48,61,x)*(1-smooth(106,120,x));
    const gorge=smooth(-34,-31,z)*(1-smooth(2.9,5,z));
    const shoulder=smooth(-12,-2,z)*(1-smooth(18,38,z));
    const rootWall=1-smooth(-70.8,-68.5,z);
    const stone=onPass*(.23*Math.sin(.51*x+.19*z)*Math.sin(z*.35)+.12*Math.sin(z*1.62));
    return original+onPass*(-12.5*gorge+4.4*rootWall+shoulder*.44)+stone;
  }
  function maskAt(image,x,z,channel) {
    if(!inside(config.river.bounds,x,z))return 0;
    const [left,right,south,north]=config.river.bounds;
    const j=clamp(Math.floor((z+north)/(north-south)*image.height),0,image.height-1);
    const i=clamp(Math.floor((x-left)/(right-left)*image.width),0,image.width-1);
    return image.data[(j*image.width+i)*4+channel];
  }
  function wet(x,z) {
    return maskAt(riverMask,x,z,2)*160/255-32;
  }
  const skyUniforms={
    ...lighting,uSky:U('sky-plate'),uSkyRight:{value:new T.Vector3()},uSkyUp:{value:new T.Vector3()},
    uSkyForward:{value:new T.Vector3()},uSkyScale:{value:new T.Vector2()},uSkyShift:{value:new T.Vector2()}
  };
  const makeSky=()=> {
    const sky=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({
      uniforms:skyUniforms,vertexShader:skyVertex,fragmentShader:viewSkyFragment,depthTest:false,depthWrite:false
    }));
    sky.frustumCulled=false;
    sky.renderOrder=-1000;
    return sky;
  };
  function basis(view) {
    view.updateMatrixWorld();
    skyUniforms.uSkyRight.value.setFromMatrixColumn(view.matrixWorld,0);
    skyUniforms.uSkyUp.value.setFromMatrixColumn(view.matrixWorld,1);
    view.getWorldDirection(skyUniforms.uSkyForward.value);
    const m=view.projectionMatrix.elements;
    skyUniforms.uSkyScale.value.set(1/m[0],1/m[5]);
    skyUniforms.uSkyShift.value.set(-m[8],-m[9]);
  }
  function scene() {
    const world=new T.Scene();
    world.add(makeSky());
    world.add(new T.HemisphereLight(0xf2f0e9,0x414140,1.72));
    const light=new T.DirectionalLight(0xfffaf0,2.45);
    world.add(light);
    return {world,light};
  }
  const tetons=scene();
  const ridge=scene();
  const tetonMaterials={
    ...lighting,uUnlit:{value:0},uSky:U('sky-plate'),
    uRock:U('rock'),uGround:U('ground'),uScree:U('scree'),uCobbles:U('cobbles'),
    uFlow:U('flow'),uGravel:U('gravel'),uCanopy:U('canopy'),uGeology:U('geology'),
    uMountainRelief:U('mountain-relief'),
    uGeoBounds:{value:textureBounds(T,config.far.bounds)},uFlowBounds:{value:textureBounds(T,config.river.bounds)},
    uCanopyBounds:{value:textureBounds(T,config.canopy.bounds)},uMountainBounds:{value:textureBounds(T,config.mountainRelief)}
  };
  function addTerrain(world,geo,material,order=0) {
    const surface=new T.Mesh(geo,material);
    surface.renderOrder=order;
    world.add(surface);
    return surface;
  }
  const trim=(box,n)=>[box[0]+n,box[1]-n,box[2]+n,box[3]-n];
  function tetonLayer(k,width,height,cuts,texName,uvBounds,order) {
    const layer=heights[k];
    const material=new T.ShaderMaterial({
      uniforms:{...tetonMaterials,uSurface:U(texName)},vertexShader:meshVertex,fragmentShader:printTerrainFragment,
      polygonOffset:order>0,polygonOffsetFactor:-order,polygonOffsetUnits:-order
    });
    const geo=rasterMesh(T,layer.at,layer.bounds,width,height,{cuts,uvBounds});
    addTerrain(tetons.world,geo,material,order);
  }
  tetonLayer('far',295,479,[trim(config.near.bounds,120)],'far-surface',config.far.bounds,0);
  tetonLayer('near',321,341,[trim(config.detail.bounds,17),trim(config.reach.bounds,19)],'near-surface',config.near.bounds,1);
  tetonLayer('reach',500,207,[],'near-surface',config.near.bounds,2);
  tetonLayer('detail',161,161,[],'detail-surface',config.detail.bounds,3);
  const ridgeMaterial=new T.ShaderMaterial({
    uniforms:{...lighting,uSky:U('sky-plate'),uGround:U('ground'),uRock:U('rock'),uScree:U('scree'),
      uAerial:U('half-ground'),uRelief:U('half-relief'),uAerialBounds:{value:textureBounds(T,[-3000,3900,-600,7200])}},
    vertexShader:meshVertex,fragmentShader:ridgeFragment,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
  });
  const ridgeLocal=[-135,240,-110,195];
  const ridgeMid=[-680,980,-700,1120];
  addTerrain(ridge.world,rasterMesh(T,halfGrid.at,halfGrid.bounds,455,455,{cuts:[trim(ridgeMid,35)]}),ridgeMaterial,0);
  addTerrain(ridge.world,rasterMesh(T,ridgeGround,ridgeMid,220,240,{cuts:[trim(ridgeLocal,14)]}),ridgeMaterial,1);
  addTerrain(ridge.world,rasterMesh(T,ridgeGround,ridgeLocal,198,172),ridgeMaterial,2);
  const reflection=new T.WebGLRenderTarget(320,240);
  const mirror=new T.PerspectiveCamera();
  const reflectionMatrix=new T.Matrix4();
  const reflectionSize=new T.Vector2(320,240);
  const waterUniforms={
    ...tetonMaterials,uFlowCoordinates:{value:coordTexture},uReachBed:U('reach-height'),
    uReachBounds:{value:textureBounds(T,config.reach.bounds)},uForward:{value:new T.Vector3(-1,0,0)},
    uRight:{value:new T.Vector3(0,0,-1)},uUp:{value:new T.Vector3(0,1,0)},
    uShift:{value:new T.Vector2()},uTan:{value:.4},uAspect:{value:1.4},uReflectionCamera:{value:reflectionMatrix},
    uBankReflection:{value:reflection.texture},uReflectionSize:{value:reflectionSize}
  };
  const stream=new T.Mesh(rasterMesh(T,water.at,water.bounds,161,175),new T.ShaderMaterial({
    uniforms:waterUniforms,vertexShader:meshVertex,fragmentShader:riverFragment,alphaToCoverage:true
  }));
  stream.renderOrder=4;
  tetons.world.add(stream);
  let lastReflection=-Infinity;
  const reflectedEye=new T.Vector3();
  const plane=new T.Plane(), vec=new T.Vector4(), corner=new T.Vector4(), aim=new T.Vector3();
  function renderReflection(clock,width,height,level,viewCam) {
    if(clock-lastReflection<.155&&reflectedEye.distanceToSquared(viewCam.position)<2.25)return;
    lastReflection=clock;
    reflectedEye.copy(viewCam.position);
    const w=Math.min(450,Math.floor(width*.48)),h=Math.max(90,Math.floor(w*height/width));
    if(reflection.width!==w||reflection.height!==h)reflection.setSize(w,h);
    reflectionSize.set(w,h);
    mirror.position.set(viewCam.position.x,2*level-viewCam.position.y,viewCam.position.z);
    viewCam.getWorldDirection(aim);
    aim.y=-aim.y;
    mirror.up.set(0,-1,0);
    mirror.lookAt(aim.add(mirror.position));
    mirror.updateMatrixWorld();
    mirror.projectionMatrix.copy(viewCam.projectionMatrix);
    plane.setComponents(0,1,0,-level+.14);
    plane.applyMatrix4(mirror.matrixWorldInverse);
    vec.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
    const m=mirror.projectionMatrix.elements;
    corner.set((Math.sign(vec.x)+m[8])/m[0],(Math.sign(vec.y)+m[9])/m[5],-1,(1+m[10])/m[14]);
    vec.multiplyScalar(2/vec.dot(corner));
    m[2]=vec.x;m[6]=vec.y;m[10]=vec.z+1;m[14]=vec.w;
    reflectionMatrix.multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse);
    basis(mirror);
    stream.visible=false;
    renderer.setRenderTarget(reflection);
    try { renderer.render(tetons.world,mirror); }
    finally { stream.visible=true;renderer.setRenderTarget(null); }
  }
  const focusTarget=new T.WebGLRenderTarget(320,240,{samples:0});
  focusTarget.depthTexture=new T.DepthTexture(320,240,T.UnsignedIntType);
  const focusUniforms={
    uImage:{value:focusTarget.texture},uDepth:{value:focusTarget.depthTexture},uInverseViewProjection:{value:new T.Matrix4()},
    uPlane:{value:new T.Vector4()},uPixel:{value:new T.Vector2()}
  };
  const screen=new T.Scene();
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({
    uniforms:focusUniforms,vertexShader:skyVertex,fragmentShader:focusFragment,depthTest:false,depthWrite:false
  }));
  quad.frustumCulled=false;
  screen.add(quad);
  const screenCamera=new T.Camera();
  const memory=new T.Vector2();
  let width=0,height=0,scale=.85;
  const stage=el('monolith');
  function resize() {
    const w=Math.max(300,Math.min(1340,Math.round(stage.clientWidth*scale))),h=Math.max(240,Math.round(w*stage.clientHeight/stage.clientWidth));
    if(width!==w||height!==h) {
      width=w;height=h;
      renderer.setSize(w,h,false);
      camera.aspect=stage.clientWidth/stage.clientHeight;
      camera.updateProjectionMatrix();
      lastReflection=-Infinity;
    }
  }
  function renderView(region,clock,options,viewCam=camera,rw=width,rh=height) {
    time.value=clock+options.weatherTime;
    glass.value=options.glass;
    sun.value.set(...options.sun).normalize();
    tetons.light.position.copy(sun.value).multiplyScalar(100);
    ridge.light.position.set(-sun.value.z,sun.value.y,-sun.value.x).multiplyScalar(100);
    const current=region==='ridge'?ridge:tetons;
    if(region!=='ridge') {
      const refY=region==='overlook'&&lastReflection===-Infinity?65.5:water.at(clamp(viewCam.position.x,-1620,-240),clamp(viewCam.position.z,-400,400));
      renderReflection(clock,rw,rh,refY,viewCam);
    }
    basis(viewCam);
    waterUniforms.uForward.value.copy(skyUniforms.uSkyForward.value);
    waterUniforms.uRight.value.copy(skyUniforms.uSkyRight.value);
    waterUniforms.uUp.value.copy(skyUniforms.uSkyUp.value);
    waterUniforms.uTan.value=Math.tan(viewCam.fov*Math.PI/360);
    waterUniforms.uAspect.value=viewCam.aspect;
    if(options.plane) {
      if(focusTarget.width!==rw||focusTarget.height!==rh)focusTarget.setSize(rw,rh);
      focusUniforms.uPixel.value.set(1/rw,1/rh);
      focusUniforms.uPlane.value.set(...options.plane);
      focusUniforms.uInverseViewProjection.value.multiplyMatrices(viewCam.matrixWorld,viewCam.projectionMatrixInverse);
      renderer.setRenderTarget(focusTarget);
      renderer.render(current.world,viewCam);
      renderer.setRenderTarget(null);
      renderer.render(screen,screenCamera);
    } else renderer.render(current.world,viewCam);
  }
  function render(region,clock,options) {
    const before=performance.now();
    resize();
    renderView(region,clock,options,camera,width,height);
    const took=performance.now()-before;
    if(renderer.getSize(memory).x>470&&took>42)scale=Math.max(.52,scale-.08);
    else if(took<13&&scale<.85)scale=Math.min(.85,scale+.02);
  }
  function captureView(region,clock,options,viewCam,w=640,h=512) {
    width=0;
    renderer.setSize(w,h,false);
    lastReflection=-Infinity;
    renderView(region,clock,options,viewCam,w,h);
    const out=document.createElement('canvas');
    out.width=w;out.height=h;
    out.getContext('2d').drawImage(renderer.domElement,0,0,w,h);
    resize();
    renderView(region,clock,options,camera,width,height);
    return out;
  }
  return {
    T,renderer,camera,tetons:tetons.world,ridge:ridge.world,lighting,tex,coatTextures,render,captureView,tetonGround,ridgeGround,
    water:(x,z)=>water.at(x,z),wet,
    gravel:(x,z)=>maskAt(covers,x,z,1)/255,
    bankCovers:(x,z)=>maskAt(covers,x,z,0)/255,
    crowns:crownPositions
  };
}

function environment(world) {
  const {T,tex,coatTextures,lighting,tetonGround,ridgeGround,tetons,ridge}=world;
  const TETON_ROUTE=[[-22,-3],[-20,-42],[-11,-98],[-3,-162],[-48,-168],[-98,-162],[-156,-120],[-202,-78],[-228,-54],[-248,-55],[-276,-55],[-371,-55],[-390,-55],[-425,-60]];
  const OXBOW_ROUTE=[[-425,-60],[-475,-5],[-518,94],[-540,145],[-565,190],[-685,120],[-790,-35]];
  const RIDGE_ROUTE=[[76,28],[75,6],[75,-31],[75,-68],[75,-87]];
  const RIDGE_SHOULDER=[[82,22],[142,4],[166,-34],[144,-84],[110,-155],[75,-245]];
  const metal=new T.MeshStandardMaterial({color:0xaaa59a,roughness:.42,metalness:.49});
  const iron=new T.MeshStandardMaterial({color:0x333532,roughness:.62,metalness:.64});
  const pale=new T.MeshStandardMaterial({color:0xc8c2b3,roughness:.86});
  const dark=new T.MeshStandardMaterial({color:0x232421,roughness:1});
  const brass=new T.MeshStandardMaterial({color:0xb0a792,roughness:.36,metalness:.72});
  const walnut=new T.MeshStandardMaterial({color:0x42403c,roughness:.62,map:tex['prop-ground']});
  const rockMaterial=new T.MeshStandardMaterial({color:0x7e7e7e,map:tex['prop-rock'],roughness:.93});
  const wood=new T.MeshStandardMaterial({color:0x505050,map:tex['prop-ground'],roughness:.88});
  const solids=[];
  function add(group,geo,mat,x,y,z,sx=1,sy=1,sz=1) {
    const mesh=new T.Mesh(geo,mat);
    mesh.position.set(x,y,z);
    mesh.scale.set(sx,sy,sz);
    group.add(mesh);
    return mesh;
  }
  const block=new T.BoxGeometry(1,1,1), ball=new T.SphereGeometry(1,28,20);
  const cylinder=new T.CylinderGeometry(1,1,1,16);
  const ringGeo=new T.TorusGeometry(1,.09,12,48);
  function box(group,mat,x,y,z,sx,sy,sz) {return add(group,block,mat,x,y,z,sx,sy,sz);}
  function rock(group,mat,x,y,z,sx,sy,sz,angle=0) {
    const piece=add(group,boulderGeometry,mat,x,y,z,sx,sy,sz);
    piece.rotation.y=angle;
    return piece;
  }
  const boulderGeometry=new T.IcosahedronGeometry(1,1);
  function line(group,mat,a,b,thickness) {
    const p=new T.Vector3(...a),q=new T.Vector3(...b),vector=q.clone().sub(p);
    const joint=p.clone().lerp(q,.5);
    const part=add(group,cylinder,mat,joint.x,joint.y,joint.z,thickness,vector.length(),thickness);
    part.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vector.normalize());
    return part;
  }
  function cairn(group,ground,x,z,kind) {
    const y=ground(x,z);
    const g=new T.Group();
    g.position.set(x,y,z);
    group.add(g);
    rock(g,rockMaterial,0,.19,0,.55,.37,.45,.5);
    rock(g,rockMaterial,-.07,.59,.04,.40,.28,.37,1.7);
    rock(g,rockMaterial,.04,.88,.00,.27,.23,.27,2.1);
    if(kind==='solar'){
      add(g,cylinder,metal,0,1.24,0,.085,.42,.085);
      const dial=add(g,ringGeo,metal,0,1.66,0,.34,.34,.34);
      dial.rotation.y=Math.PI*.24;
      add(g,ball,pale,0,1.65,0,.095,.095,.095);
      line(g,iron,[-.24,1.65,.0],[.19,1.79,.0],.020);
    } else if(kind==='focus'){
      add(g,cylinder,metal,0,1.26,0,.08,.48,.08);
      const rim=add(g,ringGeo,metal,0,1.64,0,.29,.29,.29);
      rim.rotation.x=Math.PI*.39;
      line(g,iron,[-.29,1.68,0],[.29,1.68,0],.026);
    } else {
      add(g,ball,pale,0,1.15,0,.13,.15,.11);
    }
    solids.push({region:group===tetons?'tetons':'ridge',x,z,r:.65});
    return g;
  }
  function trail(group,ground,points,spacing) {
    for(let k=0;k<points.length-1;k++){
      const [ax,az]=points[k],[bx,bz]=points[k+1];
      const len=Math.hypot(bx-ax,bz-az);
      for(let step=spacing;step<len;step+=spacing) {
        const t=step/len;
        const x=mix(ax,bx,t)-(bz-az)/len*1.55;
        const z=mix(az,bz,t)+(bx-ax)/len*1.55;
        if(group===tetons&&world.wet(x,z)>-1.5)continue;
        rock(group,rockMaterial,x,ground(x,z)+.09,z,.28,.22,.22,k+step);
      }
    }
  }
  trail(tetons,tetonGround,TETON_ROUTE,9.5);
  trail(tetons,tetonGround,OXBOW_ROUTE,14);
  trail(ridge,ridgeGround,RIDGE_ROUTE,5.6);
  trail(ridge,ridgeGround,RIDGE_SHOULDER,11);

  /* Overlook Survey Deck + ramp onto the moraine bluff rim */
  const deckGroup=new T.Group();
  tetons.add(deckGroup);
  const DECK_Y=156.31;
  box(deckGroup,wood,-36.5,DECK_Y-.14,1.35,23.6,.24,7.8);
  for(let i=0;i<14;i++){
    const px=-47.8+i*1.75;
    box(deckGroup,walnut,px,DECK_Y-.01,1.35,.12,.03,7.7);
  }
  for(const z of [-2.4,5.1]){
    box(deckGroup,wood,-36.5,DECK_Y+.04,z,23.6,.09,.16);
  }
  box(deckGroup,wood,-48.25,DECK_Y+.04,1.35,.16,.09,7.8);
  for(const x of [-47.4,-40,-32.5,-25.4])for(const z of [-2.1,4.8]){
    const gy=tetonGround(x,z)-1.2;
    const h=Math.max(1,DECK_Y-gy);
    box(deckGroup,iron,x,gy+h/2,z,.26,h,.26);
  }
  const ramp=box(deckGroup,wood,-22.2,155.8,1.35,5.5,.22,7.6);
  ramp.rotation.z=-.18;
  /* Trailhead sign */
  {
    const px=-21.4,pz=-4.1,py=tetonGround(px,pz);
    const sg=new T.Group();sg.position.set(px,py,pz);sg.rotation.y=-.5;deckGroup.add(sg);
    box(sg,wood,0,.85,0,.12,1.72,.12);
    const sc=document.createElement('canvas');sc.width=256;sc.height=128;
    const sx=sc.getContext('2d');sx.fillStyle='#5c5952';sx.fillRect(0,0,256,128);
    sx.strokeStyle='#1d1c19';sx.lineWidth=6;sx.strokeRect(8,8,240,112);
    sx.fillStyle='#ece6d9';sx.textAlign='center';sx.font='600 17px Georgia,serif';
    sx.fillText('SNAKE RIVER OVERLOOK',128,48,220);sx.font='15px Georgia,serif';
    sx.fillText('BLUFF TRAIL  ↘  FORD',128,88,220);
    const st=new T.CanvasTexture(sc);st.colorSpace=T.NoColorSpace;
    const sign=new T.Mesh(new T.BoxGeometry(.95,.46,.04),new T.MeshStandardMaterial({map:st,roughness:.9}));
    sign.position.set(0,1.52,.085);sg.add(sign);
    solids.push({region:'tetons',x:px,z:pz,r:.45});
  }

  function addTrees(group,data) {
    if(!data.length)return;
    const g=new T.PlaneGeometry(1,1);
    const mat=new T.ShaderMaterial({
      uniforms:{...lighting,uSky:{value:tex['sky-plate']},uCrowns:{value:tex.crowns}},
      vertexShader:gameBillboardVertex,fragmentShader:gameBillboardFragment,side:T.DoubleSide
    });
    const mesh=new T.InstancedMesh(g,mat,data.length);
    const o=new T.Object3D(), seed=new Float32Array(data.length);
    data.forEach(([x,y,z,h,w,mark],i)=>{
      o.position.set(x,y-.06,z);o.scale.set(w,h,1);o.updateMatrix();
      mesh.setMatrixAt(i,o.matrix);seed[i]=mark;
    });
    g.setAttribute('aSeed',new T.InstancedBufferAttribute(seed,1));
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius+=25;
    group.add(mesh);
  }
  const random=seedRandom(77269);
  const forest=[];
  for(let i=0;i<world.crowns.length;i+=5) {
    const [x,_,z,raw,cover]=world.crowns.subarray(i,i+5);
    if(world.wet(x,z)>.4||random()<.19)continue;
    if(x>-450&&x<-205&&Math.abs(z+54)<9)continue;
    if(x>-120&&x<-12&&z>-180&&z<15)continue;
    const bar=world.bankCovers(x,z);
    if(bar>.29&&random()<.81)continue;
    const h=Math.min(raw,27)*(bar>.19?.43:.86+.13*random());
    const id=h>10?(random()<.70?0:3):h>6?(random()<.51?10:6):8;
    forest.push([x,tetonGround(x,z),z,h,h*config.crownRatios[id]*(.71+cover*.19),id+random()*.995]);
  }
  for(let i=0;i<7400;i++){
    const x=-720+random()*444,z=-168+random()*344;
    const bar=world.bankCovers(x,z);
    if(bar<.08||world.wet(x,z)>-1.6||Math.abs(z+55)<4.5||random()>world.gravel(x,z)*.48)continue;
    const h=.40+4.3*random()**1.4;
    forest.push([x,tetonGround(x,z),z,h,h*1.38,8+random()*1.98]);
  }
  addTrees(tetons,forest);
  const grove=[];
  for(let i=0;i<4400;i++){
    const x=-2050+random()*5150,z=-1970+random()*2200,y=ridgeGround(x,z);
    if(y>700||(x>58&&x<98&&z>-102&&z<44))continue;
    const grade=Math.abs(ridgeGround(x+6,z)-y)+Math.abs(ridgeGround(x,z+6)-y);
    if(grade>6||random()<.23)continue;
    const h=4.7+20*random()**1.5;
    grove.push([x,y,z,h,h*(.48+.31*random()),(random()<.71?0:10)+random()*1.91]);
  }
  for(const [x,z,h] of [[62,11,16],[92,20,18],[89,-10,12],[64,-39,19],[89,-45,22],[64,-77,15],[100,-93,19]]) {
    grove.push([x,ridgeGround(x,z),z,h,h*.58,1+random()*.99]);
  }
  addTrees(ridge,grove);

  function stones(group,ground,count,bounds,regionName) {
    const [x0,x1,z0,z1]=bounds;
    const mesh=new T.InstancedMesh(boulderGeometry,rockMaterial,count);
    const o=new T.Object3D(), color=new T.Color();
    let placed=0,tries=0;
    while(placed<count&&tries<count*8) {
      tries++;
      const x=mix(x0,x1,random()),z=mix(z0,z1,random());
      const s=.073+(random()**3.3)*.84;
      if(group===tetons&&(world.wet(x,z)>-.5||(x>-52&&x<-18&&z>-8&&z<10)))continue;
      if(group===ridge&&x>67&&x<83&&z>-32&&z<5)continue;
      o.position.set(x,ground(x,z)+s*.11,z);
      o.rotation.set(random()*.62,random()*6.28,random()*.82);
      o.scale.set(s*(1.16+random()*.82),s*(.29+random()*.55),s*(.81+random()*.82));o.updateMatrix();
      mesh.setMatrixAt(placed,o.matrix);
      color.setScalar(.42+random()*.69);
      mesh.setColorAt(placed,color);
      if(s>.58)solids.push({region:regionName,x,z,r:s*.92});
      placed++;
    }
    mesh.count=placed;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  stones(tetons,tetonGround,850,[-460,-200,-114,22],'tetons');
  stones(tetons,tetonGround,1100,[-960,-15,-220,230],'tetons');
  stones(ridge,ridgeGround,720,[37,118,-119,61],'ridge');
  stones(ridge,ridgeGround,950,[-280,460,-340,210],'ridge');

  const fordShader=new T.ShaderMaterial({
    transparent:true,depthWrite:false,side:T.DoubleSide,
    uniforms:{uTime:lighting.uTime,uCobbles:{value:tex.cobbles},uFordSolid:{value:0},uFordZone:{value:9}},
    vertexShader:meshVertex,
    fragmentShader:`
      varying vec3 vWorld;
      varying vec2 vUV;
      uniform sampler2D uCobbles;
      uniform float uTime,uFordSolid,uFordZone;
      ${noiseGLSL}
      void main() {
        vec2 p=vWorld.xz;
        float tremor=fbm(p*1.36+vec2(uTime*.12,0.));
        float chips=fbm(p*vec2(2.9,4.2)+7.3);
        float edge=1.-smoothstep(.39,.50,abs(vUV.y-.5)+.13*(chips-.5));
        float ends=smoothstep(.0,.06,vUV.x)*(1.-smoothstep(.94,1.,vUV.x));
        float grit=texture2D(uCobbles,p*.82).r;
        float flow=noise2(vec2(p.x*.93,p.y*5.-uTime*2.8));
        float glint=pow(flow*.69+tremor*.31,3.);
        float fractures=abs(sin(p.y*2.3+p.x*.89+fbm(p*.59)*5.3))*abs(sin(p.y*1.8-p.x*1.03+chips*3.1));
        float cracks=(1.-smoothstep(.005,.057,fractures))*smoothstep(.22,.69,chips);
        float rims=smoothstep(.26,.49,abs(vUV.y-.5))*smoothstep(.34,.66,chips);
        float frost=.18+.19*grit+.23*cracks+.14*rims+.083*chips+.028*(uFordZone-5.);
        float glare=.53+.22*glint+.05*grit+.028*(uFordZone-7.);
        float value=mix(glare,frost,uFordSolid);
        gl_FragColor=vec4(vec3(paper(clamp(value,0.,.97))),edge*ends*(.63+.35*uFordSolid));
      }
    `
  });
  const fordPatch=new T.Mesh(rasterMesh(T,(x,z)=>world.water(x,z)+.11,[-360,-279,50.5,59.5],106,15),fordShader);
  fordPatch.renderOrder=8;
  tetons.add(fordPatch);
  const oxbowRiffle=new T.Mesh(rasterMesh(T,(x,z)=>world.water(x,z)+.11,[-585,-470,-182,-132],64,28),fordShader);
  oxbowRiffle.renderOrder=8;
  tetons.add(oxbowRiffle);

  for(const x of [-274,-367])for(const z of [-60,-50]) {
    const y=tetonGround(x,z);
    box(tetons,dark,x,y+.46,z,.14,.94,.14);
    box(tetons,pale,x,y+.87,z,.185,.14,.184);
    solids.push({region:'tetons',x,z,r:.3});
  }
  cairn(tetons,tetonGround,-246,-54.8,'solar');
  cairn(tetons,tetonGround,-426,-62,'end');
  cairn(tetons,tetonGround,-518,94,'solar');
  cairn(tetons,tetonGround,-790,-35,'end');
  const reliefPillar=rock(ridge,rockMaterial,63,ridgeGround(63,-8)+4.3,-8,6.6,7.5,4.9,1.1);
  reliefPillar.rotation.z=.23;
  cairn(ridge,ridgeGround,75,8,'solar');
  cairn(ridge,ridgeGround,75,-42,'focus');
  cairn(ridge,ridgeGround,75,-88,'end');
  cairn(ridge,ridgeGround,220,-45,'solar');

  const bridgeHeight=(x,z)=>mix(ridgeGround(x,-34),ridgeGround(x,5.3),clamp((z+34)/39.3,0,1))+.065;
  const bridgeGeometry=rasterMesh(T,bridgeHeight,[70.5,79.5,-5.3,34],18,87);
  const bridgeMat=new T.ShaderMaterial({
    transparent:true,side:T.DoubleSide,depthWrite:false,
    uniforms:{...lighting,uRock:{value:tex.rock},uCloudSolid:{value:0}},
    vertexShader:meshVertex,
    fragmentShader:`
      varying vec3 vWorld;
      varying vec2 vUV;
      uniform sampler2D uRock;
      uniform float uTime,uCloudSolid;
      ${noiseGLSL}
      void main(){
        float edge=1.-smoothstep(.33,.50,abs(vUV.x-.5));
        float stone=texture2D(uRock,vWorld.xz*.51).r;
        float billow=fbm(vWorld.xz*.37+vec2(uTime*.12,0.));
        float ash=.51+.20*billow;
        float mass=(.046+.17*stone)*(.63+.65*billow);
        float alpha=mix(.37*(.3+.7*billow),.96,uCloudSolid)*edge;
        gl_FragColor=vec4(vec3(paper(mix(ash,mass,uCloudSolid))),alpha);
      }
    `
  });
  const cloud=new T.Mesh(bridgeGeometry,bridgeMat);
  cloud.renderOrder=8;
  ridge.add(cloud);
  const slabs=new T.Group();
  const slabMaterial=new T.MeshStandardMaterial({color:0x373737,roughness:.94,map:tex['prop-rock']});
  ridge.add(slabs);
  for(let j=0;j<26;j++) {
    const z=-33+j*1.52;
    for(const edge of [-1,1]) {
      const x=75+edge*(2.78+random()*.82);
      const slab=rock(slabs,slabMaterial,x,bridgeHeight(x,z)-.53,z,1.02+random()*.76,.43+random()*.37,1.18+random()*.58,random()*3.1);
      slab.rotation.z=(random()-.5)*.49;
    }
  }
  const mist=new T.Group();
  for(let j=0;j<14;j++) {
    const z=-31+j*2.85;
    const x=75+(random()-.5)*3.9;
    const m=new T.MeshBasicMaterial({color:0xd4d2ca,transparent:true,opacity:.061,depthWrite:false});
    const cloudlet=add(mist,ball,m,x,bridgeHeight(x,z)-1.1,z,4+random()*2,.65+random()*1.1,2.7+random()*2);
    cloudlet.userData.z=z;
  }
  ridge.add(mist);
  const gate=new T.Group();
  gate.position.set(75,ridgeGround(75,-49),-49);
  ridge.add(gate);
  for(const side of [-1,1]) {
    rock(gate,rockMaterial,side*3.25,1.58,0,1.23,2.34,1.4,random()*2);
    box(gate,iron,side*2.65,1.56,0,.19,3.38,.19);
  }
  const gateBars=new T.Group();
  gate.add(gateBars);
  const barMaterial=iron.clone();
  for(let i=-7;i<=7;i++){
    const x=i*.337;
    box(gateBars,barMaterial,x,1.51,0,.073,3.06,.078);
    const tip=add(gateBars,new T.ConeGeometry(.077,.20,5),barMaterial,x,3.11,0);
    tip.rotation.y=.79;
  }
  for(const y of [.44,1.42,2.75])box(gateBars,barMaterial,0,y,.045,5.27,.13,.10);
  line(gateBars,barMaterial,[-2.48,.46,0],[2.48,2.73,0],.049);
  line(gateBars,barMaterial,[2.48,.46,0],[-2.48,2.73,0],.049);
  const hinge=add(gateBars,ringGeo,metal,.10,1.58,.14,.15,.15,.15);
  hinge.rotation.y=.1;

  const outlet=new T.Group();
  ridge.add(outlet);
  const outletFloor=ridgeGround(75,-89);
  const screenMaterial=new T.MeshStandardMaterial({color:0x716b62,roughness:.72,metalness:.48});
  const surveyScreen=new T.Group();
  surveyScreen.position.set(75,outletFloor+.05,-91.4);
  ridge.add(surveyScreen);
  for(const side of [-1,1]) {
    rock(outlet,rockMaterial,75+side*2.12,outletFloor+.54,-91.5,1.33,1.02,1.4,side*.32);
    box(surveyScreen,iron,side*1.58,.95,0,.14,2.04,.16);
  }
  box(surveyScreen,screenMaterial,0,.87,0,3.12,1.76,.09);
  for(let i=-6;i<=6;i++)box(surveyScreen,iron,i*.226,.87,.067,.045,1.73,.067);
  box(surveyScreen,iron,0,1.77,.06,3.16,.11,.16);
  box(surveyScreen,iron,0,.20,.06,3.16,.08,.10);
  const outletWater=new T.Mesh(rasterMesh(T,(x,z)=>ridgeGround(x,z)+.14,[76.5,79.2,84.5,101],14,44),new T.ShaderMaterial({
    uniforms:{uTime:lighting.uTime},vertexShader:meshVertex,side:T.DoubleSide,
    fragmentShader:`
      varying vec3 vWorld;
      varying vec2 vUV;
      uniform float uTime;
      ${noiseGLSL}
      void main(){
        float edge=abs(vUV.x-.5);
        if(edge>.46+.027*sin(vWorld.z*5.3))discard;
        float ripples=fbm(vec2(vWorld.x*2.5,vWorld.z*4.0-uTime*4.1));
        gl_FragColor=vec4(vec3(paper(.39+.31*ripples+.21*smoothstep(.61,.80,ripples))),1.);
      }
    `
  }));
  ridge.add(outletWater);
  outletWater.visible=false;
  let openedAt=Infinity;

  const roots=new T.Group();
  ridge.add(roots);
  const dormant=new T.Group();
  ridge.add(dormant);
  const rootBase=ridgeGround(75,-64.8);
  const rootCrest=ridgeGround(75,-71.2);
  const rootRise=Math.max(2,rootCrest-rootBase);
  function rootHeight(z) {return rootBase+rootRise*clamp((-z-64.8)/6.4,0,1);}
  for(const side of [-1,1]) {
    const t=side*1.83;
    line(dormant,wood,[75+t,rootBase-.11,-65],[75+t*1.66,rootCrest+.15,-72.5],.16);
    for(let j=0;j<4;j++){
      line(dormant,wood,[75+t,rootBase+.27+j*.49,-66.7-j*.61],[75+t*1.58,rootBase+.20+j*.57,-65.3-j*.55],.086);
    }
  }
  for(let j=0;j<14;j++) {
    const z=-64.81-j*.492;
    const y=rootHeight(z);
    const root=rock(roots,wood,75+(random()-.5)*.19,y-.10,z,2.30+.15*random(),.21+.043*random(),.38+.10*random(),random()*.18);
    root.rotation.z=(random()-.5)*.08;
    for(const side of [-1,1]) {
      const x=75+side*(2.21+.29*random());
      line(roots,wood,[x,y+.04,z],[x+side*.75,y-.80,z+.63],.09);
    }
  }

  /* Stronger procedural skinned Mistletoe */
  const donkey=window.makeDonkey({
    THREE:T,
    textures:coatTextures,
    shells:coarse.matches?6:12,
    monochrome:true,
    contactShadow:true,
    alwaysHalter:true
  });
  tetons.add(donkey.group);

  /* Picket stake + dynamic catenary lead rope */
  const picketGroup=new T.Group();
  add(picketGroup,cylinder,wood,0,.22,0,.028,.54,.028);
  const picketRing=add(picketGroup,ringGeo,iron,0,.44,0,.04,.04,.04);
  picketRing.rotation.x=Math.PI/2;
  tetons.add(picketGroup);

  const ROPE_SEGS=14;
  const ropePos=new Float32Array((ROPE_SEGS+1)*2*3);
  const ropeIdx=[];
  for(let i=0;i<ROPE_SEGS;i++){const a=i*2;ropeIdx.push(a,a+1,a+2,a+2,a+1,a+3);}
  const ropeGeo=new T.BufferGeometry();
  ropeGeo.setAttribute('position',new T.BufferAttribute(ropePos,3));
  ropeGeo.setIndex(ropeIdx);
  const leadRopeMesh=new T.Mesh(ropeGeo,new T.MeshBasicMaterial({color:0x6f6a5e,side:T.DoubleSide}));
  leadRopeMesh.frustumCulled=false;
  tetons.add(leadRopeMesh);

  /* Physical 3D ash tripod & 8x10 walnut field camera */
  const rigGroup=new T.Group();
  rigGroup.visible=false;
  tetons.add(rigGroup);
  const legPivots=[];
  const legGeo=new T.CylinderGeometry(.016,.011,1,7);
  legGeo.translate(0,-.5,0);
  for(let i=0;i<3;i++){
    const lp=new T.Group();
    const legMesh=new T.Mesh(legGeo,wood);
    lp.add(legMesh);
    rigGroup.add(lp);
    legPivots.push({pivot:lp,mesh:legMesh,ang:i*Math.PI*2/3+.3});
  }
  const rigHead=new T.Group();
  rigGroup.add(rigHead);
  add(rigHead,cylinder,brass,0,-.03,0,.06,.05,.06);
  box(rigHead,walnut,0,.01,.02,.24,.035,.48);
  const frontStd=new T.Group();frontStd.position.set(0,.16,.18);rigHead.add(frontStd);
  box(frontStd,walnut,0,0,0,.22,.26,.03);
  const lensBarrel=add(frontStd,cylinder,brass,0,.02,.04,.046,.07,.046);
  lensBarrel.rotation.x=Math.PI/2;
  const filterDiscMat=new T.MeshBasicMaterial({color:0xc6c4b9,transparent:true,opacity:.72,side:T.DoubleSide});
  const filterDisc=add(frontStd,new T.CircleGeometry(.04,18),filterDiscMat,0,.02,.078);
  const rearStd=new T.Group();rearStd.position.set(0,.16,-.16);rigHead.add(rearStd);
  box(rearStd,walnut,0,0,0,.25,.28,.04);
  const bellowsMesh=box(rigHead,dark,0,.16,.01,.19,.22,.32);
  const plateHolderSlot=box(rearStd,pale,0,.02,-.025,.21,.22,.02);
  const shutterBulb=add(frontStd,ball,dark,.09,-.12,.03,.022,.035,.022);

  function attachActorsToScene(sceneGroup) {
    sceneGroup.add(donkey.group);
    sceneGroup.add(picketGroup);
    sceneGroup.add(leadRopeMesh);
    sceneGroup.add(rigGroup);
  }
  function updateLeadRope(ax,ay,az,bx,by,bz,sag,visible) {
    leadRopeMesh.visible=visible;
    if(!visible)return;
    const dx=bx-ax,dz=bz-az,len=Math.hypot(dx,dz)||1;
    const rx=-dz/len*.011,rz=dx/len*.011;
    for(let i=0;i<=ROPE_SEGS;i++){
      const t=i/ROPE_SEGS;
      const drop=sag*Math.sin(Math.PI*t);
      const x=mix(ax,bx,t),y=mix(ay,by,t)-drop,z=mix(az,bz,t);
      const o=i*6;
      ropePos[o]=x-rx;ropePos[o+1]=y+.008;ropePos[o+2]=z-rz;
      ropePos[o+3]=x+rx;ropePos[o+4]=y-.008;ropePos[o+5]=z+rz;
    }
    ropeGeo.attributes.position.needsUpdate=true;
  }
  function updateCameraRigMesh(x,y,z,yaw,pitchRad,focus,tiltDeg,filterColor,groundFn) {
    rigGroup.position.set(x,y,z);
    const crownY=1.22;
    for(const L of legPivots){
      const a=L.ang-yaw;
      const fx=x+Math.sin(a)*.56,fz=z+Math.cos(a)*.56;
      const fy=groundFn(fx,fz);
      L.pivot.position.set(Math.sin(a)*.07,crownY,Math.cos(a)*.07);
      const target=new T.Vector3(fx-x,fy-y,fz-z).sub(L.pivot.position);
      const d=Math.max(.4,target.length());
      L.mesh.scale.set(1,d,1);
      L.pivot.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),target.normalize());
    }
    rigHead.position.set(0,crownY+.06,0);
    rigHead.rotation.set(pitchRad,yaw,0,'YXZ');
    const ext=.10+.22*focus;
    frontStd.position.z=ext;
    rearStd.position.z=-.16;
    rearStd.rotation.x=tiltDeg*Math.PI/180*.45;
    bellowsMesh.position.z=(frontStd.position.z+rearStd.position.z)/2;
    bellowsMesh.scale.set(.19,.22,Math.max(.08,frontStd.position.z-rearStd.position.z-.02));
    filterDiscMat.color.set(filterColor);
  }

  function lookOverlook() {
    const pos=config.camera.eye;
    const horizonForest=new T.Group();
    tetons.add(horizonForest);
    const planted=[];
    const camera=new T.PerspectiveCamera(config.camera.fov,config.aspect,1,42000);
    const a=config.camera.heading*Math.PI/180,b=config.camera.pitch*Math.PI/180;
    const d=new T.Vector3(Math.sin(a)*Math.cos(b),Math.sin(b),-Math.cos(a)*Math.cos(b));
    camera.position.fromArray(pos);camera.lookAt(camera.position.clone().add(d));
    const w=10000,h=w/config.aspect;
    camera.setViewOffset(w,h,-config.camera.shift[0]*w,-config.camera.shift[1]*h,w,h);
    camera.updateMatrixWorld();
    for(const [u,v,length,treeHeight] of [[.03,.96,88,15.4],[.07,1.01,96,19.6],[.11,.98,104,17],[.15,1.03,106,24],[.20,1.06,117,26],[.24,1.08,120,22],[.30,1.08,144,21],[.35,1.075,149,22],[.42,1.08,154,12],[.84,1.06,172,10]]) {
      const ray=new T.Vector3(2*u-1,1-2*v,.7).unproject(camera).sub(camera.position).normalize().multiplyScalar(length);
      const root=camera.position.clone().add(ray);
      planted.push([root.x,root.y,root.z,treeHeight,treeHeight*.63,random()*.97]);
    }
    addTrees(horizonForest,planted);
    return horizonForest;
  }
  const frameTrees=lookOverlook();

  return {
    donkey,picketGroup,leadRopeMesh,rigGroup,plateHolderSlot,shutterBulb,solids,
    attachActorsToScene,updateLeadRope,updateCameraRigMesh,
    frameTrees,roots,dormant,bridgeHeight,rootHeight,
    updateFord(solid,zone) {
      fordPatch.material.uniforms.uFordSolid.value=Number(solid);
      fordPatch.material.uniforms.uFordZone.value=zone;
    },
    updateCloud(solid,clock) {
      bridgeMat.uniforms.uCloudSolid.value=Number(solid);
      slabs.visible=solid;
      mist.visible=!solid;
      if(!solid)for(const p of mist.children)p.position.z=p.userData.z+Math.sin(clock*.56+p.userData.z)*.49;
    },
    updateGate(solid) {
      if(barMaterial.transparent===solid){
        barMaterial.transparent=!solid;
        barMaterial.needsUpdate=true;
      }
      barMaterial.opacity=solid?1:.18;
      barMaterial.depthWrite=solid;
      gateBars.renderOrder=solid?0:9;
    },
    updateOutlet(open,clock) {
      if(open)openedAt=Math.min(openedAt,clock);
      else openedAt=Infinity;
      const lowered=smooth(0,1.8,clock-openedAt);
      surveyScreen.position.y=outletFloor+.05-2.6*lowered;
      surveyScreen.visible=lowered<.999;
      outletWater.visible=lowered>.16;
      return lowered===1;
    }
  };
}

const filters=[
  {name:'Clear glass',short:'Clear',color:'#c6c4b9',stops:[0,0,0,0],tip:'Read the unfiltered landscape.'},
  {name:'Yellow #8',short:'Yellow',color:'#caaa56',stops:[.32,2.35,1.0,.12],tip:'Cools glare in the shallows.'},
  {name:'Orange #21',short:'Orange',color:'#ba7546',stops:[.48,3.2,1.9,.12],tip:'Holds deeper water at Zone VI.'},
  {name:'Red #25',short:'Red',color:'#a75d51',stops:[.7,1.15,4.6,-.5],tip:'Gives a shaded cloud weight.'},
  {name:'Green #58',short:'Green',color:'#859471',stops:[.27,1.1,.68,-2.5],tip:'Draws living roots into the light.'}
];
const sunStates=[
  {name:'High sun',clock:'12:40',description:'Short shadows',value:[.45,.83,.34],time:6.7},
  {name:'Storm break',clock:'16:15',description:'A narrow opening',value:[.31,.51,.802],time:8},
  {name:'Low sun',clock:'18:20',description:'A long cast shadow',value:[.72,.26,.63],time:14}
];
const VANTAGES=[
  {id:'overlook_deck',region:'teton',name:'Snake River Overlook',x:-46.3,z:1.4,note:'Adams’s 1942 deck above the bend'},
  {id:'bluff_switchback',region:'teton',name:'Moraine Switchback',x:-48,z:-168,note:'Mid-bluff bench above the cottonwoods'},
  {id:'silver_ford',region:'teton',name:'The Silver Ford',x:-246,z:-54.8,note:'Survey posts & crossing solar cairn'},
  {id:'cottonwood_oxbow',region:'teton',name:'North Cottonwood Oxbow',x:-518,z:94,note:'Upstream horseshoe bend of the Snake'},
  {id:'west_terrace',region:'teton',name:'Far-Bank Sage Terrace',x:-790,z:-35,note:'Open bench toward the Cathedral Group'},
  {id:'obsidian_notch',region:'ridge',name:'Granite Notch',x:75,z:8,note:'Cloud crossing below Half Dome'},
  {id:'east_shoulder',region:'ridge',name:'East Granite Apron',x:220,z:-45,note:'Wide amphitheater below the northwest face'},
  {id:'halfdome_spring',region:'ridge',name:'Ridge Observatory',x:75,z:-88,note:'Iron screen & outlet spring'}
];
const cargoItems=[
  {id:'camera',name:'8×10 view camera',note:'Walnut field camera in felt case',kg:9,slot:'L'},
  {id:'plates',name:'Glass plate box',note:'Two dozen 8×10 plates (fragile at a run)',kg:11,slot:'R'},
  {id:'holders',name:'Plate holders',note:'Six double mahogany holders',kg:6.5,slot:'L'},
  {id:'lenses',name:'Brass lenses',note:'250mm Cooke & compound shutter',kg:5,slot:'R'},
  {id:'filters',name:'Field glass discs',note:'Yellow, Orange, Red & Green filters',kg:1.5,slot:'L'},
  {id:'tripod',name:'Ash tripod',note:'Three-leg survey tripod lashed on top',kg:5.5,slot:'T'},
  {id:'tent',name:'Changing tent & cloth',note:'Light-tight loading sleeve & dark cloth',kg:3,slot:'T'},
  {id:'bedroll',name:'Bedroll & oilcloth',note:'Wool blanket roll for canyon camp',kg:4.5,slot:'T'},
  {id:'grain',name:'Oats sack',note:'Feed for Mistletoe on long traverses',kg:8,slot:'-'}
];
const SLOTS=[['L','Left'],['T','Top'],['R','Right'],['-','Camp']];
const STOPS=['f/11','f/16','f/22','f/32','f/45'];
const numerals=['0','I','II','III','IV','V','VI','VII','VIII','IX','X'];
const dialog=el('field-panel'), canvas=el('world'), motion=matchMedia('(prefers-reduced-motion: reduce)');
const coarse=matchMedia('(pointer:coarse)');
const testMode=new URLSearchParams(location.search).has('test');
let world, scenery, region='cover', loading=false, animation=0, elapsed=0, lastFrame=0, drawn=0, overlookLive=false;
let overlookMoved=false, overlookShift=1;
let needsFrame=true;
let inventory=0, selected=0, sunIndex=1, tilt=0, instrument=false, metering=false;
let campMarked=false, restored=false, packHeavy=false, seated=false, openingSpring=false;
let leadMode='tethered', stakePos={x:-23.5,z:-4.2}, saddleFirstPerson=false, paceLatch=0;
let camOrbit={yaw:Math.PI,relYaw:Math.PI,pitch:.22,dist:4.5};
let heading=-Math.PI/2, pitch=-.08, clearSeconds=0, noticeUntil=0, lastMeter='', lastMeterAt=0;
let player={x:-46.34576,z:1.36642,y:158.0}, checkpoint={x:-229,z:-54.3};
let lastAction=null, lastUi=0, plateShock=0, platesBroken=0;
const plates=[];
const discovered=new Set(['overlook_deck']);
const cameraRig={deployed:false,viewMode:false,x:0,y:0,z:0,yaw:0,pitch:-.05,focus:.56,stopIdx:1,inverted:true};
const keys=new Set();
let drag=null;
let tmpHalter,tmpSeat,tmpCam;

function isTetonRegion(r=region) {return r==='overlook'||r==='ford';}
function activeTerrainGround(x,z) {
  if(!world)return 0;
  if(region==='ridge')return world.ridgeGround(x,z);
  return world.tetonGround(x,z);
}
function regionData() {
  if(region==='ridge')return {chapter:'II · Yosemite',name:player.x>125?'East granite apron':'The granite face'};
  if(region==='overlook')return {chapter:'I · Grand Teton',name:'Snake River Overlook'};
  if(player.x>-195)return {chapter:'I · Grand Teton',name:player.x>-95?'Overlook rim':'Moraine bluff'};
  if(player.z>50&&player.x<-375)return {chapter:'I · Grand Teton',name:'North Cottonwood Oxbow'};
  if(player.x<-375)return {chapter:'I · Grand Teton',name:'Far-bank sage terrace'};
  return {chapter:'I · Grand Teton',name:'The silver ford'};
}
function setPanel(title, kicker, markup, wide=false) {
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  keys.clear();
  drag=null;
  dialog.classList.toggle('wide',wide);
  el('panel-title').textContent=title;
  el('panel-kicker').textContent=kicker;
  el('panel-body').innerHTML=markup;
  if(!dialog.open)dialog.showModal();
}
function addChoices(choices) {
  const list=document.createElement('div');list.className='panel-choices';
  for(const item of choices) {
    const btn=document.createElement('button');btn.type='button';btn.className='choice';
    const label=document.createElement('span');label.textContent=item.label;btn.append(label);
    if(item.note){
      const note=document.createElement('small');note.textContent=item.note;btn.append(note);
    }
    if(item.pressed!==undefined)btn.setAttribute('aria-pressed',String(item.pressed));
    btn.disabled=Boolean(item.disabled);
    btn.addEventListener('click',item.run);
    list.append(btn);
  }
  el('panel-body').append(list);
}
const credits=`<details class="credits"><summary>Scene sources</summary>
  <p>Ansel Adams, <cite>The Tetons – Snake River</cite>, 1942, National Archives 519904.
  <a href="https://www.archives.gov/research/still-pictures/highlights/the-tetons-snake-river" target="_blank" rel="noopener noreferrer">National Archives</a></p>
  <p>Grand Teton elevation and lidar, USGS 3DEP. Snake River channel, USGS NHD. Half Dome survey, USGS 3DEP. Aerial imagery, USDA NAIP.
  <a href="https://www.usgs.gov/3d-elevation-program" target="_blank" rel="noopener noreferrer">USGS 3DEP</a></p>
  <p>Rock Face 03, Aerial Rocks 02, Forest Floor, Leaf Scattered Gravel, fir, pine and shrub assets, Poly Haven CC0. Sky image by Mitchfeatherston, CC0.
  <a href="https://polyhaven.com/license" target="_blank" rel="noopener noreferrer">Poly Haven</a></p></details>`;
function openGuide() {
  const hint=region==='ridge'
    ?'Walk or ride Mistletoe through the Granite Notch (Zone II cloud, tilted iron gate, Zone V roots) or roam out across the East Granite Apron to frame Half Dome.'
    :'Walk off the Overlook Survey Deck to meet Mistletoe on the rim, descend the Bluff Switchback Trail together (or press E at the deck rail for a quick descent), and cross the Snake River.';
  setPanel('Field guide','MONOLITH',
    `<p>${hint}</p>
    <table class="key-table"><tbody>
    <tr><th>Walk / Ride</th><td>W A S D (Shift to trot · pace button for canter/gallop)</td></tr>
    <tr><th>Look / Orbit</th><td>Drag the view or arrow keys. Click the view for mouse look; scroll zooms when riding.</td></tr>
    <tr><th>Use / Talk</th><td>E or the on-screen action</td></tr>
    <tr><th>Mistletoe</th><td>P opens pack &amp; mind · V toggles saddle / orbit camera · Space brays</td></tr>
    <tr><th>8×10 Camera</th><td>C unpacks tripod &amp; view camera anywhere on foot (Space exposes)</td></tr>
    <tr><th>Meter &amp; Map</th><td>F toggles spot meter · M opens topographic map &amp; plates</td></tr>
    <tr><th>Glass &amp; Tilt</th><td>1–5 select filter · Q / R tilt focal plane after collecting the ring</td></tr>
    <tr><th>Return to cairn</th><td>Backspace</td></tr>
    </tbody></table>
    <p class="quiet">Surfaces read from Zone 0 to Zone X. Zones 0–VI can support weight. Mistletoe weighs slope, pack balance, hunger, and trust before obeying.</p>${credits}`);
  if(region!=='cover')addChoices([
    {label:'Return to the last cairn',note:'Keep your field kit',run:()=>{dialog.close();recover(false);}},
    {label:'Restart at the opening print',run:()=>{dialog.close();titleScreen();}}
  ]);
}
function titleScreen() {
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  keys.clear();
  cancelAnimationFrame(animation);
  region='cover';
  el('cover').hidden=false;el('archive').hidden=false;canvas.hidden=true;el('hud').hidden=true;
  el('overlook-still').hidden=true;
  el('world').classList.remove('inverted');
  el('ground-glass').hidden=true;
  openingSpring=false;
  el('begin').focus();
}
function setLocation(next) {
  region=next;
  el('archive').hidden=true;
  el('overlook-still').hidden=true;
  el('cover').hidden=true;
  canvas.hidden=false;
  el('hud').hidden=false;
  el('touch-walk').hidden=!coarse.matches;
  const {chapter,name}=regionData();
  el('chapter').textContent=chapter;
  el('place').textContent=name;
  el('tilt-tools').hidden=!instrument||next!=='ridge';
  el('meter').disabled=false;
  el('glass').disabled=false;
  el('message').textContent='';
  noticeUntil=0;
  lastAction=null;
  lastUi=0;
  metering=false;el('readout').hidden=true;el('meter').setAttribute('aria-pressed','false');
  el('world').focus({preventScroll:true});
  drawn=0;
  needsFrame=true;
  lastFrame=performance.now();
}
function applyCargo() {
  if(!scenery)return {m:0,x:0,y:.95,z:0,L:0,R:0,T:0};
  const active=cargoItems.filter(it=>it.slot!=='-'&&!(cameraRig.deployed&&(it.id==='camera'||it.id==='tripod')));
  return scenery.donkey.setCargo(active);
}
function packCameraRig(quiet=false) {
  cameraRig.deployed=false;
  cameraRig.viewMode=false;
  el('ground-glass').hidden=true;
  el('world').classList.remove('inverted');
  if(scenery)scenery.rigGroup.visible=false;
  applyCargo();
  if(!quiet)say('8×10 camera and ash tripod packed back onto Mistletoe.');
}
function showOverlook() {
  setLocation('overlook');
  selected=0;sunIndex=1;seated=false;
  heading=config.camera.heading*Math.PI/180;pitch=config.camera.pitch*Math.PI/180;
  player={x:config.camera.eye[0],z:config.camera.eye[2],y:config.camera.eye[1]};
  checkpoint={x:-229,z:-54.3};
  overlookLive=false;overlookMoved=false;overlookShift=1;
  scenery.attachActorsToScene(world.tetons);
  leadMode='tethered';
  stakePos={x:-23.5,z:-4.2};
  scenery.donkey.place(stakePos.x,stakePos.z,Math.PI*.75,world.tetonGround);
  scenery.donkey.state.tethered=true;
  scenery.picketGroup.position.set(stakePos.x,world.tetonGround(stakePos.x,stakePos.z),stakePos.z);
  scenery.picketGroup.visible=true;
  packCameraRig(true);
  el('objective').textContent='Adams’s frame is the trailhead. Walk off the deck to meet Mistletoe, or press E to descend.';
  el('interaction').hidden=false;
  el('interaction').textContent='Descend to the ford · E';
  scenery.frameTrees.visible=true;
  el('overlook-still').src=asset('terrain-still');
  el('overlook-still').hidden=false;
  updateGlass();
}
function arriveAtFord(quick=true) {
  setLocation('ford');
  scenery.attachActorsToScene(world.tetons);
  scenery.frameTrees.visible=false;
  overlookMoved=true;overlookShift=0;
  packCameraRig(true);
  if(quick){
    heading=-Math.PI/2;pitch=-.045;
    player={x:-229,z:-54.3,y:world.tetonGround(-229,-54.3)+1.69};
    checkpoint={x:-229,z:-54.3};
    stakePos={x:-234.7,z:-55.7};
    leadMode='lead';
    scenery.donkey.place(stakePos.x,stakePos.z,.80,world.tetonGround);
    scenery.donkey.state.tethered=false;
    scenery.picketGroup.visible=false;
  }
  discovered.add('silver_ford');
  sunIndex=1;
  say('Follow the trail to Mistletoe.');
}
function arriveAtRidge() {
  setLocation('ridge');
  sunIndex=1;selected=0;seated=false;
  heading=-.095;pitch=.043;
  player={x:76,z:28,y:world.ridgeGround(76,28)+1.69};
  checkpoint={x:76,z:28};
  scenery.attachActorsToScene(world.ridge);
  packCameraRig(true);
  leadMode='lead';
  stakePos={x:78.5,z:31.5};
  scenery.donkey.place(78.5,31.5,Math.PI,world.ridgeGround);
  scenery.donkey.state.tethered=false;
  scenery.picketGroup.visible=false;
  discovered.add('obsidian_notch');
  scenery.updateOutlet(restored,elapsed);
  updateGlass();
  say('The storm has left a cloud in the notch. Mistletoe stands behind you on the bench.');
}
function blink(change) {
  if(loading)return;
  loading=true;
  keys.clear();
  const fade=el('fade');
  fade.classList.add('dark');
  setTimeout(()=>{
    try { change(); }
    finally {
      fade.classList.remove('dark');
      loading=false;
    }
  },motion.matches?0:320);
}
async function begin() {
  if(loading)return;
  loading=true;
  el('begin').disabled=true;
  el('loading').hidden=false;
  el('loading-text').textContent='Opening the terrain';
  try {
    if(!world){
      world=await loadWorld();
      tmpHalter=new world.T.Vector3();
      tmpSeat=new world.T.Vector3();
      tmpCam=new world.T.PerspectiveCamera(34,1.25,.18,48000);
      scenery=environment(world);
      wireDonkeyAudio();
    }
    inventory=0;selected=0;tilt=0;instrument=false;campMarked=false;restored=false;packHeavy=false;openingSpring=false;
    seated=false;platesBroken=0;plateShock=0;
    plates.length=0;
    el('plate-count').textContent='0';
    for(const it of cargoItems)if(it.id==='grain')it.slot='-';
    showOverlook();
    updateCamera();
    lastFrame=performance.now();
    animation=requestAnimationFrame(frame);
  } catch(error) {
    console.error(error);
    world=null;
    setPanel('The terrain needs WebGL 2','MONOLITH','<p>Open this HTML file directly in a recent browser with hardware acceleration enabled.</p>');
  } finally {
    el('loading').hidden=true;el('begin').disabled=false;loading=false;
  }
}
function updateCamera() {
  const {camera,T}=world;
  camera.rotation.order='YXZ';
  if(cameraRig.viewMode){
    camera.clearViewOffset();
    camera.fov=34;
    const lenPos=new T.Vector3(0,1.38,0).add(new T.Vector3(cameraRig.x,cameraRig.y,cameraRig.z));
    camera.position.copy(lenPos);
    camera.rotation.set(cameraRig.pitch,-cameraRig.yaw,0,'YXZ');
  } else if(region==='overlook'&&!overlookMoved){
    const sh=overlookShift;
    if(sh>.002){
      const w=10000,h=w/(el('monolith').clientWidth/el('monolith').clientHeight);
      camera.setViewOffset(w,h,-config.camera.shift[0]*w*sh,-config.camera.shift[1]*h*sh,w,h);
    } else camera.clearViewOffset();
    camera.fov=48;
    camera.position.set(player.x,player.y,player.z);
    const look=new T.Vector3(Math.sin(heading)*Math.cos(pitch),Math.sin(pitch),-Math.cos(heading)*Math.cos(pitch));
    camera.lookAt(camera.position.clone().add(look));
  } else if(seated){
    camera.clearViewOffset();
    const S=scenery.donkey.state;
    if(saddleFirstPerson){
      camera.fov=48;
      scenery.donkey.saddleAt(tmpSeat);
      camera.position.set(tmpSeat.x,tmpSeat.y+.62,tmpSeat.z);
      camera.rotation.set(pitch,-heading,0,'YXZ');
    } else {
      camera.fov=46;
      const lx=S.x,ly=S.y+1.06,lz=S.z;
      const cp=Math.cos(camOrbit.pitch);
      const cx=lx+Math.sin(camOrbit.yaw)*cp*camOrbit.dist;
      const cz=lz+Math.cos(camOrbit.yaw)*cp*camOrbit.dist;
      const cy=Math.max(ly+Math.sin(camOrbit.pitch)*camOrbit.dist,terrainAt(cx,cz)+.35);
      camera.position.set(cx,cy,cz);
      camera.lookAt(lx,ly,lz);
    }
  } else {
    camera.clearViewOffset();
    camera.fov=region==='ridge'?47:46;
    camera.position.set(player.x,player.y,player.z);
    camera.rotation.set(pitch,-heading,0,'YXZ');
  }
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
function activePlane() {
  if(cameraRig.viewMode){
    const blurAmt=Math.max(0,Math.abs(cameraRig.focus-.56)-.08)*1.8;
    if(blurAmt<=.01)return null;
    const dist=mix(4,75,cameraRig.focus*cameraRig.focus);
    const fx=Math.sin(cameraRig.yaw),fz=-Math.cos(cameraRig.yaw),fy=Math.sin(cameraRig.pitch);
    const s=Math.min(1,blurAmt)/(STOPS[cameraRig.stopIdx]==='f/45'?2.5:1);
    const px=cameraRig.x+fx*dist,py=cameraRig.y+1.38+fy*dist,pz=cameraRig.z+fz*dist;
    return [fx*s,fy*s,fz*s,-(fx*px+fy*py+fz*pz)*s];
  }
  return instrument&&region==='ridge'&&player.z<-34&&player.z>-63&&tilt!==0?focusPlane():null;
}
function render() {
  world.render(region,elapsed,{glass:selected,sun:sunStates[sunIndex].value,weatherTime:sunStates[sunIndex].time,plane:activePlane()});
}
function say(text) {
  el('message').textContent=text;
  noticeUntil=elapsed+5.6;
}
function recover(notice=true) {
  if(region==='cover')return;
  if(region==='overlook'){
    player={x:config.camera.eye[0],z:config.camera.eye[2],y:config.camera.eye[1]};
    return;
  }
  seated=false;
  cameraRig.viewMode=false;
  el('ground-glass').hidden=true;
  el('world').classList.remove('inverted');
  player.x=checkpoint.x;player.z=checkpoint.z;
  const floor=terrainAt(player.x,player.z);
  player.y=floor+1.69;
  clearSeconds=0;
  keys.clear();
  if(notice)say('Back at the last cairn.');
}
function openSolar() {
  checkpoint={x:player.x,z:player.z};
  setPanel('Set the solar arc','CAIRN CHRONOMETER',
    region==='ridge'?'<p>The cliff’s shadow lengthens as the sun falls. Read the cloud again after moving the dial.</p>':
      '<p>The high sun lifts the river into glare. The storm break makes it easier to bring the water into the walkable zones.</p>');
  addChoices(sunStates.map((state,index)=>({
    label:state.name,note:state.clock+' · '+state.description,pressed:index===sunIndex,
    run:()=>{sunIndex=index;dialog.close();say(state.name+' · '+state.clock);}
  })));
}
function openGlass() {
  if(region==='cover')return;
  if(inventory===0){say('The glass discs are in Mistletoe’s left pannier.');return;}
  setPanel('Choose a filter','FIELD GLASS','<p>Each disc changes the way a material responds to the light.</p>');
  addChoices(filters.map((f,i)=>({
    label:f.name,note:f.tip,pressed:i===selected,disabled:i>inventory,run:()=>{selectGlass(i);dialog.close();}
  })));
}
function updateGlass() {
  el('glass-name').textContent=filters[selected].name;
  el('glass').style.setProperty('--glass-color',filters[selected].color);
  el('tilt-value').textContent=(tilt>0?'+':'')+tilt+'°';
}
function selectGlass(i) {
  if(region==='cover')return;
  if(i>inventory){say('Collect this glass at the next field station or Mistletoe’s pannier.');return;}
  if(i===selected)return;
  selected=i;lastMeter='';
  el('message').textContent='';noticeUntil=0;
  updateGlass();
  audio.bell(zoneOf(currentTarget()?.target??(region==='ridge'?'cloud':'ford')));
}
function adjustTilt(amount) {
  if((!instrument&&!cameraRig.viewMode)||region==='cover')return;
  tilt=clamp(tilt+amount,-24,24);
  el('message').textContent='';noticeUntil=0;
  updateGlass();lastMeter='';
  audio.bell(Math.round((tilt+24)/4.8));
}
function focusPlane() {
  const angle=(67+tilt)*Math.PI/180;
  const a=Math.sin(angle), b=Math.cos(angle);
  return [0,a,b,36*b-24.5*a];
}
function gateInFocus() {
  if(!instrument)return true;
  const p=focusPlane();
  const y=world.ridgeGround(75,-49)+1.47;
  return Math.abs(p[1]*y-p[2]*49+p[3])<1.34;
}
function zoneOf(target) {
  const stops=filters[selected].stops;
  let value=5;
  switch(target) {
    case 'ford':value=[9.9,9.0,8.43][sunIndex]-stops[1];break;
    case 'cloud':value=[9.9,8.21,6.50][sunIndex]-stops[2];break;
    case 'roots':value=[1.4,2.12,2.05][sunIndex]-stops[3];break;
    case 'gate':value=[4.7,4.34,3.6][sunIndex]-stops[0];break;
    case 'snow':value=[10,8.9,8.25][sunIndex]-stops[2]*.38;break;
    case 'stone':value=[6.6,5.21,4.12][sunIndex]-stops[0];break;
  }
  return clamp(Math.round(value),0,10);
}
function fordSolid() {return zoneOf('ford')<=6;}
function cloudSolid() {return zoneOf('cloud')<=2;}
function rootsSolid() {return zoneOf('roots')>=4&&zoneOf('roots')<=6;}
function fordY(x,z) {return world.water(x,z)+.11;}
function near(x,z,r) {return Math.hypot(player.x-x,player.z-z)<=r;}
function currentTarget() {
  const forwardX=Math.sin(heading),forwardZ=-Math.cos(heading);
  const targets=region==='ridge'?[
    {target:'cloud',label:'Cloud in the notch',x:75,z:-12,r:12},
    {target:'gate',label:'Iron survey gate',x:75,z:-49,r:5},
    {target:'roots',label:'Juniper roots',x:75,z:-68,r:7}
  ]:[{target:'ford',label:'Water at the ford',x:-328,z:-55,r:31},
     {target:'ford',label:'Water at North Oxbow',x:-525,z:155,r:48}];
  for(const t of targets) {
    const dx=t.x-player.x,dz=t.z-player.z,d=Math.hypot(dx,dz);
    if(d<t.r*.44||d<150&&(dx*forwardX+dz*forwardZ)/d>Math.cos(Math.atan(t.r/Math.max(d,1))+.31)&&pitch<.34)return t;
  }
  return pitch>.12?{target:'snow',label:'Snow and sky'}:{target:'stone',label:'Trail stone'};
}
function refreshMeter() {
  if(!metering)return;
  const target=currentTarget();
  const zone=zoneOf(target.target);
  let status=zone<=2?'Dense shadow':zone<=6?'Stable midtones':zone===10?'Whiteout · impassable':'Glare · no footing';
  if(target.target==='ford'&&zone<=6)status='Set water · walkable';
  if(target.target==='cloud')status=cloudSolid()?'Obsidian · walkable':'Cloud · no footing';
  if(target.target==='gate')status=gateInFocus()?'Iron · solid':'Out of focus · passable';
  if(target.target==='roots')status=rootsSolid()?'Living steps · climbable':'Roots dormant';
  el('reading-name').textContent=target.label;
  el('reading-zone').textContent='Zone '+numerals[zone];
  el('reading-state').textContent=status;
  const note=target.target+zone+status;
  if(note!==lastMeter&&elapsed-lastMeterAt>.22){
    audio.bell(zone);
    lastMeter=note;lastMeterAt=elapsed;
  }
}
function toggleMeter() {
  if(region==='cover')return;
  metering=!metering;
  el('meter').setAttribute('aria-pressed',String(metering));
  el('readout').hidden=!metering;
  lastMeter='';refreshMeter();
}
function addGlassFromBurro() {
  inventory=Math.max(inventory,2);
  audio.bell(5);updateGlass();
  say('Yellow #8 and Orange #21 unpacked. Meter the glare before crossing.');
}
function openBurro() {
  if(region==='cover'||!scenery)return;
  const D=scenery.donkey, S=D.state, M=D.mind;
  const C=applyCargo();
  const pct=v=>Math.round(clamp(v,0,1)*100);
  const diff=C.L-C.R, tiltPct=clamp(50-clamp((C.x*C.m)/8,-1,1)*44,6,94);
  let verdict='Balanced side to side.';
  if(Math.abs(diff)>=2)verdict=`Lists ${diff>0?'left':'right'} by ${Math.abs(diff).toFixed(1)} kg — panniers and saddle pull sideways.`;
  if(C.m>56)verdict+=' Heavy overload: Mistletoe tires quickly and refuses to run.';
  else if(C.T>C.m*.45&&C.T>12)verdict+=' Top-heavy: load sways on slopes and turns.';
  if(S.turned)verdict='The saddle has turned under her belly! Re-saddle before moving on.';

  const rows=cargoItems.map(it=>{
    const deployed=cameraRig.deployed&&(it.id==='camera'||it.id==='tripod');
    const btns=SLOTS.map(([id,lbl])=>`<button type="button" data-item="${it.id}" data-slot="${id}" aria-pressed="${it.slot===id}">${lbl}</button>`).join('');
    return `<div class="pk-row${it.slot==='-'||deployed?' off':''}">
      <div><strong>${it.name}</strong> · ${it.kg.toFixed(1)} kg${deployed?' <em>(on tripod)</em>':''}<small>${it.note}</small></div>
      <div class="pk-seg">${btns}</div>
    </div>`;
  }).join('');

  setPanel('Mistletoe','PACK BURRO & MIND',
    `<p>Thought: <em>“${S.thought}”</em> · Gait: <strong>${S.label}</strong> · Mood: <strong>${D.moods.find(m=>m.id===S.mood)?.label||S.mood}</strong></p>
    <div class="mind-grid">
      <div class="mind-stat"><span>Stamina<b>${pct(S.stamina)}%</b></span><i><em style="width:${pct(S.stamina)}%"></em></i></div>
      <div class="mind-stat"><span>Trust<b>${pct(M.trust)}%</b></span><i><em style="width:${pct(M.trust)}%"></em></i></div>
      <div class="mind-stat"><span>Hunger<b>${pct(M.hunger)}%</b></span><i><em style="width:${pct(M.hunger)}%"></em></i></div>
      <div class="mind-stat"><span>Calm<b>${pct(1-M.fear)}%</b></span><i><em style="width:${pct(1-M.fear)}%"></em></i></div>
    </div>
    <div class="pk-summary"><b>${C.m.toFixed(1)} kg packed</b><span>Left ${C.L.toFixed(1)} · Top ${C.T.toFixed(1)} · Right ${C.R.toFixed(1)}</span></div>
    <div class="pk-beam" aria-hidden="true"><i></i><em style="left:${tiltPct}%"></em><span>Left</span><span>Right</span></div>
    <p class="quiet">${verdict}</p>
    <div id="pk-items">${rows}</div>`,true);

  el('panel-body').querySelectorAll('[data-item]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const item=cargoItems.find(x=>x.id===btn.dataset.item);
      if(item){item.slot=btn.dataset.slot;applyCargo();openBurro();}
    });
  });

  const acts=[
    {label:inventory<2?'Unpack the field glass':'Field glass discs',note:'Yellow #8 · Orange #21',
      run:()=>{dialog.close();addGlassFromBurro();}},
    {label:seated?'Dismount Mistletoe':'Mount Mistletoe',note:seated?'Return to walking':'Ride & drive (3rd-person orbit / V toggles)',
      run:()=>{dialog.close();mount(!seated);}},
    {label:leadMode==='tethered'?'Lead on rope':leadMode==='lead'?'Let roam & graze':'Tie to picket',
      note:leadMode==='tethered'?'Currently tied to stake':leadMode==='lead'?'Currently following on lead':'Currently grazing untied',
      run:()=>{
        if(seated)mount(false);
        if(leadMode==='tethered'){leadMode='lead';S.tethered=false;scenery.picketGroup.visible=false;say('Mistletoe follows on the lead.');}
        else if(leadMode==='lead'){leadMode='free';S.tethered=false;scenery.picketGroup.visible=false;say('Mistletoe grazes freely nearby.');}
        else{leadMode='tethered';S.tethered=true;stakePos={x:S.x,z:S.z};scenery.picketGroup.position.set(S.x,donkeyGroundAt(S.x,S.z),S.z);scenery.picketGroup.visible=true;say('Picket driven. Mistletoe waits on the line.');}
        dialog.close();
      }},
    {label:'Feed oats & soothe',note:'Restore trust, calm fear & reduce hunger',
      run:()=>{D.feed();D.soothe();dialog.close();say('Mistletoe munches oats and settles.');}},
    {label:S.downWant?'Rise up':'Lie down / rest',note:'Rest recovers stamina faster',
      run:()=>{D.lie();dialog.close();}}
  ];
  if(S.turned)acts.unshift({label:'Re-saddle & cinch',note:'Straighten the turned saddle',run:()=>{D.resaddle();dialog.close();say('Saddle cinched squarely.');}});
  addChoices(acts);
}
function mount(value) {
  if(value&&cameraRig.viewMode)stepBackFromGlass();
  if(value&&inventory<2)addGlassFromBurro();
  if(value&&region==='overlook'){
    overlookMoved=true;overlookShift=0;overlookLive=true;
    el('overlook-still').hidden=true;
    region='ford';scenery.frameTrees.visible=false;
    const {chapter,name}=regionData();
    el('chapter').textContent=chapter;el('place').textContent=name;
  }
  seated=value;
  const S=scenery.donkey.state;
  if(value){
    leadMode='free';S.tethered=false;scenery.picketGroup.visible=false;
    if(S.downWant)scenery.donkey.lie();
    player.x=S.x;player.z=S.z;
    heading=Math.PI-S.heading;
    camOrbit.relYaw=Math.PI;
    camOrbit.yaw=S.heading+Math.PI;
    say('Mounted on Mistletoe. Drive with WASD, Shift to trot, V switches view.');
  } else {
    leadMode='lead';S.tethered=false;
    const fx=Math.sin(S.heading),fz=Math.cos(S.heading);
    player.x=S.x-fz*1.2;player.z=S.z+fx*1.2;
    player.y=terrainAt(player.x,player.z)+1.69;
    say('Dismounted. Mistletoe stays on the lead.');
  }
}
function openCamp() {
  checkpoint={x:-419,z:-60};
  inventory=4;campMarked=true;seated=false;leadMode='tethered';
  stakePos={x:-417,z:-58};
  if(scenery){
    scenery.donkey.place(-417,-58,Math.PI*.4,world.tetonGround);
    scenery.donkey.state.tethered=true;
    scenery.picketGroup.position.set(-417,world.tetonGround(-417,-58),-58);
    scenery.picketGroup.visible=true;
  }
  setPanel('Across the Snake','FAR BANK',
    '<p>You held a crossing long enough to put it on the map. The next route is cut into the granite below Half Dome.</p><p>The cairn contains Red #25 and Green #58. Take both for the ridge, or keep riding the Snake River valley.</p>');
  addChoices([{label:'Continue to Half Dome',note:'Chapter II (with Mistletoe)',run:()=>{dialog.close();blink(arriveAtRidge);}},
    {label:'Stay in Grand Teton',run:()=>dialog.close()}]);
}
function takeFocus() {
  instrument=true;
  checkpoint={x:player.x,z:player.z};
  el('tilt-tools').hidden=false;updateGlass();
  say('Focal ring fitted. Tilt with Q or R. Meter the gate to read its state.');
  audio.bell(4);
}
function finish() {
  restored=true;
  checkpoint={x:player.x,z:player.z};
  dialog.close();
  el('message').textContent='';noticeUntil=0;
  if(testMode||motion.matches)showCompletion();
  else {
    openingSpring=true;
    heading=-.17;pitch=-.09;
    keys.clear();
    scenery.updateOutlet(true,elapsed);
  }
  audio.bell(5);setTimeout(()=>audio.bell(7),270);setTimeout(()=>audio.bell(10),540);
}
function showCompletion() {
  setPanel('The pass is open','EXPEDITION COMPLETE',
    '<p>The iron screen sinks into the granite. Water runs through the notch again. You mark the route on your map, and can roam freely across Yosemite or return to Grand Teton anytime via Map &amp; Plates.</p>');
  addChoices([{label:'Stay on the ridge',run:()=>dialog.close()},
    {label:'Open Map & Plates',run:()=>{dialog.close();openMap();}},
    {label:'Return to the opening print',run:()=>{dialog.close();titleScreen();}}]);
}
function toggleCameraRig() {
  if(region==='cover'||!scenery)return;
  if(seated){say('Dismount before setting up the 8×10 tripod.');return;}
  if(!cameraRig.deployed){
    const fx=Math.sin(heading),fz=-Math.cos(heading);
    const rx=player.x+fx*1.75,rz=player.z+fz*1.75;
    cameraRig.deployed=true;
    cameraRig.viewMode=true;
    cameraRig.x=rx;cameraRig.z=rz;cameraRig.y=terrainAt(rx,rz);
    cameraRig.yaw=heading;cameraRig.pitch=pitch;
    scenery.rigGroup.visible=true;
    scenery.updateCameraRigMesh(cameraRig.x,cameraRig.y,cameraRig.z,cameraRig.yaw,cameraRig.pitch,cameraRig.focus,tilt,filters[selected].color,terrainAt);
    applyCargo();
    el('ground-glass').hidden=false;
    el('world').classList.toggle('inverted',cameraRig.inverted);
    el('camera-btn').textContent='Pack 8×10';
    say('Tripod planted & bellows racked. Focus with the slider, then expose a plate.');
  } else if(!cameraRig.viewMode){
    if(near(cameraRig.x,cameraRig.z,4.5)){
      cameraRig.viewMode=true;
      el('ground-glass').hidden=false;
      el('world').classList.toggle('inverted',cameraRig.inverted);
    } else {
      packCameraRig();
      el('camera-btn').textContent='8×10 Camera';
    }
  } else {
    packCameraRig();
    el('camera-btn').textContent='8×10 Camera';
  }
}
function stepBackFromGlass() {
  cameraRig.viewMode=false;
  el('ground-glass').hidden=true;
  el('world').classList.remove('inverted');
  say('Stepped back from the ground glass. Walk around the tripod or press E nearby to look again.');
}
function exposePlate() {
  if(!cameraRig.deployed||!world)return;
  const f=el('flash');
  f.classList.remove('go');void f.offsetWidth;f.classList.add('go');
  const cam=tmpCam;
  cam.aspect=1.25;cam.fov=34;
  cam.rotation.order='YXZ';
  cam.position.set(cameraRig.x,cameraRig.y+1.38,cameraRig.z);
  cam.rotation.set(cameraRig.pitch,-cameraRig.yaw,0,'YXZ');
  cam.updateProjectionMatrix();cam.updateMatrixWorld();
  const prevVis=scenery.rigGroup.visible;
  scenery.rigGroup.visible=false;
  const snap=world.captureView(region,elapsed,{glass:selected,sun:sunStates[sunIndex].value,weatherTime:sunStates[sunIndex].time,plane:activePlane()},cam,640,512);
  scenery.rigGroup.visible=prevVis;

  const card=document.createElement('canvas');
  card.width=680;card.height=584;
  const ctx=card.getContext('2d');
  ctx.fillStyle='#ede6d6';ctx.fillRect(0,0,card.width,card.height);
  ctx.strokeStyle='#1d1c19';ctx.lineWidth=2;ctx.strokeRect(18,18,644,516);
  ctx.drawImage(snap,20,20,640,512);
  const placeName=regionData().name;
  const targ=currentTarget();
  const zNum=numerals[zoneOf(targ.target)];
  const sharp=Math.abs(cameraRig.focus-.56)<.32;
  const stop=STOPS[cameraRig.stopIdx];
  const note=(sharp?'Sharp':'Soft focus')+' · Zone '+zNum;
  const idx=plates.length+1;
  ctx.fillStyle='#1b1915';ctx.font='400 16px "Instrument Serif", Georgia, serif';
  ctx.fillText(`PLATE ${idx} · ${placeName.toUpperCase()} · ${filters[selected].short.toUpperCase()} · ${stop} · ${sunStates[sunIndex].clock} · ${note.toUpperCase()}`,22,562);

  plates.push({id:idx,place:placeName,filter:filters[selected].name,stop,clock:sunStates[sunIndex].clock,zone:zNum,note,dataUrl:card.toDataURL('image/jpeg',.9)});
  el('plate-count').textContent=String(plates.length);
  audio.bell(5);setTimeout(()=>audio.bell(8),160);
  say(`Exposed Plate ${idx} (${placeName}, ${stop}, Zone ${zNum}). Stored in Map & Plates.`);
}
function drawTopoMap(canvasEl) {
  const ctx=canvasEl.getContext('2d');
  const w=canvasEl.width,h=canvasEl.height;
  ctx.fillStyle='#161512';ctx.fillRect(0,0,w,h);
  const isRidge=region==='ridge';
  const [x0,x1,z0,z1]=isRidge?[-460,640,-520,240]:[-1050,110,-360,360];
  const gx=96,gz=60,cellW=w/(gx-1),cellH=h/(gz-1);
  const elev=new Float32Array(gx*gz);
  for(let j=0;j<gz;j++){
    const z=mix(z0,z1,j/(gz-1));
    for(let i=0;i<gx;i++){
      const x=mix(x0,x1,i/(gx-1));
      elev[j*gx+i]=isRidge?world.ridgeGround(x,z):world.tetonGround(x,z);
    }
  }
  const step=isRidge?18:10;
  for(let j=0;j<gz-1;j++)for(let i=0;i<gx-1;i++){
    const k=j*gx+i,a=elev[k],b=elev[k+1],c=elev[k+gx],d=elev[k+gx+1];
    const x=mix(x0,x1,(i+.5)/(gx-1)),z=mix(z0,z1,(j+.5)/(gz-1));
    if(!isRidge&&world.wet(x,z)>0){
      ctx.fillStyle='rgba(203,177,130,0.22)';
      ctx.fillRect(i*cellW,j*cellH,cellW+1,cellH+1);
    }
    const band=Math.floor(a/step);
    if(Math.floor(b/step)!==band||Math.floor(c/step)!==band||Math.floor(d/step)!==band){
      ctx.fillStyle='rgba(237,230,214,0.24)';
      ctx.fillRect(i*cellW,j*cellH,2,2);
    }
  }
  const mapX=x=>(x-x0)/(x1-x0)*w,mapY=z=>(z-z0)/(z1-z0)*h;
  ctx.font='11px Inter,system-ui,sans-serif';
  for(const v of VANTAGES){
    if((v.region==='ridge')!==isRidge)continue;
    const vx=mapX(v.x),vy=mapY(v.z),got=discovered.has(v.id);
    ctx.strokeStyle=got?'#cbb182':'rgba(237,230,214,.45)';
    ctx.beginPath();ctx.arc(vx,vy,5,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=got?'#ede6d6':'rgba(237,230,214,.62)';
    const rightSide=vx>w-170;
    ctx.textAlign=rightSide?'right':'left';
    ctx.fillText(v.name,rightSide?vx-8:clamp(vx+8,6,w-150),clamp(vy+4,14,h-8));
  }
  ctx.textAlign='left';
  if(scenery){
    const mx=mapX(scenery.donkey.state.x),my=mapY(scenery.donkey.state.z);
    ctx.fillStyle='#cbb182';ctx.beginPath();ctx.arc(mx,my,4.5,0,Math.PI*2);ctx.fill();
    ctx.fillText('Mistletoe',clamp(mx+7,6,w-72),clamp(my-8,14,h-8));
  }
  const px=mapX(player.x),py=mapY(player.z);
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.sin(heading)*15,py-Math.cos(heading)*15);ctx.stroke();
}
function travelToVantage(v) {
  dialog.close();
  blink(()=>{
    if(v.region==='ridge'&&region!=='ridge')arriveAtRidge();
    else if(v.region==='teton'&&region==='ridge'){
      setLocation('ford');
      scenery.attachActorsToScene(world.tetons);
      scenery.frameTrees.visible=false;
    } else if(v.id!=='overlook_deck'&&region==='overlook'){
      setLocation('ford');
      overlookMoved=true;overlookShift=0;
      scenery.frameTrees.visible=false;
    }
    if(v.id==='overlook_deck'){showOverlook();return;}
    seated=false;
    const floor=terrainAt(v.x,v.z);
    player={x:v.x,z:v.z,y:floor+1.69};
    checkpoint={x:v.x,z:v.z};
    discovered.add(v.id);
    if(scenery){
      leadMode='lead';scenery.donkey.state.tethered=false;scenery.picketGroup.visible=false;
      scenery.donkey.place(v.x+2.4,v.z+1.8,0,donkeyGroundAt);
    }
    const {chapter,name}=regionData();
    el('chapter').textContent=chapter;el('place').textContent=name;
    say('Arrived at '+v.name+'.');
  });
}
function openMap(inspectPlate=null) {
  if(region==='cover')return;
  if(inspectPlate){
    setPanel(`Plate ${inspectPlate.id}`,inspectPlate.place.toUpperCase(),
      `<div class="plate-inspect"><img src="${inspectPlate.dataUrl}" alt="Plate ${inspectPlate.id}"><p>${inspectPlate.filter} · ${inspectPlate.stop} · ${inspectPlate.clock} · ${inspectPlate.note}</p></div>`,true);
    addChoices([
      {label:'Download contact print (JPEG)',run:()=>{const a=document.createElement('a');a.href=inspectPlate.dataUrl;a.download=`monolith-plate-${inspectPlate.id}.jpg`;a.click();}},
      {label:'Back to Map & Plates',run:()=>openMap(null)}
    ]);
    return;
  }
  const plateMarkup=plates.length
    ?`<div class="plate-grid">${plates.map(p=>`<div class="plate-card"><img data-plate="${p.id}" src="${p.dataUrl}" alt="Plate ${p.id}"><small><strong>Plate ${p.id}</strong> · ${p.place}<br>${p.filter} · ${p.stop} · ${p.note}</small></div>`).join('')}</div>`
    :`<p class="quiet">No 8×10 plates exposed yet. Press <strong>C</strong> (or click <strong>8×10 Camera</strong>) on foot anywhere in the world to set up the tripod and expose a plate.</p>`;

  setPanel('Expedition Map & Plates',regionData().chapter,
    `<div class="map-wrap">
      <canvas id="topo-canvas" width="760" height="440"></canvas>
      <p class="quiet">White circle &amp; vector: your position. Brass dot: Mistletoe. Open circles: Survey Vantages (${discovered.size}/${VANTAGES.length} visited). ${platesBroken?platesBroken+' plate(s) cracked from rough galloping.':''}</p>
      <h3 style="margin:4px 0 0;font-weight:500;font-size:.82rem;letter-spacing:.12em;text-transform:uppercase;color:var(--brass)">Field Plate Box (${plates.length})</h3>
      ${plateMarkup}
    </div>`,true);

  drawTopoMap(el('topo-canvas'));
  el('panel-body').querySelectorAll('[data-plate]').forEach(img=>{
    img.addEventListener('click',()=>{
      const p=plates.find(x=>x.id===Number(img.dataset.plate));
      if(p)openMap(p);
    });
  });

  const choices=VANTAGES.map(v=>({
    label:v.name,
    note:`${v.region==='ridge'?'Yosemite':'Grand Teton'} · ${discovered.has(v.id)?'Visited':'Travel'}`,
    run:()=>travelToVantage(v)
  }));
  addChoices(choices);
}

function action() {
  if(region==='overlook'&&near(-46.3,1.4,6.5))return {label:'Descend straight to the ford',run:()=>blink(()=>arriveAtFord(true))};
  if(cameraRig.deployed&&!cameraRig.viewMode&&near(cameraRig.x,cameraRig.z,4.5))return {label:'Look through 8×10 ground glass',run:toggleCameraRig};
  const D=scenery?.donkey?.state;
  if(seated&&isTetonRegion()&&player.x<-269&&player.x>-285&&Math.abs(player.z+55)<12&&!fordSolid())return {label:'Dismount at the ford',run:()=>{mount(false);leadMode='tethered';stakePos={x:D.x,z:D.z};scenery.donkey.state.tethered=true;scenery.picketGroup.position.set(D.x,donkeyGroundAt(D.x,D.z),D.z);scenery.picketGroup.visible=true;}};
  if(D&&near(D.x,D.z,5.6))return {label:inventory<2?'Open Mistletoe’s pannier':'Mistletoe & pack',run:openBurro};
  if(isTetonRegion()){
    if(near(-246,-54.8,4.8)||near(-518,94,5.5))return {label:'Set the solar arc',run:openSolar};
    if(near(-426,-62,8.5))return {label:campMarked?'Continue to Half Dome':'Mark the far bank',run:openCamp};
    if(near(-790,-35,7.0))return {label:'Set the solar arc',run:openSolar};
  } else if(region==='ridge') {
    if(near(75,8,4.8)||near(220,-45,5.5))return {label:'Set the solar arc',run:openSolar};
    if(near(75,-42,6.0)&&!instrument)return {label:'Take the focal ring',run:takeFocus};
    if(near(75,-88,6.9)&&!restored)return {label:'Work the survey screen',run:openScreen};
  }
  return null;
}
function useAction() {
  if(loading||dialog.open)return;
  const interaction=action();
  if(interaction)interaction.run();
}
function openScreen() {
  setPanel('Work the survey screen','RIDGE OBSERVATORY',
    '<p>The screen holds back the spring. Burn the iron into dense shadow and dodge the channel to let the water through.</p>');
  addChoices([
    {label:'Burn the iron · Dodge the channel',note:'Restore the spring',run:finish},
    {label:'Leave the screen as it is',run:()=>dialog.close()}
  ]);
}
function objective() {
  if(cameraRig.viewMode)return 'Compose on the 8×10 ground glass. Focus and expose a plate.';
  if(region==='overlook')return 'Adams’s frame is the trailhead. Walk off the deck to Mistletoe or press E to descend.';
  if(isTetonRegion()){
    if(inventory<2)return 'Open Mistletoe’s pannier for the Yellow & Orange glass.';
    if(player.x>-282&&!fordSolid())return 'Meter the ford. Bring the water down to Zone VI or below.';
    if(player.x>-372&&Math.abs(player.z+55)<18)return 'Cross between the survey posts with Mistletoe, or explore upstream.';
    return 'Explore the Oxbow and Far-Bank Terrace, or mark the cairn to reach Half Dome.';
  }
  if(restored)return 'The pass is open. Roam Yosemite or open Map & Plates to return anytime.';
  if(player.x>115)return 'Explore the East Granite Apron and frame Half Dome on 8×10 plates.';
  if(player.z>-32&&!cloudSolid())return 'Cast a long shadow. Bring the cloud down to Zone II (or ride the East Shoulder).';
  if(player.z>-32)return 'Cross the obsidian cloud.';
  if(!instrument)return 'Take the focal ring from the cairn.';
  if(player.z>-49.9&&gateInFocus())return 'Tilt the focal plane until the gate loses its solidity.';
  if(player.z>-49.9)return 'Walk through the softened iron.';
  if(player.z>-70&&!rootsSolid())return 'Use Green #58 to wake the roots.';
  if(player.z>-71)return 'Climb the living steps.';
  return 'Reach the final cairn and restore the spring.';
}
function deckHeight(x,z) {
  if(x>=-48.5&&x<=-24.8&&z>=-2.6&&z<=5.3)return 156.31;
  if(x>-24.8&&x<=-19.4&&z>=-2.6&&z<=5.3)return mix(156.31,world.tetonGround(x,z),smooth(-24.8,-19.4,x));
  return null;
}
function canWalkWater(x,z) {
  if(Math.abs(z+55)<4.38&&x>-360.1&&x<-279&&fordSolid())return true;
  if(x>-585&&x<-470&&z>132&&z<182&&(fordSolid()||(world.wet(x,z)<3.6&&world.gravel(x,z)>.34)))return true;
  return false;
}
function terrainAt(x,z) {
  if(region!=='ridge'){
    const d=deckHeight(x,z);
    if(d!==null)return d;
    if(world.wet(x,z)>-.9&&canWalkWater(x,z))return fordY(x,z);
    return world.tetonGround(x,z);
  }
  if(cloudSolid()&&Math.abs(x-75)<4.10&&z>=-34.1&&z<=5.35)return scenery.bridgeHeight(x,z);
  if(rootsSolid()&&Math.abs(x-75)<2.18&&z<=-64.77&&z>=-71.4)return Math.max(world.ridgeGround(x,z),scenery.rootHeight(z));
  return world.ridgeGround(x,z);
}
function donkeyGroundAt(x,z) {
  return terrainAt(x,z);
}
function checkVantages() {
  const isRidge=region==='ridge';
  for(const v of VANTAGES){
    if((v.region==='ridge')!==isRidge)continue;
    if(!discovered.has(v.id)&&near(v.x,v.z,14)){
      discovered.add(v.id);
      say('Survey vantage charted: '+v.name+'.');
    }
  }
}
function move(dt) {
  if(seated)return;
  const ax=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
  const az=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  if(!ax&&!az){clearSeconds=0;return;}
  if(cameraRig.viewMode)stepBackFromGlass();
  if(region==='overlook'&&!overlookLive){overlookLive=true;el('overlook-still').hidden=true;}
  const forwardX=Math.sin(heading),forwardZ=-Math.cos(heading);
  const run=keys.has('ShiftLeft')||keys.has('ShiftRight');
  const speed=(packHeavy?4.65:(run?8.2:6.35))/Math.hypot(ax,az);
  const dx=(forwardX*az+Math.cos(heading)*ax)*speed*dt;
  const dz=(forwardZ*az+Math.sin(heading)*ax)*speed*dt;
  const oldFloor=terrainAt(player.x,player.z);
  let x=region==='ridge'?clamp(player.x+dx,-650,950):clamp(player.x+dx,-1650,120);
  let z=region==='ridge'?clamp(player.z+dz,-1100,650):clamp(player.z+dz,-1050,900);

  if(region!=='ridge'){
    /* Overlook deck west/side safety curb (slide smoothly along rails, exit east ramp) */
    const onDeck=player.x<-24.8&&player.z>=-2.6&&player.z<=5.3&&Math.abs(oldFloor-156.31)<.6;
    if(onDeck&&(x<-48.0||z<-2.35||z>5.05)){
      if(clearSeconds===0)say('Walk east down the ramp to reach Mistletoe and the Bluff Trail.');
      clearSeconds+=dt;
      x=Math.max(x,-48.0);z=clamp(z,-2.35,5.05);
    }
    if(world.wet(x,z)>.5&&!canWalkWater(x,z)){
      if(clearSeconds===0)say(Math.abs(z+55)<14&&x>-365&&x<-275&&fordSolid()?'Cross between the survey posts.':'The current is strong here. Use Yellow or Orange glass to read Zone VI.');
      clearSeconds+=dt;
      if(clearSeconds>1.1)recover();
      return;
    }
  } else {
    const inNotchX=Math.abs(x-75)<6.5;
    if(inNotchX&&z<-48.52&&z>-49.58&&gateInFocus()){
      if(clearSeconds===0)say('The iron is in focus and holds its shape.');
      clearSeconds+=dt;return;
    }
    if(inNotchX&&z<-65.2&&z>-71.4&&(!rootsSolid()||Math.abs(x-75)>2.25)){
      if(clearSeconds===0)say('The rock step is too high. Meter the juniper roots.');
      clearSeconds+=dt;return;
    }
    if(x>66&&x<84&&z<4.95&&z>-33.7&&(!cloudSolid()||Math.abs(x-75)>=4.10)){
      if(clearSeconds===0)say('The cloud cannot hold your weight here.');
      clearSeconds+=dt;
      if(clearSeconds>1.1)recover();
      return;
    }
  }
  const floor=terrainAt(x,z);
  const stepDist=Math.hypot(x-player.x,z-player.z)||.01;
  if(Math.abs(floor-oldFloor)/stepDist>1.45&&Math.abs(floor-oldFloor)>.75&&!(region==='ridge'&&((cloudSolid()&&z<=5.35&&z>=-34.1&&Math.abs(x-75)<4.2)||(rootsSolid()&&z<=-64.7&&z>=-71.5&&Math.abs(x-75)<2.4)))){
    clearSeconds+=dt;return;
  }
  player.x=x;player.z=z;clearSeconds=0;
  player.y=mix(player.y,floor+1.69,1-Math.exp(-dt*14));

  if(region==='overlook'&&(player.x>-24.5||Math.abs(player.z-1.35)>5.6)){
    overlookMoved=true;overlookShift=0;region='ford';
    scenery.frameTrees.visible=false;
    const {chapter,name}=regionData();
    el('chapter').textContent=chapter;el('place').textContent=name;
    say('Follow the Bluff Switchback Trail down to the Snake River.');
  }
  if(region==='ford'){
    const {name}=regionData();
    if(el('place').textContent!==name)el('place').textContent=name;
    if(x<-374&&checkpoint.x>-365)checkpoint={x:-376,z:-55};
  }
  if(region==='ridge'){
    const {name}=regionData();
    if(el('place').textContent!==name)el('place').textContent=name;
    if(z<-34&&checkpoint.z>-34)checkpoint={x:75,z:-35.4};
    if(z<-51&&checkpoint.z>-50)checkpoint={x:75,z:-53};
    if(z<-73&&checkpoint.z>-73)checkpoint={x:75,z:-75};
  }
  checkVantages();
}
function stepDonkey(dt) {
  if(!scenery||region==='cover')return;
  const D=scenery.donkey, S=D.state, M=D.mind;
  const curReg=region==='ridge'?'ridge':'tetons';
  let ctl={throttle:0,steer:0,pace:0,trot:false};

  if(seated){
    const kd=(a,b)=>(keys.has(a)||keys.has(b)?1:0);
    const th=kd('KeyW')-kd('KeyS');
    const st=kd('KeyA')-kd('KeyD');
    const shift=keys.has('ShiftLeft')||keys.has('ShiftRight');
    const pace=Math.max(shift?1:0,paceLatch);
    ctl={throttle:th,steer:st,pace,trot:pace>=1};
  } else if(leadMode==='lead'){
    const fx=Math.sin(heading),fz=-Math.cos(heading);
    const tx=player.x-fx*2.25,tz=player.z-fz*2.25;
    const dx=tx-S.x,dz=tz-S.z,dist=Math.hypot(dx,dz);
    const desired=Math.atan2(dx,dz);
    const df=Math.atan2(Math.sin(desired-S.heading),Math.cos(desired-S.heading));
    if(dist>2.5){
      const far=dist>6.5;
      ctl={throttle:Math.abs(df)<1.1?1:.25,steer:clamp(df*2.2,-1,1),pace:far?1:0,trot:far};
    }
  }

  /* Look ahead for props, drops, and deep un-solidified river water */
  const fx=Math.sin(S.heading),fz=Math.cos(S.heading);
  let nearDist=99;
  for(const s of scenery.solids){
    if(s.region!==curReg)continue;
    const dx=s.x-S.x,dz=s.z-S.z,a=dx*fx+dz*fz;
    if(a>0&&a<6&&Math.abs(dx*fz-dz*fx)<s.r+.5)nearDist=Math.min(nearDist,a-s.r);
  }
  if(cameraRig.deployed){
    const dx=cameraRig.x-S.x,dz=cameraRig.z-S.z,a=dx*fx+dz*fz;
    if(a>0&&a<5&&Math.abs(dx*fz-dz*fx)<1.0)nearDist=Math.min(nearDist,a-.6);
  }
  const ax=S.x+fx*1.7,az=S.z+fz*1.7;
  let drop=donkeyGroundAt(ax,az)-donkeyGroundAt(S.x,S.z);
  if(region!=='ridge'&&world.wet(ax,az)>.5&&!canWalkWater(ax,az))drop=-1.4;
  ctl.near=nearDist;ctl.drop=drop;

  const prevHeading=S.heading;
  const steps=Math.max(1,Math.ceil(dt/.0166));
  const sub=dt/steps;
  for(let i=0;i<steps;i++)D.update(sub,ctl,donkeyGroundAt);

  /* Collide gently with world solids & keep within world bounds */
  for(const s of scenery.solids){
    if(s.region!==curReg)continue;
    const dx=S.x-s.x,dz=S.z-s.z,d=Math.hypot(dx,dz),rad=s.r+.42;
    if(d<rad&&d>1e-4){S.x=s.x+dx/d*rad;S.z=s.z+dz/d*rad;S.speed*=.85;}
  }
  if(region!=='ridge'){
    S.x=clamp(S.x,-1640,110);S.z=clamp(S.z,-1040,890);
    if(world.wet(S.x,S.z)>.5&&!canWalkWater(S.x,S.z)){
      S.x-=fx*Math.max(.1,Math.abs(S.speed)*dt);
      S.z-=fz*Math.max(.1,Math.abs(S.speed)*dt);
      S.speed=0;
      if(seated)say('Mistletoe halts at the deep water. Meter the glare or dismount.');
    }
  } else {
    S.x=clamp(S.x,-640,940);S.z=clamp(S.z,-1090,640);
  }
  if(leadMode==='tethered'&&!seated){
    const rx=S.x-stakePos.x,rz=S.z-stakePos.z,rd=Math.hypot(rx,rz);
    if(rd>3.4){S.x=stakePos.x+rx/rd*3.4;S.z=stakePos.z+rz/rd*3.4;S.speed*=.4;}
  }

  /* Fragile glass plates on canter/gallop */
  const hasPlates=cargoItems.find(i=>i.id==='plates')?.slot!=='-';
  if(hasPlates&&S.g2>.55){
    plateShock+=dt*S.g2;
    if(plateShock>3.2){plateShock=0;platesBroken++;audio.bell(1);say('A glass plate cracked from running Mistletoe hard over rough ground.');}
  } else plateShock=Math.max(0,plateShock-dt*.3);

  if(seated){
    player.x=S.x;player.z=S.z;player.y=S.y+1.78;
    const dH=Math.atan2(Math.sin(S.heading-prevHeading),Math.cos(S.heading-prevHeading));
    heading-=dH;
    const wantYaw=S.heading+camOrbit.relYaw;
    camOrbit.yaw+=Math.atan2(Math.sin(wantYaw-camOrbit.yaw),Math.cos(wantYaw-camOrbit.yaw))*(1-Math.exp(-dt*(drag?25:3.5)));
    if(region==='overlook'&&(player.x>-24.5||Math.abs(player.z-1.35)>5.6)){
      overlookMoved=true;overlookShift=0;region='ford';scenery.frameTrees.visible=false;
    }
    if(region!=='overlook'){
      const {chapter,name}=regionData();
      if(el('chapter').textContent!==chapter)el('chapter').textContent=chapter;
      if(el('place').textContent!==name)el('place').textContent=name;
    }
    checkVantages();
  }

  /* Update catenary lead rope */
  D.halterRing(tmpHalter);
  if(seated||leadMode==='free'){
    scenery.updateLeadRope(0,0,0,0,0,0,0,false);
  } else if(leadMode==='tethered'){
    scenery.updateLeadRope(tmpHalter.x,tmpHalter.y,tmpHalter.z,stakePos.x,donkeyGroundAt(stakePos.x,stakePos.z)+.44,stakePos.z,.18,true);
  } else {
    const hx=player.x+Math.cos(heading)*.28,hy=player.y-.48,hz=player.z+Math.sin(heading)*.28;
    scenery.updateLeadRope(tmpHalter.x,tmpHalter.y,tmpHalter.z,hx,hy,hz,.24,true);
  }
}
function updateScenery() {
  if(region!=='ridge')scenery.updateFord(fordSolid(),zoneOf('ford'));
  else {
    scenery.updateCloud(cloudSolid(),elapsed);
    scenery.updateGate(gateInFocus());
    if(scenery.updateOutlet(restored,elapsed)&&openingSpring){
      openingSpring=false;
      showCompletion();
    }
    scenery.roots.visible=rootsSolid();
    scenery.dormant.visible=!rootsSolid();
  }
}
function updateHud() {
  const next=action();
  const button=el('interaction');
  if(next?.label!==lastAction){
    button.hidden=!next;
    button.textContent=next?next.label+' · E':'';
    el('cross').classList.toggle('ready',Boolean(next));
    lastAction=next?.label;
  }
  const hint=objective();
  if(el('objective').textContent!==hint)el('objective').textContent=hint;
  if(noticeUntil>0&&elapsed>noticeUntil){el('message').textContent='';noticeUntil=0;}
  if(scenery){
    const S=scenery.donkey.state;
    el('hud-stam').style.width=Math.round(S.stamina*100)+'%';
    el('hud-stam').parentNode.classList.toggle('low',S.stamina<.25);
    el('hud-burro-state').textContent=S.label;
    el('mount-tools').hidden=!seated;
    el('pace-btn').textContent=['Walk','Trot','Canter','Gallop'][paceLatch];
    el('view-btn').textContent=saddleFirstPerson?'Saddle cam':'Orbit cam';
    el('camera-btn').textContent=cameraRig.deployed?'Pack 8×10':'8×10 Camera';
    el('camera-btn').disabled=seated;
  }
  refreshMeter();
}
function frame(now) {
  if(region==='cover')return;
  animation=requestAnimationFrame(frame);
  const raw=(now-lastFrame)/1000;
  const dt=clamp(raw,0,.13);
  lastFrame=now;
  if(region==='overlook'&&overlookLive&&overlookShift>0)overlookShift=Math.max(0,overlookShift-dt*2.4);
  if(!dialog.open&&!loading){
    elapsed+=clamp(raw,0,.7);
    const yaw=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
    const up=Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown'));
    if(yaw||up)look(yaw*dt*337,-up*dt*303);
    if(!openingSpring){
      const travelTime=clamp(raw,0,.6);
      const steps=Math.ceil(travelTime/.055);
      for(let i=0;i<steps;i++)move(travelTime/steps);
    }
    stepDonkey(dt);
    updateScenery();
  }
  if(now-lastUi>90){updateHud();lastUi=now;}
  const movingNow=keys.size>0||seated||cameraRig.viewMode||Math.abs(scenery?.donkey?.state?.speed||0)>.05;
  const minInterval=movingNow?0:1000/24;
  if(!testMode&&now-drawn>=minInterval&&(region!=='overlook'||overlookLive||movingNow)&&(!dialog.open||needsFrame||restored&&region==='ridge')){
    updateCamera();
    render();
    drawn=now;
    needsFrame=false;
  }
  audio.environment(region,player,keys,seated,elapsed);
}
function look(dx,dy) {
  if(region==='cover'||dialog.open)return;
  if(region==='overlook'&&(dx||dy)){
    overlookLive=true;el('overlook-still').hidden=true;
  }
  if(cameraRig.viewMode){
    cameraRig.yaw+=dx*.0018;
    cameraRig.pitch=clamp(cameraRig.pitch-dy*.0016,-.85,.85);
    needsFrame=true;return;
  }
  if(seated&&!saddleFirstPerson){
    camOrbit.relYaw-=dx*.0045;
    camOrbit.yaw-=dx*.0045;
    camOrbit.pitch=clamp(camOrbit.pitch+dy*.0038,-.08,1.25);
    needsFrame=true;return;
  }
  heading+=dx*.0035;
  pitch=clamp(pitch-dy*.0032,-1.23,1.18);
  needsFrame=true;
}

el('begin').addEventListener('click',begin);
el('cover-guide').addEventListener('click',openGuide);
el('guide').addEventListener('click',openGuide);
el('open-burro').addEventListener('click',openBurro);
el('open-map').addEventListener('click',()=>openMap(null));
el('close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{dialog.classList.remove('wide');if(region!=='cover')canvas.focus({preventScroll:true});});
el('glass').addEventListener('click',openGlass);
el('meter').addEventListener('click',toggleMeter);
el('camera-btn').addEventListener('click',toggleCameraRig);
el('pace-btn').addEventListener('click',()=>{paceLatch=(paceLatch+1)%4;updateHud();});
el('view-btn').addEventListener('click',()=>{saddleFirstPerson=!saddleFirstPerson;updateHud();});
el('bray-btn').addEventListener('click',()=>{if(scenery)scenery.donkey.bray();});
el('interaction').addEventListener('click',useAction);
el('tilt-up').addEventListener('click',()=>adjustTilt(6));
el('tilt-down').addEventListener('click',()=>adjustTilt(-6));
el('gg-focus').addEventListener('input',e=>{
  cameraRig.focus=Number(e.target.value);
  if(scenery&&cameraRig.deployed)scenery.updateCameraRigMesh(cameraRig.x,cameraRig.y,cameraRig.z,cameraRig.yaw,cameraRig.pitch,cameraRig.focus,tilt,filters[selected].color,terrainAt);
  const sharp=Math.abs(cameraRig.focus-.56)<.32;
  el('gg-status').textContent=`8×10 Ground Glass · ${STOPS[cameraRig.stopIdx]} · ${sharp?'Sharp':'Soft focus'}`;
  needsFrame=true;
});
el('gg-stop').addEventListener('click',()=>{
  cameraRig.stopIdx=(cameraRig.stopIdx+1)%STOPS.length;
  el('gg-stop').textContent=STOPS[cameraRig.stopIdx];
  const sharp=Math.abs(cameraRig.focus-.56)<.32;
  el('gg-status').textContent=`8×10 Ground Glass · ${STOPS[cameraRig.stopIdx]} · ${sharp?'Sharp':'Soft focus'}`;
});
el('gg-invert').addEventListener('click',()=>{
  cameraRig.inverted=!cameraRig.inverted;
  el('gg-invert').setAttribute('aria-pressed',String(cameraRig.inverted));
  el('world').classList.toggle('inverted',cameraRig.inverted);
});
el('gg-expose').addEventListener('click',exposePlate);
el('gg-back').addEventListener('click',stepBackFromGlass);

canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  canvas.setPointerCapture(event.pointerId);
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,dist:0};
});
canvas.addEventListener('pointermove',event=>{
  if(document.pointerLockElement===canvas){look(event.movementX,event.movementY);return;}
  if(!drag||drag.id!==event.pointerId)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  drag.x=event.clientX;drag.y=event.clientY;drag.dist+=Math.abs(dx)+Math.abs(dy);
  look(dx,dy);
});
canvas.addEventListener('pointerup',event=>{
  if(drag&&drag.dist<4&&event.pointerType==='mouse'&&!cameraRig.viewMode&&canvas.requestPointerLock){
    try {canvas.requestPointerLock()?.catch(()=>{});} catch {}
  }
  drag=null;
});
canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('wheel',event=>{
  if(!seated||saddleFirstPerson)return;
  event.preventDefault();
  camOrbit.dist=clamp(camOrbit.dist*Math.exp(event.deltaY*.0012),2.1,14);
},{passive:false});
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();
  cancelAnimationFrame(animation);
  if(region!=='cover')setPanel('Rendering interrupted','MONOLITH','<p>Reload the file to reopen the expedition.</p>');
});
for(const button of el('touch-walk').querySelectorAll('button')){
  const code=button.dataset.walk;
  button.addEventListener('pointerdown',event=>{button.setPointerCapture(event.pointerId);keys.add(code);event.preventDefault();});
  for(const end of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(end,()=>keys.delete(code));
}
coarse.addEventListener('change',()=>{el('touch-walk').hidden=!coarse.matches||region==='cover';});
const usedKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Backspace','Space']);
document.addEventListener('keydown',event=>{
  if(region==='cover'||dialog.open||event.ctrlKey||event.metaKey||event.altKey)return;
  if(usedKeys.has(event.code)){
    event.preventDefault();
    keys.add(event.code);
  }
  if(event.repeat)return;
  const k=event.code;
  if(k==='KeyE')useAction();
  else if(k==='KeyF')toggleMeter();
  else if(k==='KeyQ')adjustTilt(-6);
  else if(k==='KeyR')adjustTilt(6);
  else if(k==='KeyC')toggleCameraRig();
  else if(k==='KeyM')openMap(null);
  else if(k==='KeyP')openBurro();
  else if(k==='KeyV'){if(seated){saddleFirstPerson=!saddleFirstPerson;updateHud();}}
  else if(k==='Space'){
    if(cameraRig.viewMode)exposePlate();
    else if(scenery)scenery.donkey.bray();
  }
  else if(k==='KeyH')openGuide();
  else if(k==='Backspace')recover();
  else if(/^Digit[1-5]$/.test(k))selectGlass(Number(k.at(-1))-1);
});
document.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();drag=null;});

const audio=(()=>{
  let context, master, windGain, windTone, riverGain, riverTone, noiseBuf, enabled=false;
  let lastStep=-Infinity;
  const button=el('sound');
  function noise(seconds) {
    const sample=context.createBuffer(1,Math.floor(context.sampleRate*seconds),context.sampleRate);
    const values=sample.getChannelData(0);
    for(let i=0;i<values.length;i++)values[i]=Math.random()*2-1;
    return sample;
  }
  function loop(freq,pan) {
    const source=context.createBufferSource();source.buffer=noise(4);source.loop=true;
    const tone=context.createBiquadFilter();tone.type='lowpass';tone.frequency.value=freq;
    const gain=context.createGain();gain.gain.value=0;
    const stereo=context.createStereoPanner();stereo.pan.value=pan;
    source.connect(tone).connect(gain).connect(stereo).connect(master);source.start();
    return [gain,tone];
  }
  button.addEventListener('click',async()=>{
    if(!context){
      try {
        const Audio=window.AudioContext||window.webkitAudioContext;
        context=new Audio();master=context.createGain();master.gain.value=0;master.connect(context.destination);
        [windGain,windTone]=loop(230,-.27);
        [riverGain,riverTone]=loop(610,.19);
        noiseBuf=noise(.3);
      } catch { button.textContent='Audio unavailable';button.disabled=true;return; }
    }
    await context.resume();
    enabled=!enabled;
    master.gain.setTargetAtTime(enabled?.43:0,context.currentTime,.24);
    button.setAttribute('aria-pressed',String(enabled));
    button.textContent=enabled?'Sound on':'Sound off';
    if(enabled)bell(5);
  });
  function bell(zone) {
    if(!enabled||!context)return;
    const notes=[45,48,50,52,55,57,60,62,64,67,69];
    const freq=440*2**((notes[clamp(zone,0,10)]-69)/12);
    const start=context.currentTime;
    for(const [ratio,amplitude,decay] of [[1,.145,.69],[2,.046,.38],[3,.021,.21],[4.016,.013,.15]]){
      const osc=context.createOscillator();osc.type='sine';osc.frequency.value=freq*ratio;
      const gain=context.createGain();
      gain.gain.setValueAtTime(.0001,start);
      gain.gain.exponentialRampToValueAtTime(amplitude,start+.013);
      gain.gain.exponentialRampToValueAtTime(.0001,start+decay*3);
      osc.connect(gain).connect(master);osc.start(start);osc.stop(start+decay*3+.02);
    }
  }
  function hoof(L,gait) {
    if(!enabled||!context||!noiseBuf)return;
    const S=scenery?.donkey?.state;
    const wetHere=region!=='ridge'&&world&&world.wet(S?.x||0,S?.z||0)>-.4;
    const t=context.currentTime,src=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();
    src.buffer=noiseBuf;src.playbackRate.value=.55+Math.random()*.25+(L.front?.1:0);
    f.type='bandpass';f.frequency.value=(wetHere?680:region==='ridge'?340:260)+Math.random()*160+gait*180;f.Q.value=1.1;
    g.gain.setValueAtTime(.14+gait*.16+(S?.hv||0)*.1,t);g.gain.exponentialRampToValueAtTime(.0001,t+.16);
    src.connect(f).connect(g).connect(master);src.start(t);
  }
  function bray() {
    if(!enabled||!context)return;
    const t0=context.currentTime+.12,o=context.createOscillator(),f=context.createBiquadFilter(),g=context.createGain(),f2=context.createBiquadFilter();
    o.type='sawtooth';f.type='bandpass';f.Q.value=4;f2.type='peaking';f2.frequency.value=2300;f2.gain.value=9;
    g.gain.setValueAtTime(0,t0);
    for(let i=0;i<3;i++){
      const t=t0+i*.72;
      o.frequency.setValueAtTime(520,t);o.frequency.linearRampToValueAtTime(760,t+.26);
      f.frequency.setValueAtTime(1500,t);g.gain.linearRampToValueAtTime(.16,t+.05);g.gain.linearRampToValueAtTime(.02,t+.29);
      o.frequency.setValueAtTime(250,t+.31);o.frequency.exponentialRampToValueAtTime(150,t+.68);
      f.frequency.setValueAtTime(820,t+.31);g.gain.linearRampToValueAtTime(.24,t+.38);g.gain.linearRampToValueAtTime(.01,t+.7);
    }
    g.gain.linearRampToValueAtTime(0,t0+2.3);
    o.connect(f).connect(f2).connect(g).connect(master);o.start(t0);o.stop(t0+2.4);
  }
  function snort() {
    if(!enabled||!context||!noiseBuf)return;
    const t=context.currentTime,src=context.createBufferSource(),f=context.createBiquadFilter(),g=context.createGain();
    src.buffer=noiseBuf;src.playbackRate.value=.35;f.type='bandpass';f.frequency.value=420;f.Q.value=.8;
    g.gain.setValueAtTime(.35,t);g.gain.exponentialRampToValueAtTime(.001,t+.45);
    src.connect(f).connect(g).connect(master);src.start(t);
  }
  function environment(region,position,keys,seated,clock) {
    if(!enabled||!context)return;
    const at=context.currentTime;
    windGain.gain.setTargetAtTime((region==='ridge'?.13:.075)+.024*Math.sin(clock*.42),at,.42);
    windTone.frequency.setTargetAtTime(178+.58*position.y+23*Math.sin(clock*.42),at,.31);
    const river=region!=='ridge'?1-smooth(27,162,Math.abs(position.x+324)):region==='ridge'&&restored?.45*(1-smooth(5,31,Math.abs(position.z+90))):0;
    riverGain.gain.setTargetAtTime(river*.16,at,.25);
    riverTone.frequency.setTargetAtTime(fordSolid()?390:690,at,.24);
    if(seated||dialog.open||!['KeyW','KeyA','KeyS','KeyD'].some(k=>keys.has(k))||clock-lastStep<.43)return;
    lastStep=clock;
    const source=context.createBufferSource();source.buffer=noise(.15);
    const tone=context.createBiquadFilter();tone.type='bandpass';tone.frequency.value=(fordSolid()&&river>.8?830:440)+Math.random()*170;
    const gain=context.createGain();gain.gain.setValueAtTime(.15,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.135);
    source.connect(tone).connect(gain).connect(master);source.start(at);
  }
  return {bell,hoof,bray,snort,environment};
})();

function wireDonkeyAudio() {
  if(!scenery)return;
  const S=scenery.donkey.state;
  S.onStep=(L,gait)=>audio.hoof(L,gait);
  S.onMood=id=>{
    if(id==='bray')audio.bray();
    else if(id==='collapse'||id==='startled'||id==='annoyed'||id==='shake'||id==='kick'||id==='paw')audio.snort();
  };
}

if(testMode) {
  window.monolithTest={
    state:()=>{
      const S=scenery?.donkey?.state, M=scenery?.donkey?.mind;
      return {region,inventory,selected,sunIndex,tilt,instrument,restored,seated,
        x:player.x,z:player.z,y:player.y,ford:fordSolid(),cloud:cloudSolid(),gate:gateInFocus(),roots:rootsSolid(),
        plates:plates.length,cameraDeployed:cameraRig.deployed,discovered:[...discovered],
        burro:S?{x:S.x,z:S.z,y:S.y,stamina:S.stamina,mood:S.mood,load:S.cargo.m,trust:M.trust,refusing:M.refusing}:null};
    },
    step(seconds){for(let i=0;i<Math.ceil(seconds/.04);i++){move(.04);stepDonkey(.04);}},
    look(yaw,value=0){heading=yaw;pitch=value;},
    draw(){updateScenery();stepDonkey(0);updateCamera();updateHud();render();},
    zone:zoneOf,
    arriveAtFord:()=>arriveAtFord(true),
    arriveAtRidge,
    mount,
    toggleCameraRig,
    exposePlate,
    openBurro,
    openMap
  };
}
document.body.dataset.ready='1';
