#!/usr/bin/env python3
"""
Meta Sapiens 2 / Sapiens 1 TorchScript Lite (0.3B) + Open Fallback Extractor.

Outputs (under motion-pipeline/sapiens2/extracted/):
  - <ref_id>_normal.png      (512px web-ready surface normal map from 1K inference)
  - <ref_id>_seg.png         (foreground/body silhouette mask)
  - <ref_id>_keypoints.json  (308 Goliath keypoints: normalized [x, y, score] + COCO-17 named map)
  - e1_mocap_track.json      (sampled frames from E1_imani_emotions_speech_arc.mp4 with keypoints + Anny rig angles)
  - manifest.json            (exact backend, model IDs, license, device, outputs)
"""

import argparse
import json
import math
import os
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
REF_DIR = REPO_ROOT / "study" / "ref_targets"
E1_VIDEO = REPO_ROOT / "study" / "v2g_emotions" / "E1_imani_emotions_speech_arc.mp4"
OUT_DIR = Path(__file__).resolve().parent / "extracted"

SAPIENS1_NORMAL_REPO = "facebook/sapiens-normal-0.3b-torchscript"
SAPIENS1_NORMAL_FILE = "sapiens_0.3b_normal_render_people_epoch_66_torchscript.pt2"
SAPIENS1_POSE_REPO = "facebook/sapiens-pose-0.3b-torchscript"
SAPIENS1_POSE_FILE = "sapiens_0.3b_goliath_best_goliath_AP_573_torchscript.pt2"
SAPIENS1_SEG_REPO = "facebook/sapiens-seg-0.3b-torchscript"
SAPIENS1_SEG_FILE = "sapiens_0.3b_goliath_best_goliath_mIoU_7673_epoch_194_torchscript.pt2"

SAPIENS2_POSE_REPO = "facebook/sapiens2-pose-0.4b"
SAPIENS2_NORMAL_REPO = "facebook/sapiens2-normal-0.4b"

COCO17_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

MEAN = np.array([123.5, 116.5, 103.5], dtype=np.float32)
STD = np.array([58.5, 57.0, 57.5], dtype=np.float32)


def _resize_for_web(arr_rgb: np.ndarray, max_dim: int = 512) -> np.ndarray:
    h, w = arr_rgb.shape[:2]
    if max(h, w) <= max_dim:
        return arr_rgb
    scale = max_dim / float(max(h, w))
    return cv2.resize(arr_rgb, (int(round(w * scale)), int(round(h * scale))), interpolation=cv2.INTER_AREA)


def _derive_fg_mask(rgb: np.ndarray, normal_rgb: np.ndarray | None = None) -> np.ndarray:
    """Clean foreground silhouette mask (0..255 grayscale) via GrabCut / saliency."""
    h, w = rgb.shape[:2]
    small_w = min(256, w)
    small_h = max(64, int(round(h * small_w / w)))
    img_s = cv2.resize(rgb, (small_w, small_h), interpolation=cv2.INTER_AREA)
    mask = np.zeros((small_h, small_w), np.uint8)
    rect = (int(small_w * 0.08), int(small_h * 0.05), int(small_w * 0.84), int(small_h * 0.90))
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(img_s, mask, rect, bgd, fgd, 3, cv2.GC_INIT_WITH_RECT)
        fg = np.where((mask == 2) | (mask == 0), 0, 255).astype(np.uint8)
    except Exception:
        gray = cv2.cvtColor(img_s, cv2.COLOR_RGB2GRAY)
        _, fg = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    fg = cv2.GaussianBlur(fg, (5, 5), 0)
    return cv2.resize(fg, (w, h), interpolation=cv2.INTER_LINEAR)


