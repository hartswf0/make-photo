/**
 * m2m-retarget.js — Mesh2Motion CC0 -> Anny v0.6.2 (104-bone) Three.js Runtime Retargeter & Driver
 *
 * Exposes `window.Mesh2MotionAnny` (and `module.exports` in CommonJS/Node for verification).
 *
 * Features:
 *  - Maps Mesh2Motion's CC0 humanoid skeleton (plus canonical Hips/Spine/Chest/UpperArm/... aliases)
 *    onto the Anny 104-bone `.glb` cast (`child7`, `adult_f`, `adult_m`, `elder`).
 *  - World-space rest-pose quaternion delta retargeting (`q_target = q_rest_target * q_delta`)
 *    with automatic T-pose <-> A-pose upper-arm bind alignment so Anny's A-pose arms never clip into
 *    the torso.
 *  - Root-motion XZ lock + hip-height Y scaling (`targetHipY / sourceHipY`) so children (`child7`)
 *    and adults (`adult_f`, `adult_m`, `elder`) stay grounded with proportional bounce.
 *  - Smooth `crossFadeTo` transitions, playback speed control, pause/resume, and clip caching.
 *  - Clean CC0 quadruped clip loader & mixer driver (`horse-idle`, `horse-walk`, `horse-trot`).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.Mesh2MotionAnny = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VERSION = '1.0.0';

  /** Curated CC0 humanoid clips in `motion-pipeline/mesh2motion/clips/` */
  const CLIPS = Object.freeze({
    'rest-pose': 'rest-pose.glb',
    idle: 'idle.glb',
    'idle-talking': 'idle-talking.glb',
    walk: 'walk.glb',
    'walk-carry': 'walk-carry.glb',
    jog: 'jog.glb',
    sprint: 'sprint.glb',
    jump: 'jump.glb',
    greeting: 'greeting.glb',
  });

  /** Curated CC0 quadruped clips in `motion-pipeline/mesh2motion/clips/` */
  const QUADRUPED_CLIPS = Object.freeze({
    'horse-idle': 'horse-idle.glb',
    'horse-walk': 'horse-walk.glb',
    'horse-trot': 'horse-trot.glb',
  });

  /**
   * Primary Mesh2Motion humanoid bone -> Anny v0.6.2 104-bone target map.
   * Note: Anny's spine runs bottom-to-top as `spine05 -> spine04 -> spine03 -> spine02 -> spine01`,
   * which is reversed relative to Mesh2Motion's `spine_01 -> spine_02 -> spine_03`.
   */
  const BONE_MAP = Object.freeze({
    // Core torso & head
    pelvis: 'root',
    spine_01: 'spine04',
    spine_02: 'spine03',
    spine_03: 'spine01',
    neck_01: 'neck01',
    head: 'head',

    // Left arm
    clavicle_l: 'clavicle.L',
    upperarm_l: 'upperarm01.L',
    lowerarm_l: 'lowerarm01.L',
    hand_l: 'wrist.L',

    // Right arm
    clavicle_r: 'clavicle.R',
    upperarm_r: 'upperarm01.R',
    lowerarm_r: 'lowerarm01.R',
    hand_r: 'wrist.R',

    // Left leg
    thigh_l: 'upperleg01.L',
    calf_l: 'lowerleg01.L',
    foot_l: 'foot.L',
    ball_l: 'toe2-1.L',

    // Right leg
    thigh_r: 'upperleg01.R',
    calf_r: 'lowerleg01.R',
    foot_r: 'foot.R',
    ball_r: 'toe2-1.R',

    // Left hand fingers (15 bones)
    thumb_01_l: 'finger1-1.L',
    thumb_02_l: 'finger1-2.L',
    thumb_03_l: 'finger1-3.L',
    index_01_l: 'finger2-1.L',
    index_02_l: 'finger2-2.L',
    index_03_l: 'finger2-3.L',
    middle_01_l: 'finger3-1.L',
    middle_02_l: 'finger3-2.L',
    middle_03_l: 'finger3-3.L',
    ring_01_l: 'finger4-1.L',
    ring_02_l: 'finger4-2.L',
    ring_03_l: 'finger4-3.L',
    pinky_01_l: 'finger5-1.L',
    pinky_02_l: 'finger5-2.L',
    pinky_03_l: 'finger5-3.L',

    // Right hand fingers (15 bones)
    thumb_01_r: 'finger1-1.R',
    thumb_02_r: 'finger1-2.R',
    thumb_03_r: 'finger1-3.R',
    index_01_r: 'finger2-1.R',
    index_02_r: 'finger2-2.R',
    index_03_r: 'finger2-3.R',
    middle_01_r: 'finger3-1.R',
    middle_02_r: 'finger3-2.R',
    middle_03_r: 'finger3-3.R',
    ring_01_r: 'finger4-1.R',
    ring_02_r: 'finger4-2.R',
    ring_03_r: 'finger4-3.R',
    pinky_01_r: 'finger5-1.R',
    pinky_02_r: 'finger5-2.R',
    pinky_03_r: 'finger5-3.R',
  });

  /** Canonical / Mixamo / Rigify-style aliases (lowercased, stripped of prefix/punctuation) */
  const CANONICAL_ALIASES = Object.freeze({
    hips: 'root',
    hip: 'root',
    pelvis: 'root',
    spine: 'spine04',
    spine1: 'spine03',
    spine01: 'spine04',
    spine2: 'spine01',
    spine02: 'spine03',
    spine03: 'spine01',
    chest: 'spine01',
    upperchest: 'spine01',
    neck: 'neck01',
    neck1: 'neck01',
    neck01: 'neck01',
    head: 'head',

    leftshoulder: 'clavicle.L',
    shoulderl: 'clavicle.L',
    claviclel: 'clavicle.L',
    leftupperarm: 'upperarm01.L',
    upperarml: 'upperarm01.L',
    leftarm: 'upperarm01.L',
    leftlowerarm: 'lowerarm01.L',
    lowerarml: 'lowerarm01.L',
    leftforearm: 'lowerarm01.L',
    lefthand: 'wrist.L',
    handl: 'wrist.L',

    rightshoulder: 'clavicle.R',
    shoulderr: 'clavicle.R',
    clavicler: 'clavicle.R',
    rightupperarm: 'upperarm01.R',
    upperarmr: 'upperarm01.R',
    rightarm: 'upperarm01.R',
    rightlowerarm: 'lowerarm01.R',
    lowerarmr: 'lowerarm01.R',
    rightforearm: 'lowerarm01.R',
    righthand: 'wrist.R',
    handr: 'wrist.R',

    leftupperleg: 'upperleg01.L',
    upperlegl: 'upperleg01.L',
    leftupleg: 'upperleg01.L',
    thighl: 'upperleg01.L',
    leftlowerleg: 'lowerleg01.L',
    lowerlegl: 'lowerleg01.L',
    leftleg: 'lowerleg01.L',
    calfl: 'lowerleg01.L',
    leftfoot: 'foot.L',
    footl: 'foot.L',
    lefttoe: 'toe2-1.L',
    lefttoebase: 'toe2-1.L',
    toel: 'toe2-1.L',
    balll: 'toe2-1.L',

    rightupperleg: 'upperleg01.R',
    upperlegr: 'upperleg01.R',
    rightupleg: 'upperleg01.R',
    thighr: 'upperleg01.R',
    rightlowerleg: 'lowerleg01.R',
    lowerlegr: 'lowerleg01.R',
    rightleg: 'lowerleg01.R',
    calfr: 'lowerleg01.R',
    rightfoot: 'foot.R',
    footr: 'foot.R',
    righttoe: 'toe2-1.R',
    righttoebase: 'toe2-1.R',
    toer: 'toe2-1.R',
    ballr: 'toe2-1.R',
  });

  /** Pairs of (bone -> child) used to align T-pose source arms onto Anny's A-pose arms */
  const ARM_ALIGN_PAIRS = Object.freeze([
    { src: 'upperarm_l', srcChild: 'lowerarm_l', tgt: 'upperarm01.L', tgtChild: 'lowerarm01.L' },
    { src: 'upperarm_r', srcChild: 'lowerarm_r', tgt: 'upperarm01.R', tgtChild: 'lowerarm01.R' },
  ]);

  const ROOT_SOURCE_NAMES = new Set(['pelvis', 'hips', 'hip', 'mixamorig:hips']);

  // ---------------------------------------------------------------------------
  // Pure math helpers (work identically with or without THREE loaded)
  // ---------------------------------------------------------------------------

  function qIdentity() {
    return [0, 0, 0, 1];
  }

  function qNormalize(q) {
    const len = Math.hypot(q[0], q[1], q[2], q[3]);
    if (len < 1e-12) return [0, 0, 0, 1];
    return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
  }

  function qConj(q) {
    return [-q[0], -q[1], -q[2], q[3]];
  }

  function qMul(a, b) {
    return [
      a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
      a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
      a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
  }

  function qSlerp(a, b, t) {
    let bx = b[0], by = b[1], bz = b[2], bw = b[3];
    let dot = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
    if (dot < 0) {
      dot = -dot;
      bx = -bx; by = -by; bz = -bz; bw = -bw;
    }
    if (dot > 0.9995) {
      return qNormalize([
        a[0] + t * (bx - a[0]),
        a[1] + t * (by - a[1]),
        a[2] + t * (bz - a[2]),
        a[3] + t * (bw - a[3]),
      ]);
    }
    const theta0 = Math.acos(Math.min(1, Math.max(-1, dot)));
    const sin0 = Math.sin(theta0);
    const s0 = Math.sin((1 - t) * theta0) / sin0;
    const s1 = Math.sin(t * theta0) / sin0;
    return [
      s0 * a[0] + s1 * bx,
      s0 * a[1] + s1 * by,
      s0 * a[2] + s1 * bz,
      s0 * a[3] + s1 * bw,
    ];
  }

  function qRotateVec(q, v) {
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
    const vx = v[0], vy = v[1], vz = v[2];
    const ix = qw * vx + qy * vz - qz * vy;
    const iy = qw * vy + qz * vx - qx * vz;
    const iz = qw * vz + qx * vy - qy * vx;
    const iw = -qx * vx - qy * vy - qz * vz;
    return [
      ix * qw + iw * -qx + iy * -qz - iz * -qy,
      iy * qw + iw * -qy + iz * -qx - ix * -qz,
      iz * qw + iw * -qz + ix * -qy - iy * -qx,
    ];
  }

  function vSub(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function vNormalize(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return l < 1e-12 ? [0, 1, 0] : [v[0] / l, v[1] / l, v[2] / l];
  }

  function qFromUnitVectors(from, to) {
    const f = vNormalize(from);
    const t = vNormalize(to);
    const dot = f[0] * t[0] + f[1] * t[1] + f[2] * t[2];
    if (dot < -0.999999) {
      let axis = [1, 0, 0];
      if (Math.abs(f[0]) > 0.9) axis = [0, 1, 0];
      const cx = f[1] * axis[2] - f[2] * axis[1];
      const cy = f[2] * axis[0] - f[0] * axis[2];
      const cz = f[0] * axis[1] - f[1] * axis[0];
      return qNormalize([cx, cy, cz, 0]);
    }
    const cx = f[1] * t[2] - f[2] * t[1];
    const cy = f[2] * t[0] - f[0] * t[2];
    const cz = f[0] * t[1] - f[1] * t[0];
    return qNormalize([cx, cy, cz, 1 + dot]);
  }

  function getTHREE(opts) {
    if (opts && opts.THREE) return opts.THREE;
    if (typeof window !== 'undefined' && window.THREE) return window.THREE;
    if (typeof globalThis !== 'undefined' && globalThis.THREE) return globalThis.THREE;
    return null;
  }

  // ---------------------------------------------------------------------------
  // Bone name resolution
  // ---------------------------------------------------------------------------

  function normalizeKey(name) {
    return String(name || '')
      .replace(/^mixamorig[:_]?/i, '')
      .replace(/^DEF[-_.]?/i, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  /**
   * Resolve a Mesh2Motion / Mixamo / Rigify source bone name to its Anny v0.6.2 target bone name.
   * Returns `null` for unmapped/leaf bones.
   */
  function resolveAnnyBoneName(srcBoneName, customMap) {
    if (!srcBoneName) return null;
    if (customMap && customMap[srcBoneName]) return customMap[srcBoneName];
    if (BONE_MAP[srcBoneName]) return BONE_MAP[srcBoneName];
    const lower = srcBoneName.toLowerCase();
    if (BONE_MAP[lower]) return BONE_MAP[lower];
    const norm = normalizeKey(srcBoneName);
    if (CANONICAL_ALIASES[norm]) return CANONICAL_ALIASES[norm];
    return null;
  }

  // ---------------------------------------------------------------------------
  // Skeleton inspection (works on THREE.Object3D trees OR lightweight node maps)
  // ---------------------------------------------------------------------------

  function collectNodeIndex(rootObj) {
    const byName = new Map();
    if (!rootObj) return byName;

    function visit(node, parent) {
      if (!node) return;
      const name = node.name || '';
      const q = node.quaternion
        ? [node.quaternion.x, node.quaternion.y, node.quaternion.z, node.quaternion.w]
        : Array.isArray(node.rotation) && node.rotation.length === 4
          ? node.rotation.slice()
          : qIdentity();
      const p = node.position
        ? [node.position.x, node.position.y, node.position.z]
        : Array.isArray(node.translation) && node.translation.length === 3
          ? node.translation.slice()
          : [0, 0, 0];

      const parentEntry = parent ? byName.get(parent) : null;
      const worldQ = parentEntry ? qNormalize(qMul(parentEntry.worldQ, q)) : qNormalize(q);
      const rotP = parentEntry ? qRotateVec(parentEntry.worldQ, p) : p;
      const worldP = parentEntry
        ? [parentEntry.worldP[0] + rotP[0], parentEntry.worldP[1] + rotP[1], parentEntry.worldP[2] + rotP[2]]
        : rotP.slice();

      const entry = {
        name,
        node,
        parentName: parent || null,
        localQ: qNormalize(q),
        localP: p,
        worldQ,
        worldP,
      };
      if (name && !byName.has(name)) {
        byName.set(name, entry);
      }
      const children = node.children || [];
      for (let i = 0; i < children.length; i++) {
        visit(children[i], name || parent);
      }
    }

    visit(rootObj, null);
    return byName;
  }

  function sampleQuaternionTrack(track, time) {
    const times = track.times;
    const vals = track.values;
    const n = times.length;
    if (n === 0) return qIdentity();
    if (time <= times[0] || n === 1) {
      return qNormalize([vals[0], vals[1], vals[2], vals[3]]);
    }
    if (time >= times[n - 1]) {
      const o = (n - 1) * 4;
      return qNormalize([vals[o], vals[o + 1], vals[o + 2], vals[o + 3]]);
    }
    let lo = 0;
    let hi = n - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= time) lo = mid;
      else hi = mid;
    }
    const span = times[hi] - times[lo];
    const alpha = span > 1e-9 ? (time - times[lo]) / span : 0;
    const o0 = lo * 4;
    const o1 = hi * 4;
    return qSlerp(
      [vals[o0], vals[o0 + 1], vals[o0 + 2], vals[o0 + 3]],
      [vals[o1], vals[o1 + 1], vals[o1 + 2], vals[o1 + 3]],
      alpha
    );
  }

  function parseTrackName(trackName) {
    const dot = trackName.lastIndexOf('.');
    if (dot < 0) return { bone: trackName, prop: '' };
    return { bone: trackName.slice(0, dot), prop: trackName.slice(dot + 1) };
  }

  // ---------------------------------------------------------------------------
  // Core Retargeter: World-Space Rest-Pose Quaternion Delta + A-Pose Alignment
  // ---------------------------------------------------------------------------

  /**
   * Retarget a Mesh2Motion `THREE.AnimationClip` (or plain `{ name, duration, tracks }` clip)
   * onto an Anny 104-bone `.glb` root object.
   *
   * Math (axis-invariant world-space rest-pose delta):
   *   For each mapped bone `b` at keyframe time `t`:
   *     1. Evaluate source bone's absolute world rotation `Q_src_anim_W(b, t)` via FK along the
   *        source hierarchy.
   *     2. Compute world-space rest-pose delta:
   *          `D_world(b, t) = Q_src_anim_W(b, t) * conj(Q_src_rest_W(b))`
   *     3. Apply optional T-pose <-> A-pose arm bind alignment `Q_align(b)` so Anny's A-pose
   *        upper arms match Mesh2Motion's T-pose bind orientation:
   *          `Q_tgt_W(b, t) = D_world(b, t) * Q_align(b) * Q_tgt_rest_W(b)`
   *     4. Convert back to target local space relative to its animated parent:
   *          `q_tgt_L(b, t) = conj(Q_tgt_W(parent(b), t)) * Q_tgt_W(b, t)`
   *        (When `D_world = I` and `Q_align = I`, this reduces identically to `q_rest_target`.)
   *
   * @param {Object} sourceClip - THREE.AnimationClip or `{ name, duration, tracks }`
   * @param {Object} sourceRoot - Source GLB scene/skeleton root (provides rest pose)
   * @param {Object} targetRoot - Target Anny GLB scene/skeleton root
   * @param {Object} [options]
   * @param {boolean} [options.lockRootMotion=true] - Zero horizontal XZ root translation
   * @param {boolean} [options.keepVerticalBounce=true] - Keep scaled Y hip bounce when locked
   * @param {number|null} [options.hipScale=null] - Override hip height ratio (auto-computed if null)
   * @param {boolean} [options.armBindAlign=true] - Auto-align T-pose source arms to Anny A-pose arms
   * @param {boolean} [options.includeFingers=true] - Retarget 30 finger bones if present
   * @param {Object} [options.customBoneMap=null] - Optional override/extension bone map
   * @param {string} [options.name] - Override output clip name
   * @param {Object} [options.THREE] - Optional THREE namespace override
   * @returns {Object} Retargeted THREE.AnimationClip (or plain clip object if THREE is absent),
   *                   annotated with `userData.retargetStats`.
   */
  function retargetClip(sourceClip, sourceRoot, targetRoot, options) {
    const opts = Object.assign(
      {
        lockRootMotion: true,
        keepVerticalBounce: true,
        hipScale: null,
        armBindAlign: true,
        includeFingers: true,
        customBoneMap: null,
        name: null,
        THREE: null,
      },
      options || {}
    );

    const THREE = getTHREE(opts);
    const srcNodes = collectNodeIndex(sourceRoot);
    const tgtNodes = collectNodeIndex(targetRoot);

    // Index source tracks by bone name
    const srcQuatTracks = new Map();
    const srcPosTracks = new Map();
    const tracks = sourceClip.tracks || [];
    for (let i = 0; i < tracks.length; i++) {
      const tr = tracks[i];
      const { bone, prop } = parseTrackName(tr.name);
      if (prop === 'quaternion') srcQuatTracks.set(bone, tr);
      else if (prop === 'position') srcPosTracks.set(bone, tr);
    }

    // Three.js GLTFLoader sanitizes dot-names (e.g. `upperarm01.L` -> `upperarm01L`)
    const resolveTargetNodeName = (name) => {
      if (!name) return null;
      if (tgtNodes.has(name)) return name;
      const stripped = name.replace(/\./g, '');
      if (tgtNodes.has(stripped)) return stripped;
      return null;
    };

    // Build T-pose <-> A-pose arm alignment quaternions in world space
    const armAlignByTarget = new Map();
    if (opts.armBindAlign) {
      for (let i = 0; i < ARM_ALIGN_PAIRS.length; i++) {
        const pair = ARM_ALIGN_PAIRS[i];
        const sA = srcNodes.get(pair.src);
        const sB = srcNodes.get(pair.srcChild);
        const tAName = resolveTargetNodeName(pair.tgt);
        const tBName = resolveTargetNodeName(pair.tgtChild);
        const tA = tAName ? tgtNodes.get(tAName) : null;
        const tB = tBName ? tgtNodes.get(tBName) : null;
        if (sA && sB && tA && tB) {
          const srcDir = vSub(sB.worldP, sA.worldP);
          const tgtDir = vSub(tB.worldP, tA.worldP);
          // Rotation in world space taking target rest arm vector -> source rest arm vector
          const qAlign = qFromUnitVectors(tgtDir, srcDir);
          armAlignByTarget.set(tAName, qAlign);
        }
      }
    }

    // Determine mapped bones that exist on BOTH source tracks and target skeleton
    const mappedPairs = [];
    const mappedByTarget = new Map();
    const unmappedSourceBones = [];

    srcQuatTracks.forEach((track, srcBone) => {
      const rawTgtBone = resolveAnnyBoneName(srcBone, opts.customBoneMap);
      if (!rawTgtBone) {
        unmappedSourceBones.push(srcBone);
        return;
      }
      if (!opts.includeFingers && rawTgtBone.startsWith('finger')) {
        return;
      }
      const tgtBone = resolveTargetNodeName(rawTgtBone);
      if (!tgtBone) {
        unmappedSourceBones.push(srcBone);
        return;
      }
      if (mappedByTarget.has(tgtBone)) return;
      const pair = { srcBone, tgtBone, track };
      mappedPairs.push(pair);
      mappedByTarget.set(tgtBone, pair);
    });

    // Helper: compute source bone's animated world quaternion at time `t`
    function evalSourceWorldQ(boneName, time, cache) {
      if (cache.has(boneName)) return cache.get(boneName);
      const entry = srcNodes.get(boneName);
      if (!entry) return qIdentity();
      const parentW = entry.parentName ? evalSourceWorldQ(entry.parentName, time, cache) : qIdentity();
      const tr = srcQuatTracks.get(boneName);
      const localQ = tr ? sampleQuaternionTrack(tr, time) : entry.localQ;
      const worldQ = qNormalize(qMul(parentW, localQ));
      cache.set(boneName, worldQ);
      return worldQ;
    }

    // Helper: compute target bone's animated world quaternion at time `t`
    // Walks target ancestor chain so intermediate unmapped Anny bones (e.g. spine02, upperarm02.L)
    // automatically carry their animated parent's world orientation!
    function evalTargetWorldQ(tgtBoneName, time, srcCache, tgtCache) {
      if (tgtCache.has(tgtBoneName)) return tgtCache.get(tgtBoneName);
      const tgtEntry = tgtNodes.get(tgtBoneName);
      if (!tgtEntry) return qIdentity();

      const mapped = mappedByTarget.get(tgtBoneName);
      let worldQ;
      if (mapped) {
        const srcEntry = srcNodes.get(mapped.srcBone);
        const srcRestW = srcEntry ? srcEntry.worldQ : qIdentity();
        const srcAnimW = evalSourceWorldQ(mapped.srcBone, time, srcCache);
        const worldDelta = qNormalize(qMul(srcAnimW, qConj(srcRestW)));
        const alignQ = armAlignByTarget.get(tgtBoneName) || qIdentity();
        // q_target_world = D_world * Q_align * Q_tgt_rest_W
        worldQ = qNormalize(qMul(worldDelta, qMul(alignQ, tgtEntry.worldQ)));
      } else {
        const parentW = tgtEntry.parentName
          ? evalTargetWorldQ(tgtEntry.parentName, time, srcCache, tgtCache)
          : qIdentity();
        worldQ = qNormalize(qMul(parentW, tgtEntry.localQ));
      }

      tgtCache.set(tgtBoneName, worldQ);
      return worldQ;
    }

    const outTracks = [];

    // 1. Retarget quaternion tracks
    for (let i = 0; i < mappedPairs.length; i++) {
      const { tgtBone, track } = mappedPairs[i];
      const tgtEntry = tgtNodes.get(tgtBone);
      const times = new Float32Array(track.times);
      const values = new Float32Array(times.length * 4);

      for (let k = 0; k < times.length; k++) {
        const t = times[k];
        const srcCache = new Map();
        const tgtCache = new Map();

        const targetW = evalTargetWorldQ(tgtBone, t, srcCache, tgtCache);
        const parentW = tgtEntry.parentName
          ? evalTargetWorldQ(tgtEntry.parentName, t, srcCache, tgtCache)
          : qIdentity();

        // q_target_local = conj(Q_tgt_parent_W) * Q_tgt_W
        const localQ = qNormalize(qMul(qConj(parentW), targetW));
        const o = k * 4;
        values[o] = localQ[0];
        values[o + 1] = localQ[1];
        values[o + 2] = localQ[2];
        values[o + 3] = localQ[3];
      }

      const trackName = tgtBone + '.quaternion';
      outTracks.push(
        THREE
          ? new THREE.QuaternionKeyframeTrack(trackName, times, values)
          : { name: trackName, type: 'quaternion', times, values }
      );
    }

    // 2. Retarget root position track (hip height scaled + optional XZ root-motion lock)
    let rootPosTrack = null;
    let rootSrcName = null;
    srcPosTracks.forEach((tr, bone) => {
      if (!rootPosTrack && ROOT_SOURCE_NAMES.has(bone.toLowerCase())) {
        rootPosTrack = tr;
        rootSrcName = bone;
      }
    });

    const tgtRootEntry = tgtNodes.get('root');
    let hipScaleUsed = 1.0;

    if (rootPosTrack && tgtRootEntry) {
      const srcRootEntry = srcNodes.get(rootSrcName);
      const srcParentEntry = srcRootEntry && srcRootEntry.parentName ? srcNodes.get(srcRootEntry.parentName) : null;
      const srcParentW = srcParentEntry ? srcParentEntry.worldQ : qIdentity();

      const srcRestWorldP = srcRootEntry ? srcRootEntry.worldP : [0, 0.917, 0];
      const tgtRestLocalP = tgtRootEntry.localP;
      const srcHipY = Math.max(0.1, srcRestWorldP[1]);
      const tgtHipY = Math.max(0.1, tgtRootEntry.worldP[1]);
      hipScaleUsed = typeof opts.hipScale === 'number' && opts.hipScale > 0 ? opts.hipScale : tgtHipY / srcHipY;

      const times = new Float32Array(rootPosTrack.times);
      const srcVals = rootPosTrack.values;
      const values = new Float32Array(times.length * 3);

      // Compute frame-0 world position as reference origin for XZ lock
      const f0World = qRotateVec(srcParentW, [srcVals[0], srcVals[1], srcVals[2]]);
      const refX = f0World[0];
      const refZ = f0World[2];
      const refY = srcRestWorldP[1];

      for (let k = 0; k < times.length; k++) {
        const o = k * 3;
        const wPos = qRotateVec(srcParentW, [srcVals[o], srcVals[o + 1], srcVals[o + 2]]);
        const dx = opts.lockRootMotion ? 0 : (wPos[0] - refX) * hipScaleUsed;
        const dy = opts.lockRootMotion && !opts.keepVerticalBounce ? 0 : (wPos[1] - refY) * hipScaleUsed;
        const dz = opts.lockRootMotion ? 0 : (wPos[2] - refZ) * hipScaleUsed;

        values[o] = tgtRestLocalP[0] + dx;
        values[o + 1] = tgtRestLocalP[1] + dy;
        values[o + 2] = tgtRestLocalP[2] + dz;
      }

      const trackName = 'root.position';
      outTracks.push(
        THREE
          ? new THREE.VectorKeyframeTrack(trackName, times, values)
          : { name: trackName, type: 'vector', times, values }
      );
    }

    const clipName = opts.name || sourceClip.name || 'm2m_retargeted';
    const duration = typeof sourceClip.duration === 'number' ? sourceClip.duration : -1;
    const outClip = THREE
      ? new THREE.AnimationClip(clipName, duration, outTracks)
      : { name: clipName, duration, tracks: outTracks };

    const stats = {
      sourceClipName: sourceClip.name || clipName,
      mappedBoneCount: mappedPairs.length,
      totalSourceQuatTracks: srcQuatTracks.size,
      unmappedSourceBones,
      armBindAligned: Array.from(armAlignByTarget.keys()),
      lockRootMotion: !!opts.lockRootMotion,
      hipScale: +hipScaleUsed.toFixed(4),
      trackCount: outTracks.length,
    };
    outClip.userData = Object.assign(outClip.userData || {}, { retargetStats: stats });
    return outClip;
  }

  // ---------------------------------------------------------------------------
  // GLB Clip Loader (cached, supports custom GLTFLoader instance)
  // ---------------------------------------------------------------------------

  const _clipCache = new Map();

  function getGLTFLoader(opts) {
    let loader = null;
    if (opts && opts.loader) {
      loader = opts.loader;
    } else {
      const THREE = getTHREE(opts);
      if (THREE && THREE.GLTFLoader) loader = new THREE.GLTFLoader();
      else if (typeof window !== 'undefined' && window.GLTFLoader) loader = new window.GLTFLoader();
    }
    if (!loader) {
      throw new Error(
        'Mesh2MotionAnny: No GLTFLoader found. Pass `{ loader: new GLTFLoader() }` or attach THREE.GLTFLoader.'
      );
    }
    // Mesh2Motion CC0 GLBs use EXT_meshopt_compression; auto-wire MeshoptDecoder if available
    const decoder =
      (opts && opts.meshoptDecoder) ||
      (typeof window !== 'undefined' && window.MeshoptDecoder) ||
      (typeof globalThis !== 'undefined' && globalThis.MeshoptDecoder) ||
      null;
    if (decoder && typeof loader.setMeshoptDecoder === 'function') {
      loader.setMeshoptDecoder(decoder);
    }
    return loader;
  }

  /**
   * Load a Mesh2Motion CC0 `.glb` animation clip (humanoid or quadruped).
   * @param {string} url
   * @param {Object} [options] - `{ loader, THREE, cache: true }`
   * @returns {Promise<{ clip: THREE.AnimationClip, clips: THREE.AnimationClip[], sourceRoot: THREE.Object3D, gltf: Object }>}
   */
  function loadClip(url, options) {
    const opts = options || {};
    const useCache = opts.cache !== false;
    if (useCache && _clipCache.has(url)) {
      return _clipCache.get(url);
    }

    const loader = getGLTFLoader(opts);
    const promise = new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const clips = gltf.animations || [];
          const clip = clips[0] || null;
          if (!clip) {
            reject(new Error('Mesh2MotionAnny: GLB contains no animation clips: ' + url));
            return;
          }
          resolve({
            url,
            clip,
            clips,
            sourceRoot: gltf.scene,
            gltf,
          });
        },
        undefined,
        (err) => reject(err)
      );
    });

    if (useCache) _clipCache.set(url, promise);
    return promise;
  }

  function clearCache() {
    _clipCache.clear();
  }

  // ---------------------------------------------------------------------------
  // Anny Runtime AnimationMixer Driver
  // ---------------------------------------------------------------------------

  /**
   * Create a runtime AnimationMixer driver bound to an Anny 104-bone `.glb` root.
   *
   * @param {THREE.Object3D} targetRoot - Loaded Anny GLB scene/character root
   * @param {Object} [options]
   * @param {Object} [options.THREE] - Optional THREE namespace
   * @param {Object} [options.loader] - Optional GLTFLoader instance
   * @param {string} [options.baseUrl] - Base URL to `motion-pipeline/mesh2motion/clips/`
   * @param {boolean} [options.lockRootMotion=true]
   * @param {boolean} [options.armBindAlign=true]
   * @param {boolean} [options.includeFingers=true]
   * @param {number} [options.defaultFade=0.25]
   * @param {number} [options.speed=1.0]
   */
  function createAnnyDriver(targetRoot, options) {
    const opts = Object.assign(
      {
        THREE: null,
        loader: null,
        baseUrl: '',
        lockRootMotion: true,
        keepVerticalBounce: true,
        armBindAlign: true,
        includeFingers: true,
        defaultFade: 0.25,
        speed: 1.0,
      },
      options || {}
    );

    const THREE = getTHREE(opts);
    if (!THREE || !THREE.AnimationMixer) {
      throw new Error('Mesh2MotionAnny.createAnnyDriver requires THREE.AnimationMixer.');
    }

    const mixer = new THREE.AnimationMixer(targetRoot);
    const clips = new Map();      // name -> retargeted THREE.AnimationClip
    const rawSources = new Map(); // name -> { clip, sourceRoot }
    const actions = new Map();    // name -> THREE.AnimationAction
    let currentName = null;
    let currentAction = null;
    let speed = opts.speed;
    let paused = false;
    let lockRootMotion = !!opts.lockRootMotion;

    function resolveUrl(nameOrUrl) {
      if (/^(https?:|\/|\.\.?\/)/.test(nameOrUrl) || nameOrUrl.endsWith('.glb')) {
        return opts.baseUrl && !/^(https?:|\/)/.test(nameOrUrl)
          ? opts.baseUrl.replace(/\/+$/, '') + '/' + nameOrUrl.replace(/^\/+/, '')
          : nameOrUrl;
      }
      const file = CLIPS[nameOrUrl] || nameOrUrl + '.glb';
      return opts.baseUrl ? opts.baseUrl.replace(/\/+$/, '') + '/' + file : file;
    }

    function registerClip(name, sourceClip, sourceRoot, retargetOpts) {
      rawSources.set(name, { clip: sourceClip, sourceRoot });
      const retargeted = retargetClip(
        sourceClip,
        sourceRoot,
        targetRoot,
        Object.assign(
          {
            name,
            THREE,
            lockRootMotion,
            keepVerticalBounce: opts.keepVerticalBounce,
            armBindAlign: opts.armBindAlign,
            includeFingers: opts.includeFingers,
          },
          retargetOpts || {}
        )
      );
      clips.set(name, retargeted);
      const action = mixer.clipAction(retargeted);
      actions.set(name, action);
      return retargeted;
    }

    async function loadClipByName(name, urlOverride, retargetOpts) {
      const url = resolveUrl(urlOverride || name);
      const loaded = await loadClip(url, { loader: opts.loader, THREE });
      return registerClip(name, loaded.clip, loaded.sourceRoot, retargetOpts);
    }

    async function loadLibrary(clipNames, baseUrlOverride) {
      if (baseUrlOverride) opts.baseUrl = baseUrlOverride;
      const names = Array.isArray(clipNames) && clipNames.length
        ? clipNames
        : ['idle', 'walk', 'jog', 'sprint', 'jump'];
      const results = {};
      await Promise.all(
        names.map(async (nm) => {
          results[nm] = await loadClipByName(nm);
        })
      );
      return results;
    }

    function play(name, playOpts) {
      const action = actions.get(name);
      if (!action) {
        throw new Error('Mesh2MotionAnny: Clip not loaded on driver: ' + name);
      }
      const p = Object.assign(
        {
          fadeDuration: opts.defaultFade,
          loop: THREE.LoopRepeat,
          repetitions: Infinity,
          clampWhenFinished: false,
          speed: null,
          reset: true,
        },
        playOpts || {}
      );

      if (typeof p.speed === 'number') speed = p.speed;
      action.setLoop(p.loop, p.repetitions);
      action.clampWhenFinished = !!p.clampWhenFinished;
      action.enabled = true;
      action.setEffectiveTimeScale(paused ? 0 : speed);
      action.setEffectiveWeight(1);

      if (p.reset) action.reset();

      if (currentAction && currentAction !== action && p.fadeDuration > 0) {
        action.play();
        currentAction.crossFadeTo(action, p.fadeDuration, true);
      } else {
        if (currentAction && currentAction !== action) {
          currentAction.stop();
        }
        action.play();
      }

      currentName = name;
      currentAction = action;
      return action;
    }

    function crossFadeTo(name, duration) {
      return play(name, { fadeDuration: typeof duration === 'number' ? duration : opts.defaultFade });
    }

    function setSpeed(nextSpeed) {
      speed = Number(nextSpeed);
      if (!Number.isFinite(speed)) speed = 1.0;
      if (currentAction && !paused) {
        currentAction.setEffectiveTimeScale(speed);
      }
      return speed;
    }

    function getSpeed() {
      return speed;
    }

    function setRootMotionLock(locked) {
      lockRootMotion = !!locked;
      // Rebuild retargeted clips cleanly with new lock setting
      const active = currentName;
      rawSources.forEach((raw, nm) => {
        const prevAction = actions.get(nm);
        if (prevAction) prevAction.stop();
        registerClip(nm, raw.clip, raw.sourceRoot, { lockRootMotion });
      });
      if (active && actions.has(active)) {
        play(active, { fadeDuration: 0, reset: false });
      }
      return lockRootMotion;
    }

    function pause() {
      paused = true;
      if (currentAction) currentAction.setEffectiveTimeScale(0);
    }

    function resume() {
      paused = false;
      if (currentAction) currentAction.setEffectiveTimeScale(speed);
    }

    function stop() {
      mixer.stopAllAction();
      currentAction = null;
      currentName = null;
    }

    function update(deltaSeconds) {
      if (!paused && deltaSeconds > 0) {
        mixer.update(deltaSeconds);
      }
    }

    function getClipNames() {
      return Array.from(clips.keys());
    }

    function getBoneCoverage(clipName) {
      const nm = clipName || currentName || getClipNames()[0];
      const clip = nm ? clips.get(nm) : null;
      return clip && clip.userData ? clip.userData.retargetStats : null;
    }

    function getState() {
      return {
        currentClip: currentName,
        speed,
        paused,
        lockRootMotion,
        loadedClips: getClipNames(),
      };
    }

    function dispose() {
      stop();
      mixer.uncacheRoot(targetRoot);
      clips.clear();
      rawSources.clear();
      actions.clear();
    }

    return {
      mixer,
      targetRoot,
      registerClip,
      loadClip: loadClipByName,
      loadLibrary,
      play,
      crossFadeTo,
      setSpeed,
      getSpeed,
      setRootMotionLock,
      pause,
      resume,
      stop,
      update,
      getClipNames,
      getBoneCoverage,
      getState,
      dispose,
    };
  }

  // ---------------------------------------------------------------------------
  // CC0 Quadruped Clip Loader & Driver (`horse-idle`, `horse-walk`, `horse-trot`)
  // ---------------------------------------------------------------------------

  /**
   * Load a Mesh2Motion CC0 quadruped `.glb` clip (e.g. `horse-idle.glb`, `horse-walk.glb`, `horse-trot.glb`).
   * @param {string} urlOrName - Full URL or key from `QUADRUPED_CLIPS`
   * @param {Object} [options] - `{ baseUrl, loader, THREE, cache }`
   */
  function loadQuadrupedClip(urlOrName, options) {
    const opts = options || {};
    let url = urlOrName;
    if (QUADRUPED_CLIPS[urlOrName]) {
      const base = (opts.baseUrl || '').replace(/\/+$/, '');
      url = base ? base + '/' + QUADRUPED_CLIPS[urlOrName] : QUADRUPED_CLIPS[urlOrName];
    }
    return loadClip(url, opts);
  }

  /**
   * Create a lightweight AnimationMixer driver for a quadruped rig (either native Mesh2Motion
   * horse/quadruped hierarchy or a custom bone-mapped quadruped via `customBoneMap`).
   */
  function createQuadrupedDriver(targetRoot, options) {
    const opts = Object.assign(
      {
        THREE: null,
        loader: null,
        baseUrl: '',
        customBoneMap: null,
        defaultFade: 0.25,
        speed: 1.0,
      },
      options || {}
    );
    const THREE = getTHREE(opts);
    if (!THREE || !THREE.AnimationMixer) {
      throw new Error('Mesh2MotionAnny.createQuadrupedDriver requires THREE.AnimationMixer.');
    }

    const mixer = new THREE.AnimationMixer(targetRoot);
    const actions = new Map();
    const clips = new Map();
    let currentAction = null;
    let currentName = null;
    let speed = opts.speed;

    async function loadClipByName(name, urlOverride) {
      const loaded = await loadQuadrupedClip(urlOverride || name, {
        baseUrl: opts.baseUrl,
        loader: opts.loader,
        THREE,
      });
      const clip = opts.customBoneMap
        ? retargetClip(loaded.clip, loaded.sourceRoot, targetRoot, {
            name,
            THREE,
            armBindAlign: false,
            includeFingers: false,
            customBoneMap: opts.customBoneMap,
          })
        : loaded.clip;
      clips.set(name, clip);
      actions.set(name, mixer.clipAction(clip));
      return clip;
    }

    function play(name, fadeDuration) {
      const action = actions.get(name);
      if (!action) throw new Error('Mesh2MotionAnny: Quadruped clip not loaded: ' + name);
      const fade = typeof fadeDuration === 'number' ? fadeDuration : opts.defaultFade;
      action.reset();
      action.setEffectiveTimeScale(speed);
      action.setEffectiveWeight(1);
      if (currentAction && currentAction !== action && fade > 0) {
        action.play();
        currentAction.crossFadeTo(action, fade, true);
      } else {
        if (currentAction && currentAction !== action) currentAction.stop();
        action.play();
      }
      currentAction = action;
      currentName = name;
      return action;
    }

    function setSpeed(s) {
      speed = Number.isFinite(Number(s)) ? Number(s) : 1.0;
      if (currentAction) currentAction.setEffectiveTimeScale(speed);
      return speed;
    }

    function update(dt) {
      if (dt > 0) mixer.update(dt);
    }

    function dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(targetRoot);
      actions.clear();
      clips.clear();
      currentAction = null;
      currentName = null;
    }

    return {
      mixer,
      targetRoot,
      loadClip: loadClipByName,
      play,
      crossFadeTo: play,
      setSpeed,
      update,
      getClipNames: () => Array.from(clips.keys()),
      getCurrentClip: () => currentName,
      dispose,
    };
  }

  return Object.freeze({
    VERSION,
    CLIPS,
    QUADRUPED_CLIPS,
    BONE_MAP,
    resolveAnnyBoneName,
    retargetClip,
    loadClip,
    clearCache,
    createAnnyDriver,
    loadQuadrupedClip,
    createQuadrupedDriver,
  });
});
