#!/usr/bin/env python3
"""
Meta Sapiens 0.3B TorchScript (pose-308 + normal) Multi-Scene Video Tracker.

Runs cached Meta Sapiens 0.3B TorchScript checkpoints on Apple Silicon MPS
(zero re-download via local_files_only=True) across our 4 reference study reels:
  - E1: E1_imani_emotions_speech_arc.mp4
  - E2: E2_elder_youth_dialogue_reactions.mp4
  - E3: E3_expressive_hands_gestures_100mm.mp4
  - E4: E4_fullbody_emotional_acting_ensemble.mp4

Outputs under motion-pipeline/sapiens2/extracted/scenes/:
  - <scene_id>.json          (compact per-frame 308 Goliath keypoints, hands, mouth ratio, smoothed Anny 104-bone angles)
  - <scene_id>_normal.jpg    (384px quality-75 Sapiens normal-map preview from representative keyframe)
  - <scene_id>_overlay.jpg   (384px quality-75 RGB + Sapiens skeleton/hand/mouth overlay preview)
  - manifest.json            (scene catalog linking directly to ../study/v2g_emotions/<file>.mp4)
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
STUDY_EMOTIONS_DIR = REPO_ROOT / "study" / "v2g_emotions"
OUT_DIR = Path(__file__).resolve().parent / "extracted" / "scenes"

SAPIENS1_NORMAL_REPO = "facebook/sapiens-normal-0.3b-torchscript"
SAPIENS1_NORMAL_FILE = "sapiens_0.3b_normal_render_people_epoch_66_torchscript.pt2"
SAPIENS1_POSE_REPO = "facebook/sapiens-pose-0.3b-torchscript"
SAPIENS1_POSE_FILE = "sapiens_0.3b_goliath_best_goliath_AP_573_torchscript.pt2"

MEAN = np.array([123.5, 116.5, 103.5], dtype=np.float32)
STD = np.array([58.5, 57.0, 57.5], dtype=np.float32)

COCO17_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]

# Goliath 308 hand index ranges:
# 21..41 = right hand (41=wrist/palm root, 21..24=thumb tip->mcp, 25..28=index, 29..32=middle, 33..36=ring, 37..40=pinky)
# 42..62 = left hand  (62=wrist/palm root, 42..45=thumb tip->mcp, 46..49=index, 50..53=middle, 54..57=ring, 58..61=pinky)
RIGHT_HAND_SLICE = (21, 42)
LEFT_HAND_SLICE = (42, 63)
# Goliath 308 outer + inner lip cluster
LIP_SLICE = (188, 220)

SCENES = [
    {
        "id": "E1",
        "slug": "E1_imani_emotions_speech_arc",
        "title": "Speech & Emotions Arc (85mm)",
        "category": "speech_emotions",
        "file": "E1_imani_emotions_speech_arc.mp4",
        "focus": "facial_visemes_head_arc",
    },
    {
        "id": "E2",
        "slug": "E2_elder_youth_dialogue_reactions",
        "title": "Elder-Youth Dialogue & Reactions (85mm)",
        "category": "dialogue_reactions",
        "file": "E2_elder_youth_dialogue_reactions.mp4",
        "focus": "dialogue_turn_taking_handoff",
    },
    {
        "id": "E3",
        "slug": "E3_expressive_hands_gestures_100mm",
        "title": "Expressive Hands & Grips (100mm Macro)",
        "category": "hand_acting",
        "file": "E3_expressive_hands_gestures_100mm.mp4",
        "focus": "finger_curl_wrist_articulation",
    },
    {
        "id": "E4",
        "slug": "E4_fullbody_emotional_acting_ensemble",
        "title": "Full-Body Acting Ensemble (Eskista & Pour)",
        "category": "fullbody_acting",
        "file": "E4_fullbody_emotional_acting_ensemble.mp4",
        "focus": "spine_shoulders_arms_ensemble",
    },
]

COCO_EDGES = [
    (0, 1), (0, 2), (1, 3), (2, 4),
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),
    (5, 11), (6, 12), (11, 12),
    (11, 13), (13, 15), (12, 14), (14, 16),
]


def _finite(val: float, default: float = 0.0, lo: float | None = None, hi: float | None = None) -> float:
    if not isinstance(val, (int, float)) or not math.isfinite(val):
        val = default
    if lo is not None and val < lo:
        val = lo
    if hi is not None and val > hi:
        val = hi
    return float(val)


def _resize_max(rgb: np.ndarray, max_dim: int = 384) -> np.ndarray:
    h, w = rgb.shape[:2]
    if max(h, w) <= max_dim:
        return rgb
    scale = max_dim / float(max(h, w))
    return cv2.resize(rgb, (int(round(w * scale)), int(round(h * scale))), interpolation=cv2.INTER_AREA)


def _find_cached_checkpoint(repo_id: str, filename: str) -> str:
    from huggingface_hub import hf_hub_download

    try:
        return hf_hub_download(repo_id, filename, local_files_only=True)
    except Exception:
        # Fallback glob in standard HF cache directory
        hub_dir = Path.home() / ".cache" / "huggingface" / "hub"
        matches = sorted(hub_dir.glob(f"**/{filename}"))
        if matches:
            return str(matches[-1])
        raise FileNotFoundError(f"Cached Sapiens checkpoint not found locally: {repo_id}/{filename}")


class SapiensSceneTracker:
    def __init__(self) -> None:
        import torch

        self.torch = torch
        self.device = torch.device("mps") if torch.backends.mps.is_available() else torch.device("cpu")
        self.normal_ckpt = _find_cached_checkpoint(SAPIENS1_NORMAL_REPO, SAPIENS1_NORMAL_FILE)
        self.pose_ckpt = _find_cached_checkpoint(SAPIENS1_POSE_REPO, SAPIENS1_POSE_FILE)

        t0 = time.time()
        self.normal_model = torch.jit.load(self.normal_ckpt, map_location="cpu").eval()
        self.pose_model = torch.jit.load(self.pose_ckpt, map_location="cpu").eval()

        self.normal_device = self.device
        self.pose_device = self.device
        try:
            self.normal_model.to(self.device)
            with torch.no_grad():
                _ = self.normal_model(torch.zeros((1, 3, 1024, 768), device=self.device))
        except Exception as e:
            print(f"[sapiens] normal MPS fallback -> CPU ({e})", flush=True)
            self.normal_device = torch.device("cpu")
            self.normal_model.to("cpu")

        try:
            self.pose_model.to(self.device)
            with torch.no_grad():
                _ = self.pose_model(torch.zeros((1, 3, 1024, 768), device=self.device))
        except Exception as e:
            print(f"[sapiens] pose MPS fallback -> CPU ({e})", flush=True)
            self.pose_device = torch.device("cpu")
            self.pose_model.to("cpu")

        print(
            f"[sapiens] Loaded cached 0.3B TorchScript normal({self.normal_device}) + pose({self.pose_device}) "
            f"in {time.time() - t0:.2f}s",
            flush=True,
        )

    def _preprocess(self, rgb: np.ndarray, device: Any) -> Any:
        img = cv2.resize(rgb, (768, 1024), interpolation=cv2.INTER_LINEAR).astype(np.float32)
        img = (img - MEAN) / STD
        return self.torch.from_numpy(img.transpose(2, 0, 1)).unsqueeze(0).to(device)

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
            return np.clip((n * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)

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
        return [
            [
                round(_finite(float(xs[i]), 0.0, 0.0, 1.0), 3),
                round(_finite(float(ys[i]), 0.0, 0.0, 1.0), 3),
                round(_finite(float(scores[i]), 0.0, 0.0, 1.0), 3),
            ]
            for i in range(c)
        ]


def _hand_curl_and_wrist(
    hand21: list[list[float]],
    elbow: list[float],
    wrist: list[float],
    side: int,
) -> tuple[float, list[float], float, float]:
    """
    Compute finger curl scalar (0=open, 1=closed), per-finger [thumb, index, middle, ring, pinky] curls,
    and wrist flexion / roll (radians) from Goliath 21-kp hand block.
    Block layout: 0..3=thumb(tip->mcp), 4..7=index, 8..11=middle, 12..15=ring, 16..19=pinky, 20=wrist/root.
    """
    root = hand21[20] if hand21[20][2] >= 0.15 else wrist
    if root[2] < 0.15:
        return 0.25, [0.25, 0.25, 0.25, 0.25, 0.25], 0.0, 0.0

    # Estimate palm scale from wrist -> middle MCP (index 11) and index MCP (index 7)
    palm_refs = []
    for mcp_idx in (7, 11, 15):
        if hand21[mcp_idx][2] >= 0.15:
            palm_refs.append(math.hypot(hand21[mcp_idx][0] - root[0], hand21[mcp_idx][1] - root[1]))
    palm_len = max(0.015, float(np.mean(palm_refs))) if palm_refs else 0.045

    finger_curls = []
    for f_idx in range(5):
        tip = hand21[f_idx * 4 + 0]
        pip = hand21[f_idx * 4 + 2]
        mcp = hand21[f_idx * 4 + 3]
        if tip[2] >= 0.15 and mcp[2] >= 0.15:
            # Distance from tip to wrist normalized by palm length (open ~ 1.85..2.1, curled ~ 0.75..1.05)
            d_tip_root = math.hypot(tip[0] - root[0], tip[1] - root[1])
            ratio = d_tip_root / palm_len
            curl_dist = _finite((1.95 - ratio) / 1.15, 0.25, 0.0, 1.0)
            # Combine with bend angle at PIP if confident
            if pip[2] >= 0.15:
                v1x, v1y = pip[0] - mcp[0], pip[1] - mcp[1]
                v2x, v2y = tip[0] - pip[0], tip[1] - pip[1]
                mag = math.hypot(v1x, v1y) * math.hypot(v2x, v2y) + 1e-6
                cos_a = _finite((v1x * v2x + v1y * v2y) / mag, 1.0, -1.0, 1.0)
                curl_ang = _finite(math.acos(cos_a) / 2.2, 0.25, 0.0, 1.0)
                curl = 0.55 * curl_dist + 0.45 * curl_ang
            else:
                curl = curl_dist
            finger_curls.append(round(_finite(curl, 0.25, 0.0, 1.0), 3))
        else:
            finger_curls.append(0.25)

    avg_curl = round(float(np.mean(finger_curls)), 3)

    # Wrist flex & roll from forearm vector vs palm vector (root -> middle MCP)
    wrist_flex = 0.0
    wrist_roll = 0.0
    mid_mcp = hand21[11]
    idx_mcp = hand21[7]
    pnk_mcp = hand21[19]
    if elbow[2] >= 0.15 and wrist[2] >= 0.15 and mid_mcp[2] >= 0.15:
        fx, fy = wrist[0] - elbow[0], wrist[1] - elbow[1]
        px, py = mid_mcp[0] - root[0], mid_mcp[1] - root[1]
        cross = (fx * py - fy * px) * side
        dot = fx * px + fy * py
        wrist_flex = _finite(math.atan2(cross, dot + 1e-6) * 0.65, 0.0, -0.75, 0.75)
    if idx_mcp[2] >= 0.15 and pnk_mcp[2] >= 0.15:
        dx = (idx_mcp[0] - pnk_mcp[0]) * side
        dy = idx_mcp[1] - pnk_mcp[1]
        wrist_roll = _finite(math.atan2(dy, max(0.005, abs(dx))) * 0.5, 0.0, -0.75, 0.75)

    return avg_curl, finger_curls, round(wrist_flex, 4), round(wrist_roll, 4)


def _compute_mouth_open_ratio(kps: list[list[float]], eye_w: float) -> tuple[float, float]:
    """Compute normalized mouth opening ratio (0..1) and Anny jawOpen angle (radians, 0..0.48)."""
    lips = [kps[i] for i in range(LIP_SLICE[0], LIP_SLICE[1]) if kps[i][2] >= 0.25]
    if len(lips) < 6:
        return 0.0, 0.0
    xs = [p[0] for p in lips]
    ys = [p[1] for p in lips]
    mouth_w = max(0.012, max(xs) - min(xs))
    mouth_h = max(0.0, max(ys) - min(ys))
    # Aspect ratio relative to mouth width + eye width blend
    ar_w = mouth_h / mouth_w
    ar_e = mouth_h / max(0.02, eye_w)
    # Neutral closed lips have mouth_h / mouth_w ~ 0.28..0.35; open speech/awe reaches 0.65..1.15
    ratio = _finite((0.6 * ar_w + 0.4 * ar_e - 0.26) / 0.65, 0.0, 0.0, 1.0)
    jaw_open = _finite(ratio * 0.46, 0.0, 0.0, 0.48)
    return round(ratio, 4), round(jaw_open, 4)


def _compute_anny_angles(kps: list[list[float]]) -> tuple[dict[str, Any], float]:
    """Derive raw Anny 104-bone joint angles + hand curls + mouth ratio from 308 Goliath keypoints."""
    nose = kps[0]
    l_eye, r_eye = kps[1], kps[2]
    l_sh, r_sh = kps[5], kps[6]
    l_el, r_el = kps[7], kps[8]
    l_wr, r_wr = kps[9], kps[10]
    l_hip, r_hip = kps[11], kps[12]

    eye_cx = 0.5 * (l_eye[0] + r_eye[0])
    eye_cy = 0.5 * (l_eye[1] + r_eye[1])
    eye_w = max(0.02, abs(l_eye[0] - r_eye[0]))
    sh_cx = 0.5 * (l_sh[0] + r_sh[0])
    sh_cy = 0.5 * (l_sh[1] + r_sh[1])
    sh_w = max(0.05, abs(l_sh[0] - r_sh[0]))

    # Head yaw / pitch / roll
    if nose[2] >= 0.2 and l_eye[2] >= 0.2 and r_eye[2] >= 0.2:
        head_yaw = _finite((nose[0] - eye_cx) / (eye_w * 1.35), 0.0, -0.70, 0.70)
        head_pitch = _finite(((nose[1] - eye_cy) / eye_w - 0.52) * 0.75, 0.0, -0.48, 0.48)
        head_roll = _finite(math.atan2(l_eye[1] - r_eye[1], max(0.01, l_eye[0] - r_eye[0])) * 0.85, 0.0, -0.38, 0.38)
    else:
        head_yaw, head_pitch, head_roll = 0.0, 0.0, 0.0

    # Spine lean (yaw / pitch / roll)
    if l_sh[2] >= 0.2 and r_sh[2] >= 0.2:
        spine_roll = _finite(math.atan2(l_sh[1] - r_sh[1], max(0.02, l_sh[0] - r_sh[0])) * 0.65, 0.0, -0.30, 0.30)
        spine_yaw = _finite(((nose[0] - sh_cx) / sh_w) * 0.35, 0.0, -0.40, 0.40) if nose[2] >= 0.2 else 0.0
        if l_hip[2] >= 0.2 and r_hip[2] >= 0.2:
            hip_cx = 0.5 * (l_hip[0] + r_hip[0])
            hip_cy = 0.5 * (l_hip[1] + r_hip[1])
            torso_h = max(0.08, hip_cy - sh_cy)
            spine_roll = _finite(
                0.55 * spine_roll + 0.45 * math.atan2(sh_cx - hip_cx, torso_h),
                0.0,
                -0.32,
                0.32,
            )
            spine_pitch = _finite((torso_h / sh_w - 1.35) * -0.25, 0.0, -0.28, 0.28)
        else:
            spine_pitch = _finite(((sh_cy - nose[1]) / sh_w - 0.85) * -0.25, 0.0, -0.25, 0.25) if nose[2] >= 0.2 else 0.0
    else:
        spine_yaw, spine_pitch, spine_roll = 0.0, 0.0, 0.0

    # Shoulders & elbows
    def arm_joints(sh: list[float], el: list[float], wr: list[float], side: int) -> tuple[float, float, float]:
        if sh[2] < 0.15 or el[2] < 0.15:
            return 0.0, 0.0, 0.25
        vx, vy = (el[0] - sh[0]) * side, el[1] - sh[1]
        sh_z = _finite(math.atan2(vy, max(0.01, abs(vx))) - 1.05, 0.0, -0.85, 0.85)
        sh_x = _finite((-vy / max(0.05, sh_w) + 0.65) * 0.45, 0.0, -0.75, 0.95)
        if wr[2] < 0.15:
            return sh_x, sh_z, 0.30
        wx, wy = (wr[0] - el[0]) * side, wr[1] - el[1]
        dot = vx * wx + vy * wy
        mag = math.hypot(vx, vy) * math.hypot(wx, wy) + 1e-6
        bend = _finite(math.acos(_finite(dot / mag, 0.0, -1.0, 1.0)), 0.30, 0.05, 1.55)
        return sh_x, sh_z, bend

    l_sh_x, l_sh_z, l_elb = arm_joints(l_sh, l_el, l_wr, +1)
    r_sh_x, r_sh_z, r_elb = arm_joints(r_sh, r_el, r_wr, -1)

    # Hands & wrists
    r_hand21 = kps[RIGHT_HAND_SLICE[0]:RIGHT_HAND_SLICE[1]]
    l_hand21 = kps[LEFT_HAND_SLICE[0]:LEFT_HAND_SLICE[1]]
    l_curl, l_fingers, l_wr_flex, l_wr_roll = _hand_curl_and_wrist(l_hand21, l_el, l_wr, +1)
    r_curl, r_fingers, r_wr_flex, r_wr_roll = _hand_curl_and_wrist(r_hand21, r_el, r_wr, -1)

    mouth_ratio, jaw_open = _compute_mouth_open_ratio(kps, eye_w)

    angles = {
        "headYaw": round(head_yaw, 4),
        "headPitch": round(head_pitch, 4),
        "headRoll": round(head_roll, 4),
        "spineYaw": round(spine_yaw, 4),
        "spinePitch": round(spine_pitch, 4),
        "spineRoll": round(spine_roll, 4),
        "leftShoulderX": round(l_sh_x, 4),
        "leftArmZ": round(l_sh_z, 4),
        "rightShoulderX": round(r_sh_x, 4),
        "rightArmZ": round(r_sh_z, 4),
        "leftElbowFlex": round(l_elb, 4),
        "rightElbowFlex": round(r_elb, 4),
        "leftWristFlex": round(l_wr_flex, 4),
        "leftWristRoll": round(l_wr_roll, 4),
        "rightWristFlex": round(r_wr_flex, 4),
        "rightWristRoll": round(r_wr_roll, 4),
        "leftFingerCurl": round(l_curl, 4),
        "rightFingerCurl": round(r_curl, 4),
        "leftFingers": l_fingers,
        "rightFingers": r_fingers,
        "jawOpen": round(jaw_open, 4),
    }
    return angles, mouth_ratio


def _smooth_angle_sequence(frames: list[dict[str, Any]]) -> None:
    """Zero-phase 3-tap temporal smoothing [0.22, 0.56, 0.22] over all scalar & finger angles."""
    n = len(frames)
    if n < 3:
        return
    scalar_keys = [k for k, v in frames[0]["angles"].items() if isinstance(v, (int, float))]
    list_keys = [k for k, v in frames[0]["angles"].items() if isinstance(v, list)]

    orig_angles = [dict(f["angles"]) for f in frames]
    orig_mouth = [f["mouthOpenRatio"] for f in frames]

    for i in range(n):
        im = max(0, i - 1)
        ip = min(n - 1, i + 1)
        for k in scalar_keys:
            val = 0.22 * orig_angles[im][k] + 0.56 * orig_angles[i][k] + 0.22 * orig_angles[ip][k]
            frames[i]["angles"][k] = round(_finite(val, 0.0), 4)
        for k in list_keys:
            frames[i]["angles"][k] = [
                round(_finite(0.22 * orig_angles[im][k][j] + 0.56 * orig_angles[i][k][j] + 0.22 * orig_angles[ip][k][j], 0.25, 0.0, 1.0), 3)
                for j in range(len(orig_angles[i][k]))
            ]
        mval = 0.22 * orig_mouth[im] + 0.56 * orig_mouth[i] + 0.22 * orig_mouth[ip]
        frames[i]["mouthOpenRatio"] = round(_finite(mval, 0.0, 0.0, 1.0), 4)


def _draw_overlay(rgb: np.ndarray, kps: list[list[float]]) -> np.ndarray:
    """Draw clean Sapiens body + hand + mouth overlay on RGB frame for preview JPEG."""
    vis = rgb.copy()
    h, w = vis.shape[:2]
    # Body edges
    for a, b in COCO_EDGES:
        if kps[a][2] >= 0.2 and kps[b][2] >= 0.2:
            pa = (int(kps[a][0] * w), int(kps[a][1] * h))
            pb = (int(kps[b][0] * w), int(kps[b][1] * h))
            cv2.line(vis, pa, pb, (80, 235, 190), 2, cv2.LINE_AA)
    # Body joints
    for i in range(17):
        if kps[i][2] >= 0.2:
            cv2.circle(vis, (int(kps[i][0] * w), int(kps[i][1] * h)), 4, (255, 210, 80), -1, cv2.LINE_AA)
    # Hands (right=coral, left=cyan)
    for start, end, color in (
        (RIGHT_HAND_SLICE[0], RIGHT_HAND_SLICE[1], (255, 120, 90)),
        (LEFT_HAND_SLICE[0], LEFT_HAND_SLICE[1], (90, 200, 255)),
    ):
        for i in range(start, end):
            if kps[i][2] >= 0.2:
                cv2.circle(vis, (int(kps[i][0] * w), int(kps[i][1] * h)), 2, color, -1, cv2.LINE_AA)
    # Lips
    for i in range(LIP_SLICE[0], LIP_SLICE[1]):
        if kps[i][2] >= 0.25:
            cv2.circle(vis, (int(kps[i][0] * w), int(kps[i][1] * h)), 2, (255, 95, 160), -1, cv2.LINE_AA)
    return vis


def _check_no_nans(obj: Any, path: str = "root") -> int:
    bad = 0
    if isinstance(obj, float):
        if not math.isfinite(obj):
            return 1
    elif isinstance(obj, dict):
        for k, v in obj.items():
            bad += _check_no_nans(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for idx, v in enumerate(obj):
            bad += _check_no_nans(v, f"{path}[{idx}]")
    return bad


def main() -> None:
    ap = argparse.ArgumentParser(description="Track 4 reference study videos with cached Meta Sapiens 0.3B TorchScript on MPS.")
    ap.add_argument("--samples", type=int, default=18, help="Evenly spaced keyframes per video (16-20 recommended)")
    ap.add_argument("--preview-dim", type=int, default=384, help="Max dimension for preview JPEGs")
    ap.add_argument("--preview-quality", type=int, default=75, help="JPEG quality for preview images")
    ap.add_argument("--out-dir", default=str(OUT_DIR))
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    tracker = SapiensSceneTracker()
    manifest_scenes: list[dict[str, Any]] = []
    total_json_bytes = 0
    t_all = time.time()

    for scene in SCENES:
        video_path = STUDY_EMOTIONS_DIR / scene["file"]
        if not video_path.exists():
            raise FileNotFoundError(f"Missing reference video: {video_path}")

        cap = cv2.VideoCapture(str(video_path))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        src_fps = float(cap.get(cv2.CAP_PROP_FPS) or 24.0)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        n_samples = max(8, min(args.samples, total_frames))
        sample_indices = np.linspace(0, max(0, total_frames - 1), n_samples, dtype=int)
        rep_slot = n_samples // 2

        frames_out: list[dict[str, Any]] = []
        rep_rgb: np.ndarray | None = None
        rep_kps: list[list[float]] | None = None
        valid_counts: list[int] = []
        t0 = time.time()

        for slot_idx, fi in enumerate(sample_indices):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(fi))
            ok, bgr = cap.read()
            if not ok:
                continue
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            kps = tracker.infer_pose_308(rgb)
            angles, mouth_ratio = _compute_anny_angles(kps)
            valid_kp = sum(1 for p in kps if p[2] >= 0.2)
            valid_counts.append(valid_kp)

            if slot_idx == rep_slot or rep_rgb is None:
                rep_rgb = rgb
                rep_kps = kps

            frames_out.append({
                "frame": int(fi),
                "time": round(float(fi) / src_fps, 3),
                "validKeypoints": valid_kp,
                "mouthOpenRatio": mouth_ratio,
                "core17": kps[0:17],
                "rightHand21": kps[RIGHT_HAND_SLICE[0]:RIGHT_HAND_SLICE[1]],
                "leftHand21": kps[LEFT_HAND_SLICE[0]:LEFT_HAND_SLICE[1]],
                "angles": angles,
                "keypoints308": kps,
            })
        cap.release()

        _smooth_angle_sequence(frames_out)

        # Representative normal-map + overlay JPEG (384px, quality 75)
        assert rep_rgb is not None and rep_kps is not None
        normal_rgb = tracker.infer_normal(rep_rgb)
        normal_web = _resize_max(normal_rgb, args.preview_dim)
        overlay_web = _resize_max(_draw_overlay(rep_rgb, rep_kps), args.preview_dim)

        normal_fn = f"{scene['id']}_normal.jpg"
        overlay_fn = f"{scene['id']}_overlay.jpg"
        json_fn = f"{scene['id']}.json"

        Image.fromarray(normal_web).save(
            out_dir / normal_fn, format="JPEG", quality=args.preview_quality, optimize=True
        )
        Image.fromarray(overlay_web).save(
            out_dir / overlay_fn, format="JPEG", quality=args.preview_quality, optimize=True
        )

        # Compute summary stats for UI scrubbers / badges
        mean_valid = round(float(np.mean(valid_counts)), 1) if valid_counts else 0.0
        peak_jaw = round(max((f["angles"]["jawOpen"] for f in frames_out), default=0.0), 4)
        peak_l_curl = round(max((f["angles"]["leftFingerCurl"] for f in frames_out), default=0.0), 4)
        peak_r_curl = round(max((f["angles"]["rightFingerCurl"] for f in frames_out), default=0.0), 4)
        peak_head_yaw = round(max((abs(f["angles"]["headYaw"]) for f in frames_out), default=0.0), 4)

        payload = {
            "id": scene["id"],
            "slug": scene["slug"],
            "title": scene["title"],
            "category": scene["category"],
            "focus": scene["focus"],
            "video": f"../study/v2g_emotions/{scene['file']}",
            "normalPreview": f"sapiens2/extracted/scenes/{normal_fn}",
            "overlayPreview": f"sapiens2/extracted/scenes/{overlay_fn}",
            "backend": "sapiens1-torchscript-0.3b",
            "device": f"normal:{tracker.normal_device}, pose:{tracker.pose_device}",
            "width": width,
            "height": height,
            "fps": round(src_fps, 2),
            "totalFrames": total_frames,
            "durationSec": round(total_frames / src_fps, 3),
            "sampleCount": len(frames_out),
            "repFrame": int(sample_indices[rep_slot]),
            "coco17Names": COCO17_NAMES,
            "handLayout": "goliath_21 (0..3 thumb tip->mcp, 4..7 index, 8..11 middle, 12..15 ring, 16..19 pinky, 20 wrist)",
            "stats": {
                "meanValidKeypoints": mean_valid,
                "peakJawOpen": peak_jaw,
                "peakLeftFingerCurl": peak_l_curl,
                "peakRightFingerCurl": peak_r_curl,
                "peakAbsHeadYaw": peak_head_yaw,
            },
            "frames": frames_out,
        }

        nan_count = _check_no_nans(payload)
        if nan_count > 0:
            raise ValueError(f"Scene {scene['id']} contains {nan_count} non-finite values")

        json_text = json.dumps(payload, separators=(",", ":"), allow_nan=False)
        (out_dir / json_fn).write_text(json_text, encoding="utf-8")
        json_bytes = len(json_text.encode("utf-8"))
        total_json_bytes += json_bytes
        dt = time.time() - t0

        manifest_scenes.append({
            "id": scene["id"],
            "slug": scene["slug"],
            "title": scene["title"],
            "category": scene["category"],
            "focus": scene["focus"],
            "video": f"../study/v2g_emotions/{scene['file']}",
            "videoFromStudy": f"v2g_emotions/{scene['file']}",
            "track": f"sapiens2/extracted/scenes/{json_fn}",
            "trackFromStudy": f"../motion-pipeline/sapiens2/extracted/scenes/{json_fn}",
            "normalPreview": f"sapiens2/extracted/scenes/{normal_fn}",
            "normalPreviewFromStudy": f"../motion-pipeline/sapiens2/extracted/scenes/{normal_fn}",
            "overlayPreview": f"sapiens2/extracted/scenes/{overlay_fn}",
            "overlayPreviewFromStudy": f"../motion-pipeline/sapiens2/extracted/scenes/{overlay_fn}",
            "durationSec": payload["durationSec"],
            "fps": payload["fps"],
            "sampleCount": len(frames_out),
            "repFrame": payload["repFrame"],
            "jsonBytes": json_bytes,
            "stats": payload["stats"],
            "inferSec": round(dt, 2),
        })
        print(
            f"[scene {scene['id']}] {len(frames_out)} frames | mean_kp={mean_valid}/308 | "
            f"json={json_bytes/1024:.1f}KB | {dt:.2f}s",
            flush=True,
        )

    manifest = {
        "version": "1.0",
        "backend": "sapiens1-torchscript-0.3b",
        "modelIds": [SAPIENS1_POSE_REPO, SAPIENS1_NORMAL_REPO],
        "license": "CC-BY-NC-4.0 (Meta Sapiens 1 TorchScript 0.3B)",
        "device": f"normal:{tracker.normal_device}, pose:{tracker.pose_device}",
        "angleKeys": [
            "headYaw", "headPitch", "headRoll",
            "spineYaw", "spinePitch", "spineRoll",
            "leftShoulderX", "leftArmZ", "rightShoulderX", "rightArmZ",
            "leftElbowFlex", "rightElbowFlex",
            "leftWristFlex", "leftWristRoll", "rightWristFlex", "rightWristRoll",
            "leftFingerCurl", "rightFingerCurl", "leftFingers", "rightFingers",
            "jawOpen",
        ],
        "totalJsonBytes": total_json_bytes,
        "totalInferSec": round(time.time() - t_all, 2),
        "scenes": manifest_scenes,
    }
    manifest_text = json.dumps(manifest, indent=2, allow_nan=False)
    (out_dir / "manifest.json").write_text(manifest_text, encoding="utf-8")
    print(
        f"[done] 4 scenes tracked | total_json={total_json_bytes/1024:.1f}KB | "
        f"elapsed={time.time() - t_all:.2f}s -> {out_dir / 'manifest.json'}",
        flush=True,
    )


if __name__ == "__main__":
    main()