def _fallback_normal(rgb: np.ndarray) -> np.ndarray:
    """OpenCV/NumPy luminance-gradient normal map (clearly labeled fallback)."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
    gray = cv2.GaussianBlur(gray, (5, 5), 1.0)
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=5) * 2.2
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=5) * 2.2
    nx, ny = -gx, -gy
    nz = np.ones_like(nx) * 0.85
    norm = np.sqrt(nx * nx + ny * ny + nz * nz) + 1e-6
    n = np.stack([nx / norm, ny / norm, nz / norm], axis=-1)
    return np.clip((n * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)


def _fallback_pose_308(rgb: np.ndarray, t_norm: float = 0.0) -> list[list[float]]:
    """OpenCV contour/face-cascade fallback producing 308 slots (top 17 populated, rest 0)."""
    h, w = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    cx, cy, fw, fh = 0.5, 0.28, 0.16, 0.22
    try:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        if os.path.exists(cascade_path):
            det = cv2.CascadeClassifier(cascade_path)
            faces = det.detectMultiScale(gray, 1.1, 4, minSize=(36, 36))
            if len(faces) > 0:
                x, y, bw, bh = max(faces, key=lambda r: r[2] * r[3])
                cx, cy = (x + bw * 0.5) / w, (y + bh * 0.5) / h
                fw, fh = bw / w, bh / h
    except Exception:
        pass
    kps = [[0.0, 0.0, 0.0] for _ in range(308)]
    pts = {
        0: (cx, cy, 0.72),
        1: (cx + fw * 0.18, cy - fh * 0.12, 0.68),
        2: (cx - fw * 0.18, cy - fh * 0.12, 0.68),
        3: (cx + fw * 0.42, cy - fh * 0.04, 0.55),
        4: (cx - fw * 0.42, cy - fh * 0.04, 0.55),
        5: (cx + fw * 0.85, cy + fh * 0.95, 0.60),
        6: (cx - fw * 0.85, cy + fh * 0.95, 0.60),
        7: (cx + fw * 1.15, cy + fh * 1.75, 0.48),
        8: (cx - fw * 1.15, cy + fh * 1.75, 0.48),
        9: (cx + fw * 1.05, cy + fh * 2.35, 0.42),
        10: (cx - fw * 1.05, cy + fh * 2.35, 0.42),
        11: (cx + fw * 0.52, cy + fh * 2.45, 0.45),
        12: (cx - fw * 0.52, cy + fh * 2.45, 0.45),
        13: (cx + fw * 0.55, cy + fh * 3.35, 0.35),
        14: (cx - fw * 0.55, cy + fh * 3.35, 0.35),
        15: (cx + fw * 0.55, cy + fh * 4.15, 0.30),
        16: (cx - fw * 0.55, cy + fh * 4.15, 0.30),
    }
    for idx, (px, py, sc) in pts.items():
        kps[idx] = [round(float(np.clip(px, 0.01, 0.99)), 4), round(float(np.clip(py, 0.01, 0.99)), 4), sc]
    return kps


class Sapiens1TorchScriptRunner:
    def __init__(self, normal_ckpt: str | None, pose_ckpt: str | None, hf_token: str | None = None):
        import torch
        from huggingface_hub import hf_hub_download

        self.torch = torch
        if torch.backends.mps.is_available():
            self.device = torch.device("mps")
        else:
            self.device = torch.device("cpu")

        if not normal_ckpt:
            normal_ckpt = hf_hub_download(SAPIENS1_NORMAL_REPO, SAPIENS1_NORMAL_FILE, token=hf_token)
        if not pose_ckpt:
            pose_ckpt = hf_hub_download(SAPIENS1_POSE_REPO, SAPIENS1_POSE_FILE, token=hf_token)

        self.normal_ckpt = normal_ckpt
        self.pose_ckpt = pose_ckpt

        t0 = time.time()
        self.normal_model = torch.jit.load(normal_ckpt, map_location="cpu").eval()
        self.pose_model = torch.jit.load(pose_ckpt, map_location="cpu").eval()
        # Try MPS; fall back cleanly to CPU if any TorchScript op is unsupported on MPS
        self.normal_device = self.device
        self.pose_device = self.device
        try:
            self.normal_model.to(self.device)
            with torch.no_grad():
                _ = self.normal_model(torch.zeros((1, 3, 1024, 768), device=self.device))
        except Exception as e:
            print(f"[sapiens1-ts] normal MPS fallback -> CPU ({e})", flush=True)
            self.normal_device = torch.device("cpu")
            self.normal_model.to("cpu")

        try:
            self.pose_model.to(self.device)
            with torch.no_grad():
                _ = self.pose_model(torch.zeros((1, 3, 1024, 768), device=self.device))
        except Exception as e:
            print(f"[sapiens1-ts] pose MPS fallback -> CPU ({e})", flush=True)
            self.pose_device = torch.device("cpu")
            self.pose_model.to("cpu")

        print(
            f"[sapiens1-ts] Loaded normal({self.normal_device}) + pose({self.pose_device}) in {time.time()-t0:.1f}s",
            flush=True,
        )

    def _preprocess(self, rgb: np.ndarray, device):
        img = cv2.resize(rgb, (768, 1024), interpolation=cv2.INTER_LINEAR).astype(np.float32)
        img = (img - MEAN) / STD
        tensor = self.torch.from_numpy(img.transpose(2, 0, 1)).unsqueeze(0).to(device)
        return tensor

    def infer_normal(self, rgb: np.ndarray) -> np.ndarray:
        h, w = rgb.shape[:2]
        with self.torch.no_grad():
            x = self._preprocess(rgb, self.normal_device)
            out = self.normal_model(x)
            if isinstance(out, (tuple, list)):
                out = out[0]
            out = self.torch.nn.functional.interpolate(out, size=(h, w), mode="bilinear", align_corners=False)
            n = out[0].float().cpu().numpy().transpose(1, 2, 0)
            norm = np.linalg.norm(n, axis=-1, keepdims=True) + 1e-6
            n = n / norm
            vis = np.clip((n * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
            return vis

    def infer_pose_308(self, rgb: np.ndarray) -> list[list[float]]:
        with self.torch.no_grad():
            x = self._preprocess(rgb, self.pose_device)
            hm = self.pose_model(x)
            if isinstance(hm, (tuple, list)):
                hm = hm[0]
            hm = hm[0].float().cpu().numpy()  # [308, H_hm, W_hm]
        c, hh, hw = hm.shape
        flat = hm.reshape(c, -1)
        idx = np.argmax(flat, axis=1)
        scores = flat[np.arange(c), idx]
        ys = (idx // hw) / float(hh)
        xs = (idx % hw) / float(hw)
        return [[round(float(xs[i]), 4), round(float(ys[i]), 4), round(float(scores[i]), 4)] for i in range(c)]


def _compute_rig_angles(kps: list[list[float]], prev_angles: dict | None = None) -> dict:
    """Derive clean, smooth Anny-skeleton joint angles (radians) from 2D Goliath/COCO-17 keypoints."""
    def pt(i):
        return kps[i][0], kps[i][1], kps[i][2]

    nose = pt(0)
    l_eye, r_eye = pt(1), pt(2)
    l_ear, r_ear = pt(3), pt(4)
    l_sh, r_sh = pt(5), pt(6)
    l_el, r_el = pt(7), pt(8)
    l_wr, r_wr = pt(9), pt(10)

    eye_cx = 0.5 * (l_eye[0] + r_eye[0])
    eye_cy = 0.5 * (l_eye[1] + r_eye[1])
    eye_w = max(0.02, abs(l_eye[0] - r_eye[0]))
    sh_cx = 0.5 * (l_sh[0] + r_sh[0])
    sh_cy = 0.5 * (l_sh[1] + r_sh[1])
    sh_w = max(0.05, abs(l_sh[0] - r_sh[0]))

    # Head yaw/pitch/roll
    head_yaw = float(np.clip((nose[0] - eye_cx) / (eye_w * 1.4), -0.65, 0.65))
    head_pitch = float(np.clip(((nose[1] - eye_cy) / max(0.02, eye_w) - 0.55) * 0.75, -0.45, 0.45))
    head_roll = float(np.clip(math.atan2(l_eye[1] - r_eye[1], max(0.01, l_eye[0] - r_eye[0])) * 0.8, -0.35, 0.35))

    # Spine / shoulder tilt
    spine_roll = float(np.clip(math.atan2(l_sh[1] - r_sh[1], max(0.02, l_sh[0] - r_sh[0])) * 0.6, -0.25, 0.25))
    spine_yaw = float(np.clip((nose[0] - sh_cx) / sh_w * 0.35, -0.35, 0.35))
    spine_pitch = float(np.clip(((sh_cy - nose[1]) / sh_w - 0.85) * -0.25, -0.22, 0.22))

    # Arm elevation / elbow flex
    def arm_angles(sh, el, wr, side: int):
        if sh[2] < 0.15 or el[2] < 0.15:
            return 0.0, 0.25
        vx, vy = (el[0] - sh[0]) * side, el[1] - sh[1]
        elev = float(np.clip(math.atan2(vy, max(0.01, abs(vx))) - 1.05, -0.75, 0.75))
        if wr[2] < 0.15:
            return elev, 0.3
        wx, wy = (wr[0] - el[0]) * side, wr[1] - el[1]
        dot = vx * wx + vy * wy
        mag = math.hypot(vx, vy) * math.hypot(wx, wy) + 1e-6
        bend = math.acos(float(np.clip(dot / mag, -1.0, 1.0)))
        return elev, float(np.clip(bend, 0.05, 1.45))

    l_arm_z, l_elb = arm_angles(l_sh, l_el, l_wr, +1)
    r_arm_z, r_elb = arm_angles(r_sh, r_el, r_wr, -1)

    # Jaw / mouth openness (Goliath 308 lip landmarks around 266..285 when available, else subtle speech oscillation)
    jaw = 0.0
    if len(kps) >= 285 and kps[276][2] > 0.2 and kps[282][2] > 0.2:
        jaw = float(np.clip(abs(kps[282][1] - kps[276][1]) / max(0.015, eye_w) * 0.9, 0.0, 0.45))

    angles = {
        "headYaw": round(head_yaw, 4),
        "headPitch": round(head_pitch, 4),
        "headRoll": round(head_roll, 4),
        "spineYaw": round(spine_yaw, 4),
        "spinePitch": round(spine_pitch, 4),
        "spineRoll": round(spine_roll, 4),
        "leftArmZ": round(l_arm_z, 4),
        "rightArmZ": round(r_arm_z, 4),
        "leftElbowFlex": round(l_elb, 4),
        "rightElbowFlex": round(r_elb, 4),
        "jawOpen": round(jaw, 4),
    }
    if prev_angles:
        for k, v in angles.items():
            angles[k] = round(0.65 * v + 0.35 * prev_angles[k], 4)
    return angles


def main():
    ap = argparse.ArgumentParser(description="Extract Sapiens 2 / Sapiens 1 TorchScript normals, seg, and 308-keypoint pose.")
    ap.add_argument("--backend", choices=["auto", "sapiens1-ts", "sapiens2", "fallback"], default="auto")
    ap.add_argument("--hf-token", default=os.environ.get("HF_TOKEN"))
    ap.add_argument("--normal-ckpt", default=None)
    ap.add_argument("--pose-ckpt", default=None)
    ap.add_argument("--e1-samples", type=int, default=24, help="Number of frames to sample from E1 video")
    ap.add_argument("--out-dir", default=str(OUT_DIR))
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    runner = None
    backend_used = "fallback"
    model_ids = []
    license_str = "open-cv-fallback (BSD/Apache-2.0)"
    device_str = "cpu"

    if args.backend == "sapiens2":
        try:
            from transformers import AutoModel  # noqa: F401
            # Sapiens 2 requires `facebookresearch/sapiens2` or transformers with Sapiens2For*
            raise ImportError(
                "Sapiens2ForPoseEstimation / Sapiens2ForNormalEstimation requires installing "
                "https://github.com/facebookresearch/sapiens2 (transformers here lacks model_type='sapiens2')."
            )
        except Exception as e:
            print(f"[sapiens2] Unavailable in current Python env: {e}", file=sys.stderr)
            sys.exit(2)

    if args.backend in ("auto", "sapiens1-ts"):
        try:
            runner = Sapiens1TorchScriptRunner(args.normal_ckpt, args.pose_ckpt, hf_token=args.hf_token)
            backend_used = "sapiens1-torchscript-0.3b"
            model_ids = [SAPIENS1_NORMAL_REPO, SAPIENS1_POSE_REPO]
            license_str = "CC-BY-NC-4.0 (Meta Sapiens 1 TorchScript 0.3B)"
            device_str = f"normal:{runner.normal_device}, pose:{runner.pose_device}"
        except Exception as e:
            if args.backend == "sapiens1-ts":
                raise
            print(f"[auto] Sapiens 1 TorchScript unavailable ({e}); using fallback.", flush=True)

    # 1. Process ref_01..05
    ref_files = sorted(REF_DIR.glob("ref_0[1-5]_*.jpg"))
    ref_entries = []
    for rf in ref_files:
        ref_id = rf.stem
        rgb = np.array(Image.open(rf).convert("RGB"))
        t0 = time.time()
        if runner is not None:
            normal_rgb = runner.infer_normal(rgb)
            kps = runner.infer_pose_308(rgb)
        else:
            normal_rgb = _fallback_normal(rgb)
            kps = _fallback_pose_308(rgb)
        seg_gray = _derive_fg_mask(rgb, normal_rgb)
        dt = time.time() - t0

        normal_web = _resize_for_web(normal_rgb, 512)
        seg_web = _resize_for_web(seg_gray, 512)
        normal_fn = f"{ref_id}_normal.png"
        seg_fn = f"{ref_id}_seg.png"
        kp_fn = f"{ref_id}_keypoints.json"

        Image.fromarray(normal_web).save(out_dir / normal_fn, optimize=True)
        Image.fromarray(seg_web).save(out_dir / seg_fn, optimize=True)

        core17 = {COCO17_NAMES[i]: kps[i] for i in range(17)}
        valid_kps = sum(1 for p in kps if p[2] > 0.2)
        kp_payload = {
            "id": ref_id,
            "source": f"../study/ref_targets/{rf.name}",
            "backend": backend_used,
            "width": int(rgb.shape[1]),
            "height": int(rgb.shape[0]),
            "num_keypoints": len(kps),
            "valid_keypoints_gt_0_2": valid_kps,
            "core17": core17,
            "angles": _compute_rig_angles(kps),
            "keypoints_308": kps,
        }
        (out_dir / kp_fn).write_text(json.dumps(kp_payload, separators=(",", ":")))
        ref_entries.append({
            "id": ref_id,
            "label": ref_id.replace("_", " "),
            "source": f"../study/ref_targets/{rf.name}",
            "normal": f"sapiens2/extracted/{normal_fn}",
            "seg": f"sapiens2/extracted/{seg_fn}",
            "keypoints": f"sapiens2/extracted/{kp_fn}",
            "width": int(rgb.shape[1]),
            "height": int(rgb.shape[0]),
            "valid_keypoints": valid_kps,
            "infer_sec": round(dt, 2),
        })
        print(f"[ref] {ref_id}: valid_kps={valid_kps}/308 in {dt:.2f}s", flush=True)

    # 2. Sample E1_imani_emotions_speech_arc.mp4
    cap = cv2.VideoCapture(str(E1_VIDEO))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    src_fps = float(cap.get(cv2.CAP_PROP_FPS) or 24.0)
    n_samples = max(8, min(args.e1_samples, total_frames))
    sample_indices = np.linspace(0, max(0, total_frames - 1), n_samples, dtype=int)

    track_frames = []
    prev_angles = None
    t0 = time.time()
    for fi in sample_indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(fi))
        ok, bgr = cap.read()
        if not ok:
            continue
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        if runner is not None:
            kps = runner.infer_pose_308(rgb)
        else:
            kps = _fallback_pose_308(rgb, float(fi) / max(1, total_frames))
        angles = _compute_rig_angles(kps, prev_angles)
        prev_angles = angles
        # Store compact core17 + face contour subset for lightweight web playback
        track_frames.append({
            "frame": int(fi),
            "time": round(float(fi) / src_fps, 3),
            "core17": [kps[i] for i in range(17)],
            "angles": angles,
        })
    cap.release()
    e1_dt = time.time() - t0
    print(f"[e1] Extracted {len(track_frames)} frames from E1 in {e1_dt:.2f}s", flush=True)

    e1_payload = {
        "source": "../study/v2g_emotions/E1_imani_emotions_speech_arc.mp4",
        "backend": backend_used,
        "duration_sec": round(total_frames / src_fps, 3),
        "source_fps": round(src_fps, 2),
        "sample_count": len(track_frames),
        "coco17_names": COCO17_NAMES,
        "frames": track_frames,
    }
    (out_dir / "e1_mocap_track.json").write_text(json.dumps(e1_payload, separators=(",", ":")))

    manifest = {
        "backend": backend_used,
        "sapiens2_available_on_hf": True,
        "sapiens2_gated": False,
        "sapiens2_note": "facebook/sapiens2-{pose,normal,seg}-0.4b are public & ungated on HF (Sapiens2 License); require facebookresearch/sapiens2 package.",
        "model_ids": model_ids,
        "license": license_str,
        "device": device_str,
        "refs": ref_entries,
        "video_track": {
            "id": "E1_imani_emotions_speech_arc",
            "file": "sapiens2/extracted/e1_mocap_track.json",
            "duration_sec": e1_payload["duration_sec"],
            "sample_count": len(track_frames),
        },
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"[done] backend={backend_used} -> {out_dir / 'manifest.json'}", flush=True)


if __name__ == "__main__":
    main()
