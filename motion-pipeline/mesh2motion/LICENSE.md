# Mesh2Motion CC0 Animation Assets — License & Provenance

All `.glb` animation clips in `clips/` are sourced from the open-source **Mesh2Motion** project and are licensed under **CC0 1.0 Universal (Public Domain Dedication)**.

## Provenance

- **Runtime GLB Repository**: `https://github.com/Mesh2Motion/mesh2motion-app`
  - **Commit**: `017169ae6f7574d8fa75d893c38c2776386ca40b` (`fix(retarget): bind arm extension controls when UI singleton is created before shared markup (#168)`)
  - **Asset License File**: `LICENSE-CC0.MD` (CC0 1.0 Universal — all 3D models, rigs, and animations in `static/assets/` are CC0; app code is MIT)
- **Blender Source Repository**: `https://github.com/Mesh2Motion/mesh2motion-assets`
  - **Commit**: `7e8d139c7119dccadcf330c88d1498019feb02c3` (`graphic design updates from release 14`)
  - **License File**: `LICENSE` (CC0 1.0 Universal)

## Curated Clip Manifest (`clips/`)

### Humanoid Clips (9 files, 565,576 bytes)

| Local File | Upstream Path (`static/assets/human/animations/`) | Size (bytes) | Purpose |
| :--- | :--- | ---: | :--- |
| `rest-pose.glb` | `rest-pose.glb` | 56,308 | Reference T-pose rest calibration |
| `idle.glb` | `idle-a.glb` | 61,684 | Standing idle |
| `idle-talking.glb` | `idle-talking.glb` | 69,116 | Conversational idle |
| `walk.glb` | `walk.glb` | 62,692 | Standard walk cycle |
| `walk-carry.glb` | `walk-carry.glb` | 61,472 | Carrying-load walk cycle |
| `jog.glb` | `jog.glb` | 59,744 | Jogging locomotion |
| `sprint.glb` | `sprint.glb` | 59,252 | Fast running / sprint |
| `jump.glb` | `jump-2.glb` | 60,588 | Action jump |
| `greeting.glb` | `greeting.glb` | 74,420 | Wave / social greeting |

### Quadruped Clips (3 files, 165,168 bytes)

| Local File | Upstream Path (`static/assets/horse/animations/`) | Size (bytes) | Purpose |
| :--- | :--- | ---: | :--- |
| `horse-idle.glb` | `idle.glb` | 54,896 | Quadruped standing idle |
| `horse-walk.glb` | `walk.glb` | 55,592 | Quadruped walk cycle |
| `horse-trot.glb` | `trot.glb` | 54,680 | Quadruped trot cycle |

**Total Curated Asset Size**: 730,444 bytes (~713 KB, well within the 2.5 MB budget).

## CC0 1.0 Universal Summary

The person who associated a work with this deed has dedicated the work to the public domain by waiving all of his or her rights to the work worldwide under copyright law, including all related and neighboring rights, to the extent allowed by law. You can copy, modify, distribute, and perform the work, even for commercial purposes, all without asking permission.

Full legal text: <https://creativecommons.org/publicdomain/zero/1.0/legalcode>
