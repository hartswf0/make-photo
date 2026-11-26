// The passengers are make-photo's one cast (donkey/characters.js, CAST_2086), moved by the shared Mesh2Motion
// driver exactly as the overworld moves Imani. The traveler is Tex Lexington in a duster: the man at the window in clip 997.
import * as THREE from 'three';

// Who rides: make-photo's cast rigs, each given their own skin, hair and build so the train is not one family.
export const ROLES = {
  traveler: { cast: 'tex', over: { outer: 'duster', coatHex: 0x6a4a30, shirtHex: 0x3b2a1e, trouserHex: 0x26221f, hatHex: 0x4a3220 }, role: 'The traveler' },
  imani: { cast: 'imani', role: 'Imani, the carrier' },
  beekeeper: { cast: 'makeda', role: 'Makeda, the beekeeper' },
  musician: { cast: 'yared_krar', over: { skinHex: 0x6a4a36 }, role: 'Yared, the musician' },
  matriarch: { cast: 'almaz_matriarch', role: 'Almaz, the matriarch' },
  conductor: { cast: 'ferry_bekele', over: { skinHex: 0x8a6248, hair: 'silverSwept', hairHex: 0xc9c5bd, beard: false }, role: 'Bekele, the conductor' },
  researcher: { cast: 'selam_wire', over: { skinHex: 0xb08a68, hair: 'ponytail', hairHex: 0x16120f, outer: 'duster', coatHex: 0x2f4a5a }, role: 'Noor, the dispatcher' },
  elder: { cast: 'convoy_elder_1', over: { skinHex: 0xc9a48c, hair: 'silverSwept', hairHex: 0xe6e2da, coatHex: 0x4a4f3a }, role: 'Oren, the old man' },
  child: { cast: 'compound_child', over: { skinHex: 0x9b7862, hairHex: 0x3a2412 }, role: 'June, the child' },
  bride: { cast: 'old_bride', over: { skinHex: 0xd2ad96, hair: 'silverSwept', hairHex: 0xf0ece4 }, role: 'The old bride' },
  watcher: { cast: 'hood_watcher_1', over: { skinHex: 0x7c5e4b }, role: 'The watcher' },
  rahel: { cast: 'rahel', over: { skinHex: 0xb8906e, hair: 'glassesCrop', hairHex: 0x1a1512, coatHex: 0x8a2f3a }, role: 'Mila, the student' },
  saba: { cast: 'saba', over: { skinHex: 0xcfa78e, hair: 'ponytail', hairHex: 0xa8642a, coatHex: 0x2f6a5c }, role: 'Cass, the tourist' },
};

export function loadCast() {
  const C = window.CAST_2086, B = window.Mesh2MotionWorldBridge;
  if (!C || !B) throw new Error('the cast scripts are not on this page');
  const motion = B.createWorldCastDriver(THREE, { clipsBaseUrl: '../motion-pipeline/mesh2motion/clips', preload: ['idle', 'walk-happy', 'sitting-idle', 'sitting-talking', 'idle-talking'], defaultBlend: 1, defaultFade: .25 });
  const people = []; let n = 0;
  function make(roleId) {
    const r = ROLES[roleId] || { cast: roleId, role: roleId }, ch = C.make(THREE, r.cast, r.over);
    if (!ch) return null;
    if (ch.label && ch.label.sprite) ch.label.sprite.visible = false;
    const root = new THREE.Group(); ch.group.position.set(0, 0, 0); ch.group.rotation.set(0, 0, 0); root.add(ch.group);
    const p = { id: roleId, key: roleId + '#' + n++, role: r.role, root, ch, loco: { speedMps: 0 }, on: false };
    /** Only passengers near the lens are animated; the rest keep their last pose. */
    p.wake = on => { if (on === p.on) return; p.on = on; if (on) motion.registerActor(p.key, ch, { defaultClip: p.loco.sitting ? 'sitting-idle' : 'idle', blend: 1 }); else motion.unregisterActor(p.key); };
    p.wake(true); people.push(p); return p;
  }
  function update(dt) { for (const p of people) if (p.on) { if (p.clip) motion.setClip(p.key, p.clip, { fade: .15, speed: 1, blend: 1 }); else motion.setActorLocomotion(p.key, p.loco); } motion.update(dt); }
  return { make, update, people, motion };
}
