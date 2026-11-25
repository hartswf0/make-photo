// The passengers are make-photo's one cast (donkey/characters.js, CAST_2086), moved by the shared Mesh2Motion
// driver exactly as the overworld moves Imani. The traveler is Tex Lexington in a duster: the man at the window in clip 997.
import * as THREE from 'three';

export const ROLES = {
  traveler: { cast: 'tex', over: { outer: 'duster', coatHex: 0x6a4a30, shirtHex: 0x3b2a1e, trouserHex: 0x26221f, hatHex: 0x4a3220 }, role: 'The traveler' },
  imani: { cast: 'imani', role: 'The carrier, riding without her donkey' },
  beekeeper: { cast: 'makeda', role: 'The retired beekeeper' },
  musician: { cast: 'yared_krar', role: 'The musician of clip 1022' },
  matriarch: { cast: 'almaz_matriarch', role: 'The matriarch' },
  conductor: { cast: 'ferry_bekele', role: 'The conductor' },
  researcher: { cast: 'selam_wire', role: 'The researcher with the crate' },
  elder: { cast: 'convoy_elder_1', role: 'A sleeping passenger' },
  child: { cast: 'compound_child', role: 'A child at the glass' },
  bride: { cast: 'old_bride', role: 'The old bride' },
  watcher: { cast: 'hood_watcher_1', role: 'The watcher' },
  rahel: { cast: 'rahel', role: 'A passenger' },
  saba: { cast: 'saba', role: 'A passenger' },
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
  function update(dt) { for (const p of people) if (p.on) motion.setActorLocomotion(p.key, p.loco); motion.update(dt); }
  return { make, update, people, motion };
}
