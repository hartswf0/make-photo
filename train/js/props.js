// What the door cues describe, built: each carriage's chapter of the worlds file as things standing in the room.
// Every prop is also where its worlds' stubs are kept, so the carriages hold the corpus without anything floating in the aisle.
import * as THREE from 'three';
import { Batch, DIM } from './kit.js';
import { bayX } from './train.js';

const { L, HW, ROOF } = DIM;
export function buildProps(train, M) {
  const X = {   // a few materials the fit-outs do not have
    snow: new THREE.MeshLambertMaterial({ color: 0xe9eef0 }), pink: new THREE.MeshLambertMaterial({ color: 0xe58aa8 }), white: new THREE.MeshLambertMaterial({ color: 0xf1ede2 }),
    water: new THREE.MeshStandardMaterial({ color: 0x2bb8c9, transparent: true, opacity: .55, roughness: .1 }), green: new THREE.MeshBasicMaterial({ color: 0x38e07a }), gold: new THREE.MeshStandardMaterial({ color: 0xe0b23a, metalness: .9, roughness: .3, envMapIntensity: 1 }),
    mono: new THREE.MeshLambertMaterial({ color: 0x8c8c8a }), foam: new THREE.MeshLambertMaterial({ color: 0x3a3f46 }), hazard: new THREE.MeshLambertMaterial({ color: 0xe0b400 }), paper: new THREE.MeshLambertMaterial({ color: 0xe6dcc0 }),
    graf: [0xe0483a, 0x2f8fd0, 0xf0c020, 0x3cb46a, 0xd060c0].map(c => new THREE.MeshLambertMaterial({ color: c })) };
  const out = [], b = new Batch(); let car = null;
  /** Register a prop: title, where to stand to use it, and name fragments of the worlds it stands for. */
  const P = (title, x, y, z, worlds) => out.push({ car: car.i, title, at: [x, y, z], worlds });
  const begin = i => { car = train.cars[i]; }, end = () => b.build(car.group);

  // ---- 2 · dining car: sealed velocity (Bullet Train, Snowpiercer)
  begin(2);
  { const x = L / 2 - 1.2; for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) b.box(M.steel, x + c * .46 - .23, .3 + r * .44, -1.26, .44, .42, .3); b.box(M.black, x - .23, 1.18, -1.1, .4, .38, .02); b.box(X.gold, x - .23, 1.1, -1.18, .3, .2, .1);
    P('Smart lockers, one open on a silver briefcase', x, 1.2, -.9, ['smartlocker', 'lovesyou', 'firstclasscabin', 'breachedexterior']); }
  { const x = bayX(5) + 1.2; b.box(M.steel, x, .5, .22, .8, .9, .42); for (let k = 0; k < 6; k++) b.cyl(X.water, x - .3 + k * .12, 1.05, .22, .035, .035, .2, 8); for (const e of [-1, 1]) b.cyl(M.black, x + e * .3, .06, .22, .06, .06, .05, 10, Math.PI / 2);
    P('Concession cart, jammed in the aisle', x, 1.0, .1, ['concessioncart', 'quietcar', 'automatedtrainlavatory']); }
  { const x = bayX(4), z = -1.0; b.box(X.water, x, 1.0, z, .78, .42, .5); b.box(M.brass, x, .78, z, .82, .04, .54); b.box(M.brass, x, 1.22, z, .82, .03, .54); for (let k = 0; k < 4; k++) b.sph(X.graf[0], x - .25 + k * .17, .95 + (k % 2) * .1, z, .05, .03, .02);
    P('Sushi aquarium and its pump', x, 1.1, -.5, ['sushiaquarium', 'waterreclamation']); }
  { const x = bayX(3), z = 1.0; b.box(M.steel, x, 1.05, z, .6, .56, .5); b.box(M.black, x - .45, .79, z, .3, .04, .3); for (let k = 0; k < 3; k++) b.box(M.black, x - .45, .83 + k * .05, z, .16, .045, .09);
    P('Protein block machine', x, 1.1, .5, ['proteinblock', 'kronolestorage', 'kronolereserve', 'dentedoor', 'dented']); }
  { const x0 = bayX(1); b.box(M.brass, x0, 1.92, -1.05, 1.8, .03, .03); for (let k = 0; k < 5; k++) { b.sph(M.linen, x0 - .7 + k * .35, 1.62, -1.05, .09, .16, .09); b.cyl(M.iron, x0 - .7 + k * .35, 1.84, -1.05, .008, .008, .16, 4); }
    P('Butcher’s rail of hanging chickens', x0, 1.5, -.5, ['butcherstation', 'tailorstation']); }
  { const x = bayX(0) - .3; b.box(M.black, x, 1.45, -1.38, 1.5, .9, .03); b.box(M.wood, x, .98, -1.36, 1.56, .05, .06); for (let k = 0; k < 4; k++) b.box(X.white, x - .5 + k * .33, 1.5 + (k % 2) * .12, -1.36, .22, .02, .01);
    P('Blackboard: the anthem, in chalk', x, 1.3, -.5, ['classroomcar', 'intercomspeaker', 'sacredengine', 'wilfordpocketwatch']); }
  { const x = bayX(1), z = 1.25; for (let k = 0; k < 2; k++) b.box(M.steel, x + k * 1.0 - .5, .2, z, .95, .34, .36); b.box(M.steel, x - .5, .2, z - .32, .95, .3, .3); b.box(M.linen, x - .5, .38, z - .32, .7, .06, .22); b.sph(M.walnut, x - .82, .43, z - .32, .09);
    P('Prison drawer, a man asleep in it', x, .6, .55, ['prisondrawer', 'childlaborer', 'nightvision', 'hatchetblade']); }
  { const x = bayX(2) - .74; b.sph(X.pink, x, .95, -.95, .26, .34, .24); b.sph(X.pink, x, 1.38, -.95, .22); for (const e of [-1, 1]) b.sph(X.pink, x, 1.6, -.95 + e * .14, .07); b.sph(M.walnut, bayX(6), .8, .98, .11, .05, .06);
    P('Mascot suit, slumped; and the shoe', x + .5, 1.1, -.45, ['momomon', 'masonsshoe', 'violinstrings', 'greenhousecar']); }
  { const x = -L / 2 + 1.2; b.sph(X.snow, x, .12, .9, .9, .22, .5); b.sph(X.snow, x + .6, .08, .2, .6, .12, .4); for (let k = 0; k < 5; k++) b.box(M.glass, x - .2 + k * .12, .2 + k * .03, 1.2, .1, .14, .01, k);
    P('Shattered window; snow across the linen', x, .6, .5, ['shatteredwindow', 'frozenseoul', 'polarbear', 'frozenbody', 'yekaterina', 'frozenskyscraper', 'icejam']); }
  end();

  // ---- 3 · greenhouse: half for me, half for them (Honeyland)
  begin(3);
  { const x = 3.6; for (let k = 0; k < 9; k++) b.box(M.stone, x + (k % 3) * .7 - .7, .7 + Math.floor(k / 3) * .62, -1.12 + (k % 2) * .08, .8, .66, .5); b.box(M.black, x, 1.3, -.86, .5, .16, .06); b.box(M.honey, x, 1.3, -.84, .4, .1, .04); train.cars[3].glows.push([x, 1.3, -.8, .8, 0xffc04a]);
    P('Limestone cliff, comb glowing in the crevice', x, 1.2, -.4, ['limestonecrevice', 'spidercaves', 'halfforthem', 'macedonianbee']); }
  { const x = .6; b.cyl(M.walnut, x, .74, 1.0, .2, .22, 1.1, 10, 0, Math.PI / 2); b.cyl(M.black, x + .56, .74, 1.0, .12, .12, .02, 10, 0, Math.PI / 2);
    P('Hollowed tree-trunk hive', x, .9, .45, ['hollowedtree', 'verbaltransaction']); }
  { const x = -2.4; for (let k = 0; k < 7; k++) { const px = x + (k % 4) * .28 - .4, pz = -1.0 + Math.floor(k / 4) * .3; b.box(M.stone, px, .62, pz, .2, .18, .18); b.box(M.straw, px, .74, pz, .24, .06, .22); }
    P('The abandoned village, doll-size', x, .8, -.45, ['bekirlija', 'yugoslavarchive', 'colonycollapse']); }
  { const x = -5.2; b.box(M.wood, x, .62, 1.0, 1.7, .2, .62); b.box(X.graf[0], x - .1, .78, 1.0, 1.4, .14, .6); b.sph(M.linen, x + .6, .86, 1.0, .14, .08, .12); b.cyl(M.linen, x + .95, .8, .78, .02, .02, .14, 6); b.sph(M.lamp, x + .95, .9, .78, .025); train.cars[3].glows.push([x + .95, .9, .78, .5]);
    P('The winter bed, a candle beside it', x, .9, .45, ['winterboundbed']); }
  { const x = 6.4; b.box(M.wood, x, .78, -1.0, 1.0, .05, .5); for (let k = 0; k < 6; k++) b.cyl(M.honey, x - .36 + k * .14, .87, -1.05, .045, .045, .13, 8); b.cyl(M.brass, x + .36, .9, -.88, .012, .012, .22, 5); b.box(M.brass, x + .36, 1.0, -.88, .3, .01, .02);
    P('Market stall: honey by the jar, a brass scale', x, .95, -.45, ['skopjemarket', 'arrivalofhussein']); }
  { for (const [x, z] of [[-.8, .22], [-1.9, -.2]]) { b.box(M.walnut, x, .62, z, .9, .46, .34); b.box(M.walnut, x + .5, .78, z, .26, .26, .24); for (const e of [-.3, .3]) for (const s of [-.1, .1]) b.box(M.walnut, x + e, .2, z + s, .08, .4, .08); }
    P('Calves, wedged in the aisle', -1.3, .8, 0, ['arrivalofhussein', 'macedonianbeelineage']); }
  { const x = -7.2; for (let k = 0; k < 4; k++) { b.box(X.white, x + k * .5, .68, -1.02, .42, .34, .36); b.box(M.roof, x + k * .5, .87, -1.02, .46, .03, .4); }
    P('White box hives, opened too fast', x + .7, .9, -.45, ['langstroth', 'colonycollapsethreshold', 'apiculturalmuseum']); }
  { const x = 2.2; b.box(M.wood, x, .78, 1.02, .9, .05, .5); b.cyl(M.iron, x - .25, .86, 1.02, .12, .12, .03, 12); b.cyl(M.iron, x + .2, .86, 1.02, .12, .12, .03, 12); for (let k = 0; k < 6; k++) b.box(M.black, x - .35 + k * .14, 1.5, 1.2, .03, 1.0, .004);
    P('Editing bench; footage hanging like vines', x, 1.0, .5, ['editingroom', 'sundanceawards']); }
  { const x = -3.9; b.box(M.cream, x, .72, 1.05, .7, .4, .5); for (const e of [-.28, 0, .28]) b.cyl(M.cream, x + e, 1.02, .86, .04, .04, .22, 8); b.box(M.cream, x, 1.16, 1.05, .76, .06, .56); b.cyl(X.gold, x + .7, .7, 1.0, .05, .08, .3, 8);
    P('A small sun temple; a trophy among the tomatoes', x, .95, .5, ['egyptiansuntemple', 'sundance']); }
  end();

  // ---- 4 · apiary: the beekeepers
  begin(4);
  { const x = -6.2; b.box(M.black, x, 1.2, -1.36, 1.3, 1.5, .06); for (let k = 0; k < 6; k++) b.box(M.iron, x - .5 + k * .2, 1.2, -1.3, .04, 1.1, .05); b.box(M.walnut, x + .9, 1.2, -1.2, .06, 1.5, .5); for (let k = 0; k < 4; k++) b.cyl(M.honey, x + .9, .7 + k * .3, -1.05, .05, .05, .12, 8);
    P('A shelf of honey jars, swung open on rifles', x, 1.2, -.5, ['armoryconcealed', 'beachassault', 'overlookcommand']); }
  { const x = 6.6; b.cyl(M.steel, x, .5, 1.0, .34, .34, .9, 14); b.cyl(M.black, x, .96, 1.0, .3, .3, .02, 14); b.box(M.walnut, x, .1, 1.0, .5, .12, .5); for (let k = 0; k < 3; k++) b.box(X.graf[k], x - .1 + k * .1, .2, 1.0, .08, .02, .12);
    P('Honey centrifuge with a false bottom', x, .9, .45, ['falsebottom', 'anisetteterminal']); }
  { for (let k = 0; k < 16; k++) b.box(X.white, 3.6 - k * .2, .42, .78, .07, .8, .02); b.box(X.white, 2.1, .55, .78, 3.2, .05, .02); b.box(M.leaf, 2.1, .01, 1.05, 3.2, .02, .5); b.box(M.walnut, .4, .5, 1.0, .05, 1.0, .05); b.box(M.red, .4, 1.05, 1.0, .22, .16, .3);
    P('A white picket fence, a lawn, a mailbox', 2.2, .8, .4, ['whitepicketfence', 'rainyairport']); }
  { const x = -1.2; b.box(M.wood, x, .78, -1.05, .7, .05, .5); b.box(M.walnut, x, .9, -1.05, .44, .2, .03, .3); b.sph(M.linen, x, 1.15, -1.05, .1, .2, .1);
    P('A hive frame, still smouldering', x, 1.0, -.5, ['smolderinghive']); }
  { const x = -3.4; b.box(M.crt, x, .95, 1.1, .6, .5, .5); b.box(X.green, x, .97, .845, .46, .34, .01); b.box(M.iron, x + .9, .9, 1.15, .5, 1.7, .4); for (let k = 0; k < 6; k++) b.box(k % 2 ? X.green : M.red, x + .9, .3 + k * .26, .945, .3, .03, .01); b.box(M.honey, x + .9, .04, .9, .5, .02, .2);
    P('A terminal tracing the world; servers dripping honey', x + .4, 1.0, .5, ['globaltracing', 'offshorefinancial', 'concretestairwell', 'audiorecording']); }
  { const x = 1.4; b.box(M.glass, x, 1.05, -1.02, .8, 2.0, .7); for (const [ex, ez] of [[-.4, -.35], [.4, -.35], [-.4, .35], [.4, .35]]) b.box(M.iron, x + ex, 1.05, -1.02 + ez, .03, 2.0, .03); b.cyl(M.iron, x, .75, -1.02, .16, .2, 1.3, 8); b.sph(M.walnut, x, 1.55, -1.02, .12);
    P('A glass office, a man in a suit pounding on it', x, 1.2, -.45, ['glassenclosure', 'bostonfbi']); }
  { const x = 4.6; b.sph(M.steel, x, 2.0, -.9, .2); b.box(M.steel, x, .95, -1.2, 1.4, .06, .3); b.box(M.glass, x, 1.4, -1.34, 1.4, .8, .02); for (let k = 0; k < 5; k++) b.cyl(X.graf[k], x - .5 + k * .25, 1.06, -1.2, .03, .03, .18, 6);
    P('A mirrored bar under a slow disco ball', x, 1.1, -.5, ['highsocietynightclub']); }
  { const x = -L / 2 + 2.0; b.box(M.black, x, .7, .95, 2.0, 1.2, .9); b.box(M.iron, x - .5, 1.5, .95, .9, .5, .86); for (const e of [-.7, .7]) b.cyl(M.black, x + e, .25, .5, .26, .26, .2, 12, Math.PI / 2); b.box(M.red, x + 1.0, .6, .95, .02, .2, .6);
    P('The burned-out shell of an armoured truck', x + .6, 1.0, .35, ['wreckedtactical', 'rooftophelicopter']); }
  end();

  // ---- 5 · mirror corridor: the angels (monochrome, one wall of colour)
  begin(5);
  { for (let k = 0; k < 14; k++) b.box(X.graf[k % 5], 6.4 - k * .92, .3 + (k % 3) * .14, 1.38, .9, .5 + (k % 2) * .16, .03);
    P('The wall: graffiti, the only colour here', 2, .8, .9, ['berlinwallgraffiti', 'potsdamerplatz', 'berlinwall']); }
  { const x = 4.2, z = 1.12; b.cyl(M.steel, x, .5, z, .13, .16, 1.0, 8); b.box(M.steel, x, 1.2, z, .44, .5, .26); b.sph(M.steel, x, 1.62, z, .13, .16, .14); for (const e of [-1, 1]) b.cyl(M.steel, x, 1.1, z + e * .3, .05, .05, .6, 6);
    P('A suit of plate armour', x, 1.2, .6, ['proparmor', 'cannes']); }
  { const x = 1.0; b.box(X.paper, x, .02, .5, .3, .01, .22); b.box(M.walnut, x, .016, .5, .02, .012, .24);
    P('A notebook, a child’s hand writing in it', x, .5, .5, ['handke', 'songofchildhood', 'peterhandke']); }
  { const x = -2.2; b.box(M.brass, x, 1.75, .6, .02, .02, 1.3); for (const e of [-.6, .6]) b.cyl(M.linen, x, 2.0, .6 + e, .008, .008, .5, 4); for (const e of [-1, 1]) b.box(X.white, x, 1.55, .6 + e * .25, .4, .5, .03, 0, e * .5);
    P('A trapeze, swinging the width of the car', x, 1.5, .6, ['circusalekan', 'circus']); }
  { const x = -5.0; b.box(X.mono, x, .75, 1.12, .5, 1.5, .4); b.box(X.mono, x, 1.6, 1.12, .7, .3, .6); b.box(M.lamp, x, 1.6, .82, .2, .1, .01); for (let k = 0; k < 5; k++) b.box(M.iron, x + .6 + k * .2, .3, 1.2, .02, .6, .02);
    P('A watchtower over raked sand and wire', x, 1.2, .6, ['potsdamerplatzdeathstrip', 'anhalter']); }
  { const x = 6.0; b.box(M.iron, x, .86, 1.12, 1.0, .1, .44, 0, 0, .2); for (let k = 0; k < 8; k++) b.cyl(M.steel, x - .4 + k * .11, .95, 1.1, .02, .02, .05, 6); b.box(M.walnut, x, .42, 1.14, .9, .8, .4);
    P('A mixing desk, its meters twitching', x, 1.0, .6, ['hansastudios', 'nickcave', 'kaisersaal', 'grandhotel']); }
  { const x = -6.6; b.cyl(X.mono, x, .8, 1.1, .28, .32, 1.6, 6); b.cyl(X.mono, x, 1.75, 1.1, .1, .28, .4, 6); b.box(M.black, x, 1.0, .82, .14, .4, .02);
    P('The bombed stump of a church tower', x, 1.2, .6, ['kaiserwilhelm', 'victorycolumn']); }
  { for (const x of [5.2, -.4, -3.6]) { b.cyl(M.black, x, .85, -.12, .17, .2, 1.7, 8); b.sph(X.mono, x, 1.78, -.12, .11); }
    P('Men in overcoats, listening', -.4, 1.4, .3, ['statelibrary', 'berlinstatelibrary', 'ubahn', 'peterfalk', 'colortiming', 'original35mm']); }
  end();

  // ---- 6 · surveillance: the breach
  begin(6);
  { const x = 3.5; b.box(M.walnut, x, .76, -.62, 3.0, .05, .44); for (const e of [-1.3, 1.3]) b.box(M.walnut, x + e, .38, -.62, .06, .76, .4); for (let k = 0; k < 5; k++) { b.cyl(M.brass, x - 1.2 + k * .6, 1.0, -.72, .008, .008, .44, 4); b.box(X.graf[k], x - 1.13 + k * .6, 1.15, -.72, .14, .1, .005); b.box(X.paper, x - 1.2 + k * .6, .79, -.55, .2, .004, .28); }
    P('The treaty table: flags, unsigned papers', x, 1.0, -.2, ['diplomaticthreshold', 'ethicalframeworks', 'ijcai', 'senatevulnerability']); }
  { const x = -.2; b.box(M.steel, x, .78, .62, 1.8, .04, .4); for (let k = 0; k < 6; k++) { const px = x - .75 + k * .3; b.box(M.black, px, .83, .62, .1, .03, .1); for (const [ex, ez] of [[-.07, -.07], [.07, .07], [-.07, .07], [.07, -.07]]) b.cyl(M.iron, px + ex, .85, .62 + ez, .035, .035, .006, 8); }
    P('A bench of palm-size quadcopters', x, 1.0, .3, ['commercialorigin', 'academictestbed', 'agridyne', 'yolo', 'maven']); }
  { const x = -3.2; b.box(X.foam, x, 1.05, -.72, .9, 2.0, .5); for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) b.box(M.black, x - .28 + k * .28, .4 + r * .36, -.45, .2, .2, .12, .78, .78); b.box(M.black, x, 1.3, -.2, .1, .03, .1);
    P('An anechoic booth; one drone hovering in it', x, 1.2, -.1, ['psychoacoustic', 'graphicalthreshold', 'simulatedcampus']); }
  { const x = 1.0; b.box(M.steel, x, .6, .72, 1.7, .05, .5); b.box(X.white, x, .68, .72, 1.6, .1, .46); for (const e of [-.75, .75]) b.cyl(M.steel, x + e, .3, .72, .02, .02, .6, 6); b.box(M.glassRoof, x, 1.15, .72, 1.8, .9, .6);
    P('A gurney under a plastic tent', x, 1.0, .3, ['seoulstation', 'cdcintake', 'nozomi64', 'channeltrain']); }
  { const x = -5.6; for (let k = 0; k < 6; k++) { b.box(X.white, x + (k % 3) * .5, .3 + Math.floor(k / 3) * .4, .78, .44, .36, .4); b.box(X.hazard, x + (k % 3) * .5, .3 + Math.floor(k / 3) * .4, .575, .46, .06, .01); }
    P('White bee boxes, sealed with hazard tape', x + .5, .8, .35, ['davisapiary', 'evergreenprotocol', 'hivemind']); }
  { const x = -L / 2 + 1.6; b.box(M.ext, x, 1.1, -.9, 2.0, 2.0, .7); for (let k = 0; k < 9; k++) b.box(M.iron, x - .9 + k * .22, 1.1, -.54, .03, 2.0, .02); b.box(X.snow, x, 2.12, -.9, 2.0, .04, .7);
    P('A shipping container, frost on its doors', x, 1.1, -.2, ['evergreenprotocoltransport', 'lincolntunnel', 'eurotunnel', 'datachokepoint']); }
  { const x = 5.9; b.box(M.red, x, .84, .66, .22, .08, .16); b.box(M.red, x, .9, .66, .26, .04, .06); b.box(M.walnut, x, .4, .66, .4, .8, .3); b.box(M.crt, x - 1, 1.5, 1.2, .7, .5, .4); b.box(X.green, x - 1, 1.5, .995, .56, .38, .01);
    P('A red telephone that nobody answers; the radar', x, 1.0, .3, ['norad', 'seattlekillswitch', 'stadiumsurveillance', 'biometric', 'topographic']); }
  end();

  // ---- 7 · cinema: the arrival of a train (Heist 1855, Steam, Lumière)
  begin(7);
  { const x = 6.6; for (const e of [0, .9]) { b.box(M.iron, x - e, .6, -1.02, .8, 1.2, .6); b.box(M.iron, x - e + .3, .6, -.62, .06, 1.1, .5, .9); for (let k = 0; k < 4; k++) b.box(X.gold, x - e - .15 + (k % 2) * .26, .2 + Math.floor(k / 2) * .09, -.98, .24, .08, .12); } b.sph(M.linen, x - 1.5, .16, -.7, .18, .14, .18);
    P('Two safes; gold bars swapped for lead shot', x - .4, .9, -.35, ['guardvan', 'royalmint', 'chubbworkshop', 'chubblock', 'folkestone']); }
  { const x = 3.0; b.box(M.walnut, x, 1.3, 1.36, 2.4, 1.6, .16); for (let r = 0; r < 5; r++) for (let k = 0; k < 9; k++) { b.box(M.black, x - 1.05 + k * .26, .7 + r * .3, 1.27, .22, .26, .02); if ((r * 3 + k) % 3) b.box(X.paper, x - 1.05 + k * .26, .66 + r * .3, 1.25, .16, .1, .03); }
    P('The sorting wall of the night mail', x, 1.2, .8, ['mobilepostal', 'concentratedcorrespondence', 'granularsocial', 'kineticexchange']); }
  { const x = 4.9; b.box(M.iron, x, .6, -1.15, .9, 1.2, .4); b.box(M.lamp, x, .5, -.94, .4, .3, .01); train.cars[7].glows.push([x, .5, -.85, 1.4, 0xff7a2a]); b.box(M.black, x - .5, .1, -.8, .5, .2, .4);
    P('The firebox, and a fireman’s coal', x, .9, -.4, ['fireboxlabor', 'coalfirebox', 'humanmachine', 'steamlocomotive']); }
  { const x = .2; b.box(M.wood, x, .78, 1.2, 1.1, .05, .36); for (let k = 0; k < 7; k++) b.box(M.brass, x - .42 + k * .14, .82, 1.2, .02, .02, .12); b.box(M.linen, x + .3, .83, 1.12, .2, .05, .12); b.cyl(M.iron, x - 1.0, .4, 1.2, .2, .26, .8, 10); b.cyl(M.lamp, x - 1.0, .82, 1.2, .16, .16, .03, 10);
    P('Keys, wax impressions, a furnace pouring gold', x - .3, 1.0, .7, ['waxworkshop', 'smeltingfurnace', 'londonbridgeticket', 'greenman']); }
  { const x = L / 2 - 1.4; b.box(M.walnut, x, .9, .95, .9, 1.4, .7); b.box(M.walnut, x - .7, .6, .95, .5, .9, .7); b.sph(M.linen, x, 1.72, .95, .13, .12, .12); b.cyl(M.black, x, 1.3, .95, .2, .24, .7, 8);
    P('A judge’s bench and a dock', x - .4, 1.2, .35, ['oldbailey', 'scotlandyard', 'newgate']); }
  { const x = -2.6; for (let k = 0; k < 3; k++) b.cyl(M.steel, x + k * .5, .4, 1.15, .2, .2, .8, 12); for (let k = 0; k < 8; k++) b.cyl(M.iron, x - 1.2 - (k % 4) * .24, .5 + Math.floor(k / 4) * .3, 1.2, .11, .11, .04, 12, Math.PI / 2);
    P('Vats of silver emulsion; shelves of film cans', x, .9, .7, ['emulsionmixing', 'nitratenegative', 'editingsplicing', 'darkroom', 'lensgrinding']); }
  { const x = -5.6; for (const [ex, ez] of [[-.25, -.2], [.25, -.2], [0, .25]]) b.box(M.wood, x + ex, .6, -.85 + ez, .03, 1.25, .03, 0, ex * .5, ez * .5); b.box(M.walnut, x, 1.32, -.85, .26, .3, .22); b.cyl(M.brass, x - .18, 1.32, -.85, .05, .06, .1, 10, 0, Math.PI / 2); b.cyl(M.brass, x, 1.3, -.72, .01, .01, .12, 4, Math.PI / 2);
    P('A hand-cranked camera on a wooden tripod', x, 1.2, -.3, ['cinematographetripod', 'crankhandle', 'salonindien', 'projectionscreen', 'arclamp', 'meliesseat', 'mlisseat']); }
  { const x = -7.0; b.box(M.wood, x, .5, 1.05, .9, .08, .5); for (const e of [-.35, .35]) b.cyl(M.iron, x + e, .22, 1.05, .2, .2, .04, 12, Math.PI / 2); b.box(M.leather, x, .72, 1.05, .6, .36, .4); b.box(M.brass, x + 1.2, .9, 1.2, .3, .24, .3); b.box(M.iron, x - 1.2, 1.0, 1.2, .5, 1.6, .4); for (let k = 0; k < 5; k++) b.box(X.green, x - 1.2, .4 + k * .26, .995, .3, .03, .01);
    P('A luggage cart, a till, and a rack redrawing the film', x, .9, .5, ['luggagecart', 'boxofficetill', 'aiupscale', 'youtubecomment', 'pocketwatch', 'womaninplaid', 'childlooking', 'platformfloor', 'handpainted', 'traincarriagewindow']); }
  end();

  // ---- 8 · the hive: what is set in the comb
  begin(8);
  { const x = 5.6; b.box(M.iron, x, .34, 1.02, 1.5, .1, .5); for (let k = 0; k < 6; k++) b.box(X.white, x - .5 + (k % 3) * .5, .5 + Math.floor(k / 3) * .22, 1.02, .44, .2, .42); for (const e of [-.5, .5]) b.cyl(M.black, x + e, .2, .8, .14, .14, .1, 10, Math.PI / 2);
    P('A flatbed of white bee boxes, set in the comb', x, .8, .5, ['adeehoneyfarms']); }
  { const x = 2.6; b.box(M.steel, x, .7, -1.05, 1.8, .04, .3); for (let k = 0; k < 8; k++) { b.cyl(M.honey, x - .78 + k * .22, .8, -1.05, .05, .06, .14, 8); b.sph(M.honey, x - .78 + k * .22, .9, -1.05, .045); }
    P('A bottling line of plastic honey bears', x, .9, -.5, ['goldenblossom']); }
  { const x = -.4; for (let k = 0; k < 22; k++) b.sph(k % 3 ? M.bloom : M.black, x + ((k * 37) % 10) * .08 - .4, .1 + ((k * 13) % 5) * .06, .9 + ((k * 7) % 6) * .06, .07);
    P('A heap of plastic cartoon bee toys', x, .5, .5, ['beemovietoys', 'mcdonalds']); }
  { const x = -2.6; for (let k = 0; k < 4; k++) { b.box(M.crt, x - k * .5, .9, -1.1, .42, .34, .3); b.box(M.bloom, x - k * .5, .9, -.945, .32, .24, .01); }
    P('Computers rendering one bee, frame by frame', x - .7, 1.0, -.5, ['dreamworksrenderfarm', 'amagansett']); }
  { const x = 1.0; b.box(X.paper, x, ROOF - 1.0, .1, .5, 1.9, .01, .3); b.box(X.paper, x - .1, .04, .3, .5, .01, 1.2, .3);
    P('A printed script, unrolling from the ceiling', x, 1.2, .2, ['tumblrbeemovie']); }
  { const x = -5.2; b.box(M.walnut, x, .7, 1.0, .9, 1.1, .5); b.cyl(M.walnut, x - .2, 1.3, 1.0, .03, .03, .2, 6, 0, Math.PI / 2); b.sph(X.water, x + .25, 1.38, 1.0, .12); b.sph(X.graf[0], x + .25, 1.38, 1.0, .03, .02, .015);
    P('A ruling that a bee is a fish; a goldfish bowl', x, 1.1, .5, ['californiabeesasfish']); }
  { const x = -7.4; for (let k = 0; k < 3; k++) { b.box(X.white, x + k * .5, .7, -1.05, .42, .03, .3); for (let q = 0; q < 6; q++) b.sph(M.black, x + k * .5 - .15 + (q % 3) * .15, .73, -1.1 + Math.floor(q / 3) * .1, .02, .012, .012); }
    P('Trays of dead bees, each with a label', x + .5, .9, -.5, ['usdaccd']); }
  end();
  return out;
}
