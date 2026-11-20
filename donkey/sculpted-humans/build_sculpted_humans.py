#!/usr/bin/env python3
"""
Blender 3.4 + NumPy Anatomical Human Head, Watertight Multi-Fold 3D Ear,
Cervical-Clavicular Bust & Hand Sculptor + 1024x1024 Tangent-Space Normal /
Cavity AO / Specular-Roughness Pore Map Baker (v6.1 — 0b07591c Calibrated).

Run with headless Blender + Anaconda post-bake:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python build_sculpted_humans.py
"""

import os
import json
import math
import struct
import numpy as np

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
TAU = math.pi * 2.0


def clamp(v, a, b):
    return np.clip(v, a, b)


def lerp_s(a, b, t):
    return a + (b - a) * t


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def g1(x, c, w):
    d = (x - c) / w
    return np.exp(-d * d)


def g2(x, y, cx, cy, wx, wy):
    dx = (x - cx) / wx
    dy = (y - cy) / wy
    return np.exp(-(dx * dx + dy * dy))


def smooth_max(a, b, k=0.0055):
    d = a - b
    return 0.5 * (a + b + np.sqrt(d * d + k * k))


# ==============================================================================
# 5 CAST PHENOTYPE ANATOMICAL PARAMETER SETS
# ==============================================================================
PHENOTYPES = {
    "imani": {
        "label": "Imani (Slender Warm Lead — 0b07591c North Star)",
        "craniumW": 1.004,
        "craniumTop": 0.0005,
        "foreheadBoss": 0.0036,
        "browArch": 0.96,
        "malarHigh": 1.08,
        "malarWidth": 1.006,
        "buccalFull": 0.0004,
        "jawWidth": 0.962,
        "gonionCrisp": 0.92,
        "chinProj": 0.0866,
        "chinWidth": 0.0296,
        "chinLiftY": 0.0020,
        "noseBridge": 0.98,
        "noseTipProj": 0.0985,
        "noseTipLiftY": 0.0026,
        "alarWidth": 0.0166,
        "lipFullU": 1.06,
        "lipFullL": 1.08,
        "mouthWidth": 0.0256,
        "neckHalfW": 0.0456,
        "scmStrength": 1.08,
        "larynxProm": 0.0007,
        "earScale": 1.02,
        "ageLines": 0.04,
    },
    "makeda": {
        "label": "Makeda (Regal High Cheekbones — 0bc287c6 Left)",
        "craniumW": 1.000,
        "craniumTop": 0.0020,
        "foreheadBoss": 0.0034,
        "browArch": 0.96,
        "malarHigh": 1.28,
        "malarWidth": 1.028,
        "buccalFull": -0.0002,
        "jawWidth": 0.960,
        "gonionCrisp": 1.05,
        "chinProj": 0.0864,
        "chinWidth": 0.0292,
        "chinLiftY": 0.0022,
        "noseBridge": 0.98,
        "noseTipProj": 0.0988,
        "noseTipLiftY": 0.0028,
        "alarWidth": 0.0170,
        "lipFullU": 1.10,
        "lipFullL": 1.12,
        "mouthWidth": 0.0260,
        "neckHalfW": 0.0458,
        "scmStrength": 1.12,
        "larynxProm": 0.0006,
        "earScale": 1.00,
        "ageLines": 0.08,
    },
    "june": {
        "label": "June (~10-11 yr Child Craniofacial Proportions — 0bc287c6 Right)",
        "craniumW": 1.048,
        "craniumTop": 0.0085,
        "foreheadBoss": 0.0052,
        "browArch": 0.56,
        "malarHigh": 0.84,
        "malarWidth": 0.988,
        "buccalFull": 0.0046,
        "jawWidth": 0.915,
        "gonionCrisp": 0.35,
        "chinProj": 0.0834,
        "chinWidth": 0.0284,
        "chinLiftY": 0.0052,
        "noseBridge": 0.76,
        "noseTipProj": 0.0955,
        "noseTipLiftY": 0.0042,
        "alarWidth": 0.0168,
        "lipFullU": 0.96,
        "lipFullL": 1.00,
        "mouthWidth": 0.0228,
        "neckHalfW": 0.0434,
        "scmStrength": 0.48,
        "larynxProm": 0.0002,
        "earScale": 1.03,
        "ageLines": 0.00,
    },
    "elder": {
        "label": "Elder (Mature Highland Osteology — 32b99d8c Turban & Beard)",
        "craniumW": 1.022,
        "craniumTop": 0.0040,
        "foreheadBoss": 0.0022,
        "browArch": 1.28,
        "malarHigh": 1.16,
        "malarWidth": 1.032,
        "buccalFull": -0.0008,
        "jawWidth": 1.042,
        "gonionCrisp": 1.18,
        "chinProj": 0.0880,
        "chinWidth": 0.0344,
        "chinLiftY": -0.0004,
        "noseBridge": 1.12,
        "noseTipProj": 0.1015,
        "noseTipLiftY": 0.0012,
        "alarWidth": 0.0198,
        "lipFullU": 0.92,
        "lipFullL": 0.96,
        "mouthWidth": 0.0266,
        "neckHalfW": 0.0524,
        "scmStrength": 1.25,
        "larynxProm": 0.0026,
        "earScale": 1.06,
        "ageLines": 0.85,
    },
    "hanna": {
        "label": "Hanna (Focused Athletic Specialist — 32b99d8c Far Right)",
        "craniumW": 0.996,
        "craniumTop": 0.0015,
        "foreheadBoss": 0.0032,
        "browArch": 0.88,
        "malarHigh": 1.08,
        "malarWidth": 0.994,
        "buccalFull": 0.0008,
        "jawWidth": 0.950,
        "gonionCrisp": 0.84,
        "chinProj": 0.0858,
        "chinWidth": 0.0290,
        "chinLiftY": 0.0022,
        "noseBridge": 1.00,
        "noseTipProj": 0.0990,
        "noseTipLiftY": 0.0026,
        "alarWidth": 0.0176,
        "lipFullU": 0.92,
        "lipFullL": 0.96,
        "mouthWidth": 0.0246,
        "neckHalfW": 0.0454,
        "scmStrength": 0.92,
        "larynxProm": 0.0005,
        "earScale": 0.99,
        "ageLines": 0.04,
    },
}


def catmull_scalar(a, b, c, d, t):
    t2 = t * t
    t3 = t2 * t
    return 0.5 * ((2.0 * b) + (-a + c) * t + (2.0 * a - 5.0 * b + 4.0 * c - d) * t2 + (-a + 3.0 * b - 3.0 * c + d) * t3)


def build_refined_bust_rings(p, target_y_stations):
    hw_neck = p["neckHalfW"]
    jw = p["jawWidth"]
    cw = p["craniumW"]
    mw = p["malarWidth"]
    top_lift = p["craniumTop"]

    ctrl = [
        # (y, z0, halfW, f, b)
        (1.258, -0.013, 0.136,          0.078, 0.088),
        (1.285, -0.013, 0.146,          0.088, 0.096),
        (1.332, -0.013, 0.149,          0.091, 0.099),
        (1.378, -0.013, 0.139,          0.076, 0.090),
        (1.408, -0.014, 0.112,          0.062, 0.079),
        (1.432, -0.015, hw_neck * 1.36, 0.053, 0.067),
        (1.456, -0.015, hw_neck * 1.04, 0.049, 0.058),
        (1.482, -0.015, hw_neck * 1.00, 0.048, 0.056),
        (1.504, -0.014, hw_neck * 1.00, 0.049, 0.058),
        (1.524, -0.011, lerp_s(hw_neck * 1.02, 0.0540 * jw, 0.45), 0.058, 0.066),
        (1.544, -0.007, 0.0570 * jw,    0.0680, 0.077),
        (1.564, -0.003, 0.0625 * lerp_s(jw, mw, 0.52), 0.0748, 0.089),
        (1.584, -0.002, 0.0668 * mw,    0.0795, 0.099),
        (1.600, -0.002, 0.0686 * mw,    0.0808, 0.105),
        (1.6158,-0.003, 0.0692 * cw,    0.0802, 0.110),
        (1.636, -0.004, 0.0695 * cw,    0.0825, 0.112),
        (1.666,                   -0.006, 0.0686 * cw, 0.0830, 0.1095),
        (1.696 + top_lift * 0.50, -0.010, 0.0608 * cw, 0.0730, 0.0950),
        (1.719 + top_lift * 0.80, -0.013, 0.0430 * cw, 0.0515, 0.0665),
        (1.730 + top_lift * 0.95, -0.015, 0.0200 * cw, 0.0235, 0.0295),
        (1.7345 + top_lift,       -0.016, 0.0018,      0.0020, 0.0020),
    ]
    ys_ctrl = np.array([c[0] for c in ctrl])
    vals = np.array([[c[1], c[2], c[3], c[4]] for c in ctrl])

    out = []
    n_c = len(ctrl)
    for yq in target_y_stations:
        if yq <= ys_ctrl[0]:
            out.append((yq, *vals[0]))
            continue
        if yq >= ys_ctrl[-1]:
            out.append((yq, *vals[-1]))
            continue
        i = int(np.searchsorted(ys_ctrl, yq) - 1)
        i = max(0, min(n_c - 2, i))
        u = (yq - ys_ctrl[i]) / max(1e-6, ys_ctrl[i + 1] - ys_ctrl[i])
        A = vals[max(0, i - 1)]
        B = vals[i]
        C = vals[i + 1]
        D = vals[min(n_c - 1, i + 2)]
        row = [catmull_scalar(A[k], B[k], C[k], D[k], u) for k in range(4)]
        row[1] = max(0.0012, row[1])
        row[2] = max(0.0012, row[2])
        row[3] = max(0.0012, row[3])
        out.append((yq, row[0], row[1], row[2], row[3]))
    return out


def eval_sculpted_head_point(sa, ca, y_base, z0, rw, rf, rb, p, include_lips=True):
    """
    Evaluates full 3D sculpted anatomical coordinates (px, py, pz) calibrated 1:1
    to 0b07591c.jpg (Front, 3/4, 90° Profile).
    """
    rz = rf if ca >= 0.0 else rb
    lx = sa * rw
    lz = ca * rz
    ly = 0.0

    ax = abs(lx)
    s_lat = float(clamp(lx / 0.008, -1.0, 1.0))
    jw = p["jawWidth"]
    hw_neck = p["neckHalfW"]
    chin_lift = p["chinLiftY"]

    # 1. CONTINUOUS OVAL-TAPERED ANTERIOR MANDIBLE & ROUNDED POGONION CHIN
    #    Wide 50mm vertical feather (1.535..1.586) -> ZERO horizontal shelf across 3/4 cheek!
    y_menton = 1.5095 + chin_lift
    y_pogo = 1.5205 + chin_lift
    if (y_menton - 0.016) < y_base < 1.588 and ca > -0.15:
        if ca > 0.0:
            t_y = float(smooth(y_menton - 0.003, 1.576, y_base))
            x_jaw_half = lerp_s(p["chinWidth"], 0.0620 * jw, math.pow(t_y, 0.66))
            u_jaw = ax / max(0.014, x_jaw_half)
            if u_jaw < 1.15:
                z_pogo = p["chinProj"]
                labio_dip = -0.0034 * float(g1(y_base, 1.5365 + chin_lift * 0.4, 0.0056))
                pogo_ball = +0.0044 * float(g1(y_base, y_pogo, 0.0104))
                oral_barrel = -0.0024 * float(smooth(1.538, 1.568, y_base))
                z_apex = z_pogo + pogo_ball + labio_dip + oral_barrel

                sub_ramp = float(smooth(y_menton - 0.013, y_menton + 0.009, y_base))
                z_mid = lerp_s(0.0365, z_apex, math.pow(sub_ramp, 0.78))

                u_c = min(1.0, u_jaw)
                oval_z = math.pow(max(0.0, 0.5 + 0.5 * math.cos(u_c * math.pi)), 0.82)
                z_jaw_surf = -0.004 + (z_mid + 0.004) * oval_z

                top_fade = 1.0 - float(smooth(1.535, 1.586, y_base))
                bot_fade = float(smooth(y_menton - 0.014, y_menton - 0.002, y_base))
                ca_fade = float(smooth(0.0, 0.22, ca))
                z_cur = z0 + lz
                dz_add = float(smooth_max(z_jaw_surf, z_cur, 0.0065) - z_cur)
                lz += dz_add * top_fade * bot_fade * ca_fade

        gonion = float(g2(ax, y_base, 0.0555 * jw, 1.545, 0.012, 0.016)) * float(g1(ca, -0.04, 0.26)) * p["gonionCrisp"]
        lx += s_lat * 0.0018 * gonion
        lz -= 0.0014 * gonion
        ly -= 0.0010 * gonion

        sub_tuck = float(g2(ax, y_base, 0.015 * jw, y_menton - 0.003, 0.020, 0.0068)) * float(smooth(0.42, 0.90, ca))
        ly += 0.0018 * sub_tuck

    # 2. CERVICAL SCM V-PILLARS, SUPRASTERNAL JUGULAR NOTCH & S-CLAVICLES
    if 1.295 < y_base < 1.540 and ca > -0.28:
        larynx = float(g1(ax, 0.0, 0.0085)) * float(g1(y_base, 1.476, 0.0095)) * float(smooth(0.65, 1.0, ca)) * p["larynxProm"]
        lz += larynx

        t_scm = float(clamp((y_base - 1.409) / (1.534 - 1.409), 0.0, 1.0))
        x_scm = lerp_s(0.0120, hw_neck * 0.97, t_scm)
        ca_scm = lerp_s(0.92, -0.06, t_scm)
        scm_mask = float(g1(ax, x_scm, 0.0098)) * float(g1(ca, ca_scm, 0.42)) * float(smooth(1.404, 1.422, y_base)) * (1.0 - float(smooth(1.520, 1.538, y_base)))
        lz += 0.0040 * scm_mask * max(0.2, ca + 0.3) * p["scmStrength"]
        lx += s_lat * 0.0014 * scm_mask * p["scmStrength"]

        jug_hollow = float(g2(ax, y_base, 0.0, 1.408, 0.0135, 0.0145)) * float(smooth(0.52, 1.0, ca))
        lz -= 0.0064 * jug_hollow

        y_clav = 1.409 + 0.0065 * float(smooth(0.024, 0.116, ax))
        clav_env = float(smooth(0.009, 0.019, ax)) * (1.0 - float(smooth(0.108, 0.134, ax)))
        s_curve_ca = lerp_s(0.92, 0.28, float(smooth(0.020, 0.118, ax)))
        clav_ridge = float(g1(y_base, y_clav, 0.0086)) * clav_env * float(g1(ca, s_curve_ca, 0.42))
        supra_fossa = float(g2(ax, y_base, 0.056, 1.424, 0.024, 0.0090)) * float(g1(ca, 0.52, 0.35))
        infra_fossa = float(g2(ax, y_base, 0.074, 1.390, 0.024, 0.0115)) * float(smooth(0.25, 0.85, ca))
        lz += 0.0048 * clav_ridge - 0.0022 * supra_fossa - 0.0020 * infra_fossa
        ly += 0.0018 * clav_ridge

        sternal = float(g1(ax, 0.0, 0.011)) * float(smooth(1.295, 1.325, y_base)) * (1.0 - float(smooth(1.372, 1.395, y_base))) * float(smooth(0.65, 1.0, ca))
        lz -= 0.0016 * sternal

    if 1.418 < y_base < 1.538 and ca < -0.45:
        back_w = float(smooth(-0.45, -0.95, ca))
        c7_bump = float(g1(ax, 0.0, 0.014)) * float(g1(y_base, 1.440, 0.015)) * back_w
        nuchal = float(g1(ax, 0.0, 0.012)) * float(g1(y_base, 1.498, 0.022)) * back_w
        lz += -0.0025 * c7_bump + 0.0020 * nuchal

    # 3. CRANIOFACIAL PLANES (0b07591c.jpg 1:1)
    if ca > -0.35 and y_base > 1.520:
        # Smooth rounded frontal bone bossing (balanced 50% eye-to-crown proportion, nested cleanly inside hair cap!)
        frontal = float(g2(ax, y_base, 0.022, 1.652, 0.042, 0.020)) * (1.0 - float(smooth(1.652, 1.665, y_base))) * float(smooth(0.32, 0.95, ca))
        lz += p["foreheadBoss"] * frontal

        # Graceful Supraorbital Brow Arch + 3D Eyebrow Pad projecting cleanly over recessed orbital sockets (0b07591c.jpg!)
        brow_arch_y = 1.6345 + 0.0038 * float(smooth(0.011, 0.036, ax)) - 0.0034 * float(smooth(0.037, 0.055, ax))
        brow = float(g1(y_base, brow_arch_y, 0.0128)) * float(smooth(0.005, 0.015, ax)) * (1.0 - float(smooth(0.044, 0.059, ax))) * float(smooth(0.25, 0.92, ca))
        glabella = float(g1(ax, 0.0, 0.0125)) * float(g1(y_base, 1.6345, 0.0115)) * float(smooth(0.58, 1.0, ca))
        brow_hair_y = 1.6338 + 0.0046 * float(smooth(0.010, 0.035, ax)) - 0.0040 * float(smooth(0.035, 0.052, ax))
        brow_pad = float(g1(y_base, brow_hair_y, 0.0036)) * float(smooth(0.009, 0.015, ax)) * (1.0 - float(smooth(0.044, 0.053, ax))) * float(smooth(0.42, 0.95, ca))
        lz += (0.0040 * brow + 0.0026 * glabella) * p["browArch"] + 0.00085 * brow_pad * lerp_s(0.75, 1.15, float(clamp(p["browArch"], 0.4, 1.3)))

        # Clean lateral & inferior orbital rim framing recessed eye socket
        orb_recess = float(g2(ax, y_base, 0.0305, 1.6162, 0.0195, 0.0115)) * float(smooth(0.45, 0.96, ca))
        lat_orb = float(g2(ax, y_base, 0.0455, 1.616, 0.0075, 0.0125)) * float(smooth(0.20, 0.82, ca))
        infra_cushion = float(g2(ax, y_base, 0.031, 1.599, 0.017, 0.0075)) * float(smooth(0.35, 0.90, ca))
        lz += -0.0014 * orb_recess + 0.0032 * lat_orb + 0.0012 * infra_cushion

        temple = float(g2(ax, y_base, 0.064, 1.632, 0.015, 0.023)) * float(g1(ca, 0.26, 0.34))
        lx -= s_lat * 0.0028 * temple

        # Refined Sculpted Nasal Bridge, Rounded Tip, Compact Alar Lobules & ~102° Subnasale-to-Philtrum Flow (0b07591c.jpg 1:1!)
        tip_y = 1.5825 + p["noseTipLiftY"]
        alar_w = p["alarWidth"]
        nasion_dip = float(g1(ax, 0.0, 0.0140)) * float(g1(y_base, 1.622, 0.0090)) * float(smooth(0.58, 1.0, ca))
        z_cur_tip = z0 + rf
        tip_amp = max(0.011, p["noseTipProj"] - z_cur_tip)

        t_dorsum = float(clamp((1.625 - y_base) / max(0.015, 1.625 - tip_y), 0.0, 1.0))
        dorsum_env = t_dorsum * (1.0 - float(smooth(tip_y - 0.002, tip_y - 0.012, y_base))) * float(smooth(1.628, 1.616, y_base))
        bridge_w = lerp_s(0.0068, 0.0092, t_dorsum)
        bridge = float(g1(ax, 0.0, bridge_w)) * dorsum_env * float(smooth(0.50, 0.98, ca))
        sidewall = float(g1(ax, bridge_w * 1.30, 0.0062)) * dorsum_env * float(smooth(0.45, 0.95, ca))

        nose_tip = float(g1(ax, 0.0, 0.0102)) * float(g1(y_base, tip_y, 0.0108)) * float(smooth(0.58, 1.0, ca))
        columella = float(g1(ax, 0.0, 0.0050)) * float(g1(y_base, tip_y - 0.0072, 0.0068)) * float(smooth(0.65, 1.0, ca))
        subnasale_ramp = float(g1(ax, 0.0, 0.0150)) * float(g1(y_base, tip_y - 0.0130, 0.0085)) * float(smooth(0.62, 1.0, ca))

        alar = float(g2(ax, y_base, alar_w * 0.82, tip_y - 0.0046, alar_w * 0.32, 0.0052)) * float(smooth(0.42, 0.96, ca))
        alar_groove = float(g2(ax, y_base, alar_w * 1.06, tip_y - 0.0030, 0.0030, 0.0060)) * float(smooth(0.45, 0.94, ca))
        n_dx = (ax - alar_w * 0.48) / 0.0034
        n_dy = (y_base - (tip_y - 0.0072 - 0.0010 * (ax / max(0.01, alar_w)))) / 0.0021
        nostril_hole = math.exp(-(n_dx * n_dx + n_dy * n_dy)) * float(smooth(0.62, 1.0, ca))

        dorsum_ridge = (tip_amp * 0.84 * bridge + 0.0030 * sidewall) * p["noseBridge"]
        tip_ball = tip_amp * nose_tip
        nose_mid_z = max(dorsum_ridge, tip_ball) + 0.16 * min(dorsum_ridge, tip_ball)

        lz += (-0.0016 * nasion_dip + nose_mid_z + 0.0064 * columella + 0.0046 * subnasale_ramp + 0.0124 * alar - 0.0026 * alar_groove)
        lz -= 0.0034 * nostril_hole
        ly += 0.0012 * nostril_hole
        lx += s_lat * (0.0028 * alar - 0.0008 * alar_groove)

        # Zygomatic Arch & Smooth 2.5x Wider-Falloff Malar-to-Buccal Flow (ZERO 3/4 cheek horizontal shelf!)
        malar_sweep_y = 1.596 + 0.005 * float(smooth(0.036, 0.066, ax))
        malar = float(g2(ax, y_base, 0.049, malar_sweep_y, 0.023, 0.035)) * float(smooth(-0.08, 0.76, ca)) * p["malarHigh"]
        zygo_arch = float(g2(ax, y_base, 0.064, 1.599, 0.012, 0.025)) * float(g1(ca, 0.16, 0.36)) * p["malarHigh"]
        sub_malar = float(g2(ax, y_base, 0.049, 1.558, 0.023, 0.030)) * float(smooth(0.05, 0.65, ca))
        lx += s_lat * (0.0032 * malar + 0.0016 * zygo_arch + p["buccalFull"] * 0.75 * sub_malar - 0.0009 * sub_malar * (1.0 - max(0.0, p["buccalFull"] * 120.0)))
        lz += 0.0046 * malar + 0.0014 * zygo_arch + p["buccalFull"] * sub_malar - 0.0006 * sub_malar

        # Ultra-gentle nasolabial fold on youthful faces (eliminates weird horizontal pinch above mouth corners!)
        nl_x = alar_w * 1.06 + max(0.0, (tip_y - 0.004) - y_base) * 0.42
        nl_env = float(smooth(1.554, 1.576, y_base)) * (1.0 - float(smooth(1.577, 1.586, y_base))) * float(smooth(0.45, 0.92, ca))
        nl_crease = float(g1(ax, nl_x, 0.0055)) * nl_env * lerp_s(0.22, 1.40, p["ageLines"]) * (1.0 - float(clamp(p["buccalFull"] * 140.0, 0.0, 0.75)))
        lz -= 0.0010 * nl_crease

        # Smooth Ricketts' E-Line Maxillary Philtrum & Vermilion Lips (0b07591c.jpg 90° Profile 1:1 — ZERO duck-bill shelf!)
        if include_lips:
            mw_lip = p["mouthWidth"]
            u_m = ax / max(0.012, mw_lip)
            phil_support = float(g1(ax, 0.0, mw_lip * 0.90)) * float(g1(y_base, 1.5650, 0.0100)) * float(smooth(0.55, 1.0, ca))
            phil_env = float(g1(y_base, 1.5675, 0.0070)) * float(smooth(0.68, 1.0, ca))
            phil_dimple = float(g1(ax, 0.0, 0.0038)) * phil_env
            phil_ridge = float(g1(ax, 0.0054, 0.0023)) * phil_env

            taper_u = math.pow(max(0.0, 1.0 - min(1.0, u_m / 1.02) ** 1.85), 0.82) * float(smooth(0.56, 1.0, ca))
            taper_l = math.pow(max(0.0, 1.0 - min(1.0, u_m / 0.96) ** 1.80), 0.84) * float(smooth(0.56, 1.0, ca))
            cupid_peak = 0.00155 * float(g1(ax, 0.0054, 0.0029)) - 0.00070 * float(g1(ax, 0.0, 0.0021))
            u_lip = float(g1(y_base, 1.5570 + cupid_peak - 0.0018 * min(1.05, u_m * u_m), 0.0070)) * taper_u
            l_lip = float(g1(y_base, 1.5472 + 0.0014 * min(1.05, u_m * u_m), 0.0076)) * taper_l
            modiolus_fill = float(g2(ax, y_base, mw_lip * 0.78, 1.5525, 0.0075, 0.0068)) * float(smooth(0.58, 0.96, ca))

            rima_y = 1.5525 - 0.00035 * float(g1(ax, 0.0, 0.0040)) + 0.00032 * float(g1(ax, 0.0080, 0.0040)) + 0.00024 * float(smooth(0.58, 0.92, u_m))
            rima_gate = (1.0 - float(smooth(0.46, 0.78, u_m))) * float(smooth(0.070, 0.078, z0 + rf)) * float(smooth(0.68, 1.0, ca))
            rima = float(g1(y_base, rima_y, 0.0013)) * rima_gate

            lz += (0.0056 * phil_support - 0.0010 * phil_dimple + 0.0012 * phil_ridge
                   + 0.0128 * u_lip * p["lipFullU"]
                   + 0.0132 * l_lip * p["lipFullL"]
                   + 0.0012 * modiolus_fill
                   - 0.0016 * rima)

    return lx, y_base + ly, z0 + lz


def head_pos_to_uv(px, py, pz, seam_sign=0.0):
    z_ref = -0.008
    ang = math.atan2(px, pz - z_ref)
    if abs(abs(ang) - math.pi) < 1e-4 and seam_sign != 0.0:
        ang = math.copysign(math.pi, seam_sign)
    t_raw = ang / math.pi
    t_mag = math.copysign(math.pow(abs(t_raw), 0.82), t_raw)
    u = 0.5 + 0.5 * t_mag

    if py <= 1.495:
        t_low = float(clamp((py - 1.258) / (1.495 - 1.258), 0.0, 1.0))
        v = lerp_s(0.02, 0.28, t_low)
    elif py <= 1.690:
        t_face = float(clamp((py - 1.495) / (1.690 - 1.495), 0.0, 1.0))
        v = lerp_s(0.28, 0.74, t_face)
    else:
        t_top = float(clamp((py - 1.690) / (1.742 - 1.690), 0.0, 1.0))
        v = lerp_s(0.74, 0.82, t_top)
    return float(clamp(u, 0.002, 0.998)), float(clamp(v, 0.02, 0.82))


EAR_SOCKET = {
    "cy": 1.5955,
    "cz": -0.0135,
    "ry": 0.0315,
    "rz": 0.0185,
}


def eval_skull_at_yz(side, py, pz, y_table, rings_data, p):
    ys = y_table
    idx = int(np.searchsorted(ys, py) - 1)
    idx = max(0, min(len(rings_data) - 2, idx))
    r0 = rings_data[idx]
    r1 = rings_data[idx + 1]
    t = float(clamp((py - r0[0]) / max(1e-6, r1[0] - r0[0]), 0.0, 1.0))
    z0 = lerp_s(r0[1], r1[1], t)
    rw = lerp_s(r0[2], r1[2], t)
    rf = lerp_s(r0[3], r1[3], t)
    rb = lerp_s(r0[4], r1[4], t)
    dz = pz - z0
    rz = rf if dz >= 0.0 else rb
    ca = float(clamp(dz / max(0.008, rz), -0.985, 0.985))
    sa = side * math.sqrt(max(0.02, 1.0 - ca * ca))
    px, _, _ = eval_sculpted_head_point(sa, ca, py, z0, rw, rf, rb, p, include_lips=False)
    return px


def eval_sculpted_ear_point(side, th, t_rad, y_table, rings_data, p):
    """
    Smooth, natural C-oval 3D human auricle matching 0b07591c.jpg Front, 3/4 & 90° Profile!
    Superior pole curves cleanly INWARD into temporal scalp (ZERO upward Spock corner!).
    """
    esc = p["earScale"]
    cy = EAR_SOCKET["cy"]
    cz = EAR_SOCKET["cz"]
    cth = math.cos(th)
    sth = math.sin(th)

    y_weld = cy + EAR_SOCKET["ry"] * sth
    z_weld = cz + EAR_SOCKET["rz"] * cth
    x_weld = eval_skull_at_yz(side, y_weld, z_weld, y_table, rings_data, p)

    tilt = -0.15
    ct_t = cth * math.cos(tilt) - sth * math.sin(tilt)
    st_t = cth * math.sin(tilt) + sth * math.cos(tilt)

    z_ant_span = (0.0132 + 0.0028 * float(smooth(-0.4, 0.65, st_t))) * esc
    z_post_span = (0.0208 + 0.0035 * float(smooth(-0.3, 0.55, st_t)) - 0.0038 * float(smooth(-0.55, -1.0, st_t))) * esc
    y_up_span = 0.0282 * esc  # Matches y_weld top gently -> arches inward instead of spiking up!
    y_lo_span = 0.0286 * esc

    dy_rim = (y_up_span if st_t >= 0.0 else y_lo_span) * st_t
    dz_rim = (z_ant_span if ct_t >= 0.0 else z_post_span) * ct_t
    y_rim = cy + dy_rim * math.cos(-tilt) - dz_rim * math.sin(-tilt)
    z_rim = (cz - 0.0036 * esc) + dy_rim * math.sin(-tilt) + dz_rim * math.cos(-tilt)

    post_w = float(smooth(0.42, -0.52, cth))
    # Crucial: taper lateral splay down at very top (sth -> +1) and very bottom (sth -> -1)
    # so in Front view the superior helix curves smoothly into the temple with ZERO pointy corner!
    pole_round = math.pow(max(0.08, 1.0 - 0.68 * sth * sth), 0.75)
    lobe_w = float(smooth(-0.35, -0.95, sth))

    x_base_skull = abs(x_weld)
    splay_lat = (0.0018 + 0.0086 * post_w * pole_round + 0.0034 * lobe_w) * esc

    y_canal = cy - 0.0036 * esc
    z_canal = cz - 0.0034 * esc

    helix_ang = float(smooth(0.18, 0.55, th)) * (1.0 - float(smooth(4.15, 4.65, th))) if th < 5.2 else 0.0
    tragus_ang = float(g1(cth, 0.94, 0.24)) * float(g1(sth, -0.14, 0.26))
    antitragus_ang = float(g1(cth, 0.10, 0.34)) * float(g1(sth, -0.82, 0.22))
    intertragic_ang = float(g1(cth, 0.62, 0.22)) * float(g1(sth, -0.62, 0.20))

    antihelix_stem = float(smooth(0.35, -0.45, cth)) * float(smooth(-0.68, -0.15, sth)) * (1.0 - float(smooth(0.35, 0.78, sth)))
    inf_crus = float(g1(sth, 0.34, 0.18)) * float(smooth(-0.35, 0.65, cth))
    sup_crus = float(g1(sth, 0.68, 0.22)) * float(smooth(-0.55, 0.35, cth))
    tri_fossa = float(g1(sth, 0.52, 0.16)) * float(smooth(-0.25, 0.45, cth))

    y_base_inner = cy + 0.0258 * esc * sth
    z_base_inner = cz + 0.0132 * esc * cth
    x_base_inner = eval_skull_at_yz(side, y_base_inner, z_base_inner, y_table, rings_data, p)
    x_base_skull = abs(x_base_inner)

    if t_rad <= 0.14:
        # Smooth inward-stepping sub-dermal -> flush temple/mastoid collar (100% outward normal around 360°!)
        u_col = t_rad / 0.14
        py_final = lerp_s(y_weld, y_base_inner, u_col)
        pz_final = lerp_s(z_weld, z_base_inner, u_col)
        x_sk_here = eval_skull_at_yz(side, py_final, pz_final, y_table, rings_data, p)
        collar_off = lerp_s(-0.00045, 0.00012, float(smooth(0.0, 0.85, u_col)))
        px_final = x_sk_here + side * collar_off
    elif t_rad <= 0.44:
        u = (t_rad - 0.14) / 0.30
        retro_dip = -0.0014 * math.sin(min(1.0, u / 0.36) * math.pi) * post_w if u < 0.36 else 0.0
        ease_yz = math.pow(u, 0.80)
        py_final = lerp_s(y_base_inner, y_rim, ease_yz)
        pz_final = lerp_s(z_base_inner, z_rim, ease_yz)
        tube_swell = math.sin(u * math.pi * 0.5)
        helix_crest = 0.0024 * float(g1(u, 0.92, 0.24)) * (0.65 * helix_ang * pole_round + 0.55 * lobe_w) * esc
        ax_out = x_base_skull + 0.00012 + retro_dip + splay_lat * tube_swell + helix_crest
        px_final = side * ax_out
    else:
        u = (t_rad - 0.44) / 0.56
        rad_in = math.pow(u, 0.88)
        py_final = lerp_s(y_rim, y_canal, rad_in)
        pz_final = lerp_s(z_rim, z_canal, rad_in) - 0.0024 * float(g1(u, 0.38, 0.14)) * tragus_ang * esc

        base_lat = lerp_s(splay_lat, -0.0038 * esc, float(smooth(0.18, 0.96, u)))
        helix_roll = 0.0032 * float(g1(u, 0.08, 0.12)) * helix_ang * pole_round * esc
        lobule_pillow = 0.0034 * math.sin(clamp(u / 0.58, 0.0, 1.0) * math.pi) * lobe_w * esc
        scapha_groove = -0.0022 * float(g1(u, 0.26, 0.09)) * helix_ang * esc
        fossa_hollow = -0.0018 * float(g1(u, 0.36, 0.11)) * tri_fossa * esc
        antihelix_ridge = 0.0034 * float(g1(u, 0.44, 0.12)) * (antihelix_stem + 0.85 * inf_crus + 0.75 * sup_crus) * esc
        antitragus_bump = 0.0030 * float(g1(u, 0.42, 0.12)) * antitragus_ang * esc
        notch_dip = -0.0020 * float(g1(u, 0.40, 0.14)) * intertragic_ang * esc
        tragus_flap = 0.0034 * float(g1(u, 0.34, 0.14)) * tragus_ang * esc
        crus_bar = 0.0020 * float(g1(sth, 0.10, 0.13)) * float(smooth(0.15, 0.85, cth)) * float(g1(u, 0.56, 0.16)) * esc
        concha_bowl = -0.0030 * float(g1(u, 0.74, 0.16)) * (1.0 - 0.55 * tragus_ang) * esc

        ax_out = (x_base_skull + base_lat + helix_roll + lobule_pillow + scapha_groove
                  + fossa_hollow + antihelix_ridge + antitragus_bump + notch_dip + tragus_flap + crus_bar + concha_bowl)
        px_final = side * ax_out

    r_uv = 0.46 * (1.0 - 0.88 * t_rad)
    u_ctr = 0.25 if side > 0 else 0.75
    v_ctr = 0.91
    u_ear = u_ctr + r_uv * 0.44 * (cth * side)
    v_ear = v_ctr + r_uv * 0.14 * sth
    return px_final, py_final, pz_final, u_ear, v_ear


def build_phenotype_mesh(pheno_key="imani", canonical_topology=None):
    p = PHENOTYPES[pheno_key]

    # Use canonical normalized s-stations mapped to phenotype height so all 5 phenotypes share 100.000% identical topology & triangle indices!
    base_y_stations = sorted(list(set(
        list(np.linspace(1.258, 1.395, 10)) +
        list(np.linspace(1.402, 1.505, 18)) +
        list(np.linspace(1.510, 1.648, 46)) +
        list(np.linspace(1.654, 1.734, 14))
    )))
    y_stations = [
        yb + p["craniumTop"] * float(smooth(1.650, 1.734, yb))
        for yb in base_y_stations
    ]
    rings_data = build_refined_bust_rings(p, y_stations)
    y_arr = np.array([r[0] for r in rings_data])

    SEG = 88
    N_RINGS = len(rings_data)
    COLS = SEG + 1

    pos = []
    uvs = []
    is_ear_vert = []

    for i, (yb, z0, rw, rf, rb) in enumerate(rings_data):
        for j in range(COLS):
            a = (j / SEG) * TAU + math.pi
            sa = math.sin(a)
            ca = math.cos(a)
            px, py, pz = eval_sculpted_head_point(sa, ca, yb, z0, rw, rf, rb, p, include_lips=True)
            # Gentle conchal hollow in skull behind tragus so deep auditory canal (-3.8mm) never pokes through!
            if abs(sa) > 0.72 and 1.572 < yb < 1.616:
                ny_c = (yb - (EAR_SOCKET["cy"] - 0.003)) / 0.0145
                nz_c = (pz - (EAR_SOCKET["cz"] - 0.003)) / 0.0095
                r2_c = ny_c * ny_c + nz_c * nz_c
                if r2_c < 2.2:
                    px -= math.copysign(0.0052 * math.exp(-r2_c * 1.35), px)
            pos.append([px, py, pz])
            seam_sgn = -1.0 if j == 0 else (1.0 if j == SEG else 0.0)
            u, v = head_pos_to_uv(px, py, pz, seam_sign=seam_sgn)
            uvs.append([u, v])
            is_ear_vert.append(0.0)

    pos_np = np.array(pos, dtype=np.float64)

    if canonical_topology is None:
        def inside_mouth_pocket(vid):
            vx, vy, vz = pos_np[vid]
            if vz <= 0.056:
                return False
            nx = vx / 0.0278
            ny = (vy - 1.5525) / (0.0112 if vy >= 1.5525 else 0.0145)
            return (nx * nx + ny * ny) < 1.0

        def inside_eye_pocket(vid, side_sgn):
            vx, vy, vz = pos_np[vid]
            if vz <= 0.035 or vx * side_sgn <= 0.0:
                return False
            nx = (abs(vx) - 0.0300) / 0.0226
            ny = (vy - 1.6158) / 0.0142
            return (nx * nx + ny * ny) < 0.94

        grid_idx = []
        for i in range(N_RINGS - 1):
            for j in range(SEG):
                A = i * COLS + j
                Bv = A + 1
                C = A + COLS
                D = C + 1
                if inside_mouth_pocket(A) and inside_mouth_pocket(Bv) and inside_mouth_pocket(C) and inside_mouth_pocket(D):
                    continue
                if ((inside_eye_pocket(A, 1) and inside_eye_pocket(Bv, 1) and inside_eye_pocket(C, 1) and inside_eye_pocket(D, 1)) or
                    (inside_eye_pocket(A, -1) and inside_eye_pocket(Bv, -1) and inside_eye_pocket(C, -1) and inside_eye_pocket(D, -1))):
                    continue
                grid_idx.extend([A, Bv, C, Bv, D, C])

        canonical_topology = {
            "grid_idx": grid_idx,
        }

    idx = list(canonical_topology["grid_idx"])
    ear_seam_pairs = []
    ear_flange_vids = []

    def build_polar_ear(side):
        # Uniform K=48 smooth polar ear manifold with tangent-matched feathered temple/mastoid collar
        # -> ZERO rectilinear grid staircase corners and ZERO stray triangles below earlobe in 90° profile!
        K = 48
        t_stations = [0.0, 0.06, 0.13, 0.24, 0.35, 0.42, 0.49, 0.57, 0.66, 0.76, 0.87, 0.96]
        prev_ring = None
        for r_idx, t_rad in enumerate(t_stations):
            cur_ring = []
            ear_w = float(smooth(0.06, 0.24, t_rad))
            flange_w = 1.0 - float(smooth(0.04, 0.18, t_rad))
            for k in range(K + 1):
                kw = 0 if k == K else k
                th = (kw / K) * TAU
                # Left ear (+1): th decreases (0 -> -PI/2 -> -PI) so (b0-a0) x (c0-a0) points +X outward!
                # Right ear (-1): th increases (0 -> +PI/2 -> +PI) so (b0-a0) x (c0-a0) points -X outward!
                th_oriented = (TAU - th) % TAU if side > 0 else th
                px_e, py_e, pz_e, ue, ve = eval_sculpted_ear_point(side, th_oriented, t_rad, y_arr, rings_data, p)
                ev = len(pos)
                pos.append([px_e, py_e, pz_e])
                uvs.append([ue, ve])
                is_ear_vert.append(ear_w)
                cur_ring.append(ev)
                if flange_w > 0.01:
                    ear_flange_vids.append((ev, side, flange_w))
            ear_seam_pairs.append((cur_ring[0], cur_ring[K]))

            if prev_ring is not None:
                for k in range(K):
                    a0, b0 = prev_ring[k], prev_ring[k + 1]
                    c0, d0 = cur_ring[k], cur_ring[k + 1]
                    idx.extend([a0, b0, c0, b0, d0, c0])
            prev_ring = cur_ring

        px_c, py_c, pz_c, _, _ = eval_sculpted_ear_point(side, 0.0, 1.0, y_arr, rings_data, p)
        cap_id = len(pos)
        pos.append([px_c, py_c, pz_c])
        uvs.append([0.25 if side > 0 else 0.75, 0.91])
        is_ear_vert.append(1.0)
        for k in range(K):
            idx.extend([prev_ring[k], prev_ring[k + 1], cap_id])

    build_polar_ear(1)
    build_polar_ear(-1)

    def eval_facial_z(px_q, py_q, include_lips=True):
        yq = float(clamp(py_q, y_arr[0], y_arr[-1]))
        ii = int(np.searchsorted(y_arr, yq) - 1)
        ii = max(0, min(len(rings_data) - 2, ii))
        r0 = rings_data[ii]
        r1 = rings_data[ii + 1]
        t = float(clamp((yq - r0[0]) / max(1e-6, r1[0] - r0[0]), 0.0, 1.0))
        z0 = lerp_s(r0[1], r1[1], t)
        rw = lerp_s(r0[2], r1[2], t)
        rf = lerp_s(r0[3], r1[3], t)
        rb = lerp_s(r0[4], r1[4], t)
        sa_est = float(clamp(px_q / max(0.018, rw), -0.992, 0.992))
        for _ in range(3):
            ca_est = math.sqrt(max(0.01, 1.0 - sa_est * sa_est))
            lx_cur, _, _ = eval_sculpted_head_point(sa_est, ca_est, yq, z0, rw, rf, rb, p, include_lips=include_lips)
            sa_est = float(clamp(sa_est + (px_q - lx_cur) / max(0.020, rw), -0.995, 0.995))
        ca_est = math.sqrt(max(0.01, 1.0 - sa_est * sa_est))
        _, _, pz_out = eval_sculpted_head_point(sa_est, ca_est, yq, z0, rw, rf, rb, p, include_lips=include_lips)
        return pz_out

    orb_nx, orb_ny = 28, 24
    orb_xs = np.linspace(0.002, 0.060, orb_nx)
    orb_ys = np.linspace(1.594, 1.638, orb_ny)
    orb_grid = np.zeros((orb_ny, orb_nx), dtype=np.float32)
    for iy, oy in enumerate(orb_ys):
        for ix, ox in enumerate(orb_xs):
            orb_grid[iy, ix] = eval_facial_z(ox, oy, include_lips=False)

    # 48x7 Split-Vermilion Openable Mouth + Recessed Wet Mucosal Oral Cavity Pouch (tightly bounded to front vermilion!)
    NMOUTH = 48
    VMOUTH = 7
    base_mouth = len(pos)
    mw_lip = p["mouthWidth"]
    x_mouth_outer = mw_lip + 0.0054
    mouth_seam_pairs = []
    for iv in range(VMOUTH + 1):
        row_start = base_mouth + iv * (NMOUTH + 1)
        mouth_seam_pairs.append((row_start, row_start + NMOUTH))
        for iu in range(NMOUTH + 1):
            iu_w = 0 if iu == NMOUTH else iu
            th = (iu_w / NMOUTH) * TAU
            cth = math.cos(th)
            sth = math.sin(th)
            abs_cth = abs(cth)
            center_f = max(0.0, 1.0 - cth * cth)
            comm_fade = 1.0 - float(smooth(0.46, 0.80, abs_cth))
            rima_y = (1.5525
                      - 0.00035 * float(g1(cth, 0.0, 0.18))
                      + 0.00032 * (float(g1(cth, 0.32, 0.18)) + float(g1(cth, -0.32, 0.18)))
                      + 0.00024 * float(smooth(0.58, 0.92, abs_cth)))
            z_rima = eval_facial_z(mw_lip * cth, rima_y, include_lips=True)

            if iv == 0:
                px, py, pz = 0.0, 1.5525, 0.0465
            elif iv == 1:
                px = (mw_lip + 0.0016) * cth
                py = 1.5525 + 0.0185 * sth
                pz = 0.0505 - 0.0035 * cth * cth
            elif iv == 2:
                px = (mw_lip - 0.0002) * cth
                inner_lift = 0.0022 if sth >= 0.0 else 0.0018
                py = rima_y + sth * inner_lift * (0.28 + 0.72 * math.pow(center_f, 0.50))
                pz = z_rima - 0.0038 * (0.20 + 0.80 * comm_fade)
            elif iv == 3:
                px = mw_lip * cth
                py = rima_y
                pz = z_rima - 0.00085 * comm_fade * (0.45 + 0.55 * center_f)
            else:
                t_out = (iv - 3) / 4.0
                x_span = lerp_s(mw_lip, x_mouth_outer, math.pow(t_out, 0.92))
                y_span = (0.0138 if sth >= 0.0 else 0.0178) * math.pow(t_out, 0.88)
                arch_sh = lerp_s(0.65 + 0.35 * center_f, 1.0, float(smooth(0.15, 0.75, t_out)))
                px = x_span * cth
                py = rima_y + sth * y_span * arch_sh
                z_surf = eval_facial_z(px, py, include_lips=True)
                rima_roll = (0.00022 * comm_fade * (0.35 + 0.65 * center_f)) if iv == 4 else 0.0
                pz = z_surf + rima_roll

            pos.append([px, py, pz])
            u_m, v_m = head_pos_to_uv(px, py, max(0.030, pz))
            uvs.append([u_m, v_m])
            is_ear_vert.append(0.0)

    m_cols = NMOUTH + 1
    for iv in range(VMOUTH):
        for iu in range(NMOUTH):
            A = base_mouth + iv * m_cols + iu
            Bv = A + 1
            C = A + m_cols
            D = C + 1
            idx.extend([A, C, Bv, Bv, C, D])

    return {
        "pos": np.array(pos, dtype=np.float32),
        "uv": np.array(uvs, dtype=np.float32),
        "idx": np.array(idx, dtype=np.uint32),
        "is_ear": np.array(is_ear_vert, dtype=np.float32),
        "grid_count": N_RINGS * COLS,
        "n_rings": N_RINGS,
        "cols": COLS,
        "seg": SEG,
        "base_mouth": base_mouth,
        "nmouth": NMOUTH,
        "vmouth": VMOUTH,
        "mouth_seam_pairs": mouth_seam_pairs,
        "ear_seam_pairs": ear_seam_pairs,
        "ear_flange_vids": ear_flange_vids,
        "weld_pairs": [],
        "orb_grid": orb_grid,
        "orb_bounds": [0.002, 0.060, 1.594, 1.638],
        "eval_facial_z": eval_facial_z,
        "eval_skull_x": lambda sd, yq, zq: eval_skull_at_yz(sd, yq, zq, y_arr, rings_data, p),
        "canonical_topology": canonical_topology,
    }


def apply_taubin_clay_polish(mesh_dict):
    """
    Applies 2 gentle volume-preserving Taubin smoothing passes across the skull grid
    with smooth C1 feathering around eye sockets & mouth aperture (ZERO binary boundary step!).
    """
    pos = mesh_dict["pos"].copy().astype(np.float64)
    idx = mesh_dict["idx"].reshape(-1, 3)
    gc = mesh_dict["grid_count"]

    neighbors = [set() for _ in range(gc)]
    for t0, t1, t2 in idx:
        if t0 < gc and t1 < gc and t2 < gc:
            neighbors[t0].update((t1, t2))
            neighbors[t1].update((t0, t2))
            neighbors[t2].update((t0, t1))

    w_smooth = np.zeros(gc, dtype=np.float64)
    for v in range(gc):
        if len(neighbors[v]) < 3:
            continue
        vx, vy, vz = pos[v]
        if vy < 1.275 or vy > 1.725:
            continue
        w_v = float(smooth(1.275, 1.300, vy)) * (1.0 - float(smooth(1.705, 1.725, vy)))
        if vz > 0.025:
            eo = ((abs(vx) - 0.0300) / 0.0255) ** 2 + ((vy - 1.6158) / 0.0165) ** 2
            em = (vx / 0.0325) ** 2 + ((vy - 1.5525) / (0.0148 if vy >= 1.5525 else 0.0190)) ** 2
            w_v *= float(smooth(1.12, 1.55, eo)) * float(smooth(1.15, 1.65, em))
        w_smooth[v] = w_v

    n_rings, cols, seg = mesh_dict["n_rings"], mesh_dict["cols"], mesh_dict["seg"]
    for _ in range(2):
        for step_k in (0.30, -0.312):
            new_pos = pos.copy()
            for v in range(gc):
                if w_smooth[v] <= 1e-4:
                    continue
                nbrs = list(neighbors[v])
                avg = pos[nbrs].mean(axis=0)
                new_pos[v] = pos[v] + step_k * w_smooth[v] * (avg - pos[v])
            for i in range(n_rings):
                a0, a1 = i * cols, i * cols + seg
                mid_p = 0.5 * (new_pos[a0] + new_pos[a1])
                mid_p[0] = 0.0
                new_pos[a0] = mid_p
                new_pos[a1] = mid_p
            pos = new_pos

    mesh_dict["pos"] = pos.astype(np.float32)


def compute_smooth_normals_and_tuck(mesh_dict):
    pos = mesh_dict["pos"].copy()
    bind_pos = pos.copy()
    idx = mesh_dict["idx"].reshape(-1, 3)

    v0 = pos[idx[:, 0]]
    v1 = pos[idx[:, 1]]
    v2 = pos[idx[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)

    nrm = np.zeros_like(pos, dtype=np.float64)
    np.add.at(nrm, idx[:, 0], fn)
    np.add.at(nrm, idx[:, 1], fn)
    np.add.at(nrm, idx[:, 2], fn)

    n_rings = mesh_dict["n_rings"]
    cols = mesh_dict["cols"]
    seg = mesh_dict["seg"]
    for i in range(n_rings):
        a0 = i * cols
        a1 = a0 + seg
        s = nrm[a0] + nrm[a1]
        nrm[a0] = s
        nrm[a1] = s

    for c0, c1 in mesh_dict["ear_seam_pairs"]:
        s = nrm[c0] + nrm[c1]
        nrm[c0] = s
        nrm[c1] = s

    for c0, c1 in mesh_dict["mouth_seam_pairs"]:
        s = nrm[c0] + nrm[c1]
        nrm[c0] = s
        nrm[c1] = s

    lengths = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = (nrm / np.maximum(1e-8, lengths)).astype(np.float32)

    # Transfer exact skull gradient normals onto the feathered 3D ear collar (0.000° seam in Clay & PBR!)
    eval_sk = mesh_dict["eval_skull_x"]
    eps_e = 0.0016
    for ev, side, fl_w in mesh_dict["ear_flange_vids"]:
        vy, vz = float(pos[ev, 1]), float(pos[ev, 2])
        dxdy = (eval_sk(side, vy + eps_e, vz) - eval_sk(side, vy - eps_e, vz)) / (2.0 * eps_e)
        dxdz = (eval_sk(side, vy, vz + eps_e) - eval_sk(side, vy, vz - eps_e)) / (2.0 * eps_e)
        # Surface x = f(y, z) with outward normal pointing toward `side`: side*(1, -side*dxdy? No: F(x,y,z) = side*(x - f(y,z)) = 0 -> grad F = (side, -side*dxdy, -side*dxdz)!)
        gn_e = np.array([side, -side * dxdy, -side * dxdz], dtype=np.float32)
        gn_e /= max(1e-8, np.linalg.norm(gn_e))
        mn_e = nrm[ev] * (1.0 - fl_w) + gn_e * fl_w
        mn_e /= max(1e-8, np.linalg.norm(mn_e))
        nrm[ev] = mn_e

    eval_fz = mesh_dict["eval_facial_z"]
    eps = 0.0014
    bm = mesh_dict["base_mouth"]
    nm = mesh_dict["nmouth"]
    m_cols = nm + 1
    rima_start = bm + 3 * m_cols
    for iu in range(nm + 1):
        th_r = (0 if iu == nm else iu) / nm * TAU
        cth_r, sth_r = math.cos(th_r), math.sin(th_r)
        comm_fade_n = (1.0 - float(smooth(0.46, 0.78, abs(cth_r)))) * abs(sth_r)
        vi_r = rima_start + iu
        vx_r, vy_r = float(pos[vi_r, 0]), float(pos[vi_r, 1])
        dzdx_r = (eval_fz(vx_r + eps, vy_r, True) - eval_fz(vx_r - eps, vy_r, True)) / (2.0 * eps)
        dzdy_r = (eval_fz(vx_r, vy_r + eps, True) - eval_fz(vx_r, vy_r - eps, True)) / (2.0 * eps)
        gn_r = np.array([-dzdx_r, -dzdy_r, 1.0], dtype=np.float32)
        gn_r /= np.linalg.norm(gn_r)
        ny_r = -0.52 if sth_r >= 0.0 else +0.44
        vn = np.array([0.14 * cth_r, ny_r, 0.85], dtype=np.float32)
        vn /= np.linalg.norm(vn)
        mn_r = gn_r * (1.0 - comm_fade_n) + vn * comm_fade_n
        mn_r /= max(1e-8, np.linalg.norm(mn_r))
        nrm[vi_r] = mn_r

    for iv_out, w_bl in ((4, 0.35), (5, 0.72), (6, 0.96), (7, 1.00)):
        out_row = bm + iv_out * m_cols
        for iu in range(m_cols):
            vi = out_row + iu
            vx, vy = float(pos[vi, 0]), float(pos[vi, 1])
            dzdx = (eval_fz(vx + eps, vy, True) - eval_fz(vx - eps, vy, True)) / (2.0 * eps)
            dzdy = (eval_fz(vx, vy + eps, True) - eval_fz(vx, vy - eps, True)) / (2.0 * eps)
            gn = np.array([-dzdx, -dzdy, 1.0], dtype=np.float32)
            gn /= np.linalg.norm(gn)
            mn = nrm[vi] * (1.0 - w_bl) + gn * w_bl
            mn /= max(1e-8, np.linalg.norm(mn))
            nrm[vi] = mn

    grid_count = mesh_dict["grid_count"]
    for vi in range(grid_count):
        vx, vy, vz = float(pos[vi, 0]), float(pos[vi, 1]), float(pos[vi, 2])
        if vz <= 0.035:
            continue
        if 1.530 < vy < 1.572 and abs(vx) < 0.038 and vz > 0.058:
            dy_m = (vy - 1.5525) / (0.0138 if vy >= 1.5525 else 0.0178)
            r_ap = math.hypot(vx / 0.0312, dy_m)
            if 0.82 < r_ap < 1.32:
                w_gn = 1.0 - float(smooth(0.98, 1.32, r_ap))
                dzdx = (eval_fz(vx + eps, vy, True) - eval_fz(vx - eps, vy, True)) / (2.0 * eps)
                dzdy = (eval_fz(vx, vy + eps, True) - eval_fz(vx, vy - eps, True)) / (2.0 * eps)
                gn = np.array([-dzdx, -dzdy, 1.0], dtype=np.float32)
                gn /= np.linalg.norm(gn)
                mn = nrm[vi] * (1.0 - w_gn) + gn * w_gn
                mn /= max(1e-8, np.linalg.norm(mn))
                nrm[vi] = mn

        dz_tuck = 0.0
        dx_o = (abs(vx) - 0.0300) / 0.0226
        dy_o = (vy - 1.6158) / 0.0142
        e_orb = dx_o * dx_o + dy_o * dy_o
        if e_orb < 1.06:
            r_orb = math.sqrt(e_orb)
            dz_tuck -= 0.0185 * (1.0 - float(smooth(0.45, 0.85, r_orb))) + 0.0072 * (1.0 - float(smooth(0.58, 1.002, r_orb)))
        if 1.533 < vy < 1.568 and abs(vx) < 0.0306 and vz > 0.062:
            dy_m = (vy - 1.5525) / (0.0132 if vy >= 1.5525 else 0.0170)
            r_ap = math.hypot(vx / 0.0302, dy_m)
            if r_ap < 0.98:
                dz_tuck -= 0.0022 * (1.0 - float(smooth(0.70, 0.98, r_ap)))
        if dz_tuck != 0.0:
            pos[vi, 2] = vz + dz_tuck

    return pos, bind_pos, nrm


def run_blender_sculpt_and_glb_export(pheno_meshes):
    import bpy

    bpy.ops.wm.read_factory_settings(use_empty=True)
    base = pheno_meshes["imani"]

    me = bpy.data.meshes.new("HumanBustV6_Mesh")
    verts_list = [tuple(map(float, v)) for v in base["pos"]]
    faces_list = [tuple(map(int, t)) for t in base["idx"].reshape(-1, 3)]
    me.from_pydata(verts_list, [], faces_list)

    uv_layer = me.uv_layers.new(name="UVMap")
    uv_src = base["uv"]
    for poly in me.polygons:
        for loop_idx in poly.loop_indices:
            v_idx = me.loops[loop_idx].vertex_index
            uv_layer.data[loop_idx].uv = (float(uv_src[v_idx, 0]), float(uv_src[v_idx, 1]))

    for poly in me.polygons:
        poly.use_smooth = True
    me.update()

    obj = bpy.data.objects.new("HumanBustV6", me)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

    obj.shape_key_add(name="imani", from_mix=False)
    for key_name in ("makeda", "june", "elder", "hanna"):
        sk = obj.shape_key_add(name=key_name, from_mix=False)
        p_arr = pheno_meshes[key_name]["pos"]
        for vi in range(len(verts_list)):
            sk.data[vi].co = (float(p_arr[vi, 0]), float(p_arr[vi, 1]), float(p_arr[vi, 2]))

    glb_path = os.path.join(OUT_DIR, "human_bust_v6.glb")
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_morph=True,
        export_yup=True,
    )
    print("Exported Blender GLB:", glb_path, "size:", os.path.getsize(glb_path))


def value_noise_2d(u, v, freq_u, freq_v, seed=0.0):
    gx = u * freq_u
    gy = v * freq_v
    ix = np.floor(gx).astype(np.int32)
    iy = np.floor(gy).astype(np.int32)
    fx = gx - ix
    fy = gy - iy
    ux = fx * fx * (3.0 - 2.0 * fx)
    uy = fy * fy * (3.0 - 2.0 * fy)

    def h(ax, ay):
        ax_w = np.mod(ax, int(freq_u))
        s = np.sin(ax_w * 127.1 + ay * 311.7 + seed * 74.7) * 43758.5453
        return s - np.floor(s)

    c00 = h(ix, iy)
    c10 = h(ix + 1, iy)
    c01 = h(ix, iy + 1)
    c11 = h(ix + 1, iy + 1)
    return (c00 * (1.0 - ux) + c10 * ux) * (1.0 - uy) + (c01 * (1.0 - ux) + c11 * ux) * uy


def cellular_pores_2d(u, v, freq_u, freq_v, seed=1.3):
    gx = u * freq_u
    gy = v * freq_v
    ix = np.floor(gx).astype(np.int32)
    iy = np.floor(gy).astype(np.int32)
    fx = gx - ix
    fy = gy - iy
    min_d2 = np.full_like(u, 9.0)
    fu_i = int(freq_u)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            cx = np.mod(ix + ox, fu_i)
            cy = iy + oy
            h1 = np.sin(cx * 127.1 + cy * 311.7 + seed * 19.1) * 43758.5453
            h1 = h1 - np.floor(h1)
            h2 = np.sin(cx * 269.5 + cy * 183.3 + seed * 47.3) * 43758.5453
            h2 = h2 - np.floor(h2)
            dx = ox + 0.18 + 0.64 * h1 - fx
            dy = oy + 0.18 + 0.64 * h2 - fy
            min_d2 = np.minimum(min_d2, dx * dx + dy * dy)
    r = np.sqrt(min_d2)
    return -np.exp(-(r / 0.24) ** 2)


def bake_1k_head_maps(size=1024):
    ys_px = np.linspace(1.0 - 0.5 / size, 0.5 / size, size, dtype=np.float32)
    xs_px = np.linspace(0.5 / size, 1.0 - 0.5 / size, size, dtype=np.float32)
    U, V = np.meshgrid(xs_px, ys_px)

    in_head = (V <= 0.828).astype(np.float32)

    py_approx = np.where(
        V <= 0.28,
        1.258 + np.clip((V - 0.02) / 0.26, 0.0, 1.0) * (1.495 - 1.258),
        np.where(
            V <= 0.74,
            1.495 + np.clip((V - 0.28) / 0.46, 0.0, 1.0) * (1.690 - 1.495),
            1.690 + np.clip((V - 0.74) / 0.08, 0.0, 1.0) * (1.742 - 1.690)
        )
    )
    t_mag = (U - 0.5) * 2.0
    ang = np.sign(t_mag) * (np.abs(t_mag) ** (1.0 / 0.82)) * math.pi
    abs_ang = np.abs(ang)
    front_mask = smooth(1.35, 0.35, abs_ang) * in_head
    px_approx = np.sin(ang) * 0.068

    pores_coarse = cellular_pores_2d(U, V, 196, 196, seed=2.1)
    pores_fine = cellular_pores_2d(U, V, 360, 360, seed=5.7)
    skin_micro_grain = (value_noise_2d(U, V, 140, 140, seed=8.3) - 0.5) * 0.35 + (value_noise_2d(U, V, 420, 420, seed=11.9) - 0.5) * 0.22

    t_zone_pores = (
        1.30 * g2(px_approx, py_approx, 0.0, 1.584, 0.020, 0.016) +
        1.10 * g2(np.abs(px_approx), py_approx, 0.034, 1.588, 0.022, 0.018) +
        0.80 * g2(px_approx, py_approx, 0.0, 1.652, 0.042, 0.022) +
        0.70 * g2(px_approx, py_approx, 0.0, 1.520, 0.026, 0.014)
    ) * front_mask
    pore_amp = (0.14 + 0.46 * np.clip(t_zone_pores, 0.0, 1.4)) * in_head

    # Strict oral-azimuth gate (abs_ang < 0.28 rad == ax < mwLip * 0.94) -> ZERO baked line past mouth corners!
    mouth_ang_gate = (1.0 - smooth(0.20, 0.28, abs_ang)) * in_head
    lip_zone = g2(px_approx, py_approx, 0.0, 1.5525, 0.0185, 0.0096) * mouth_ang_gate
    pore_amp *= (1.0 - 0.88 * lip_zone)

    lip_striae = np.sin(px_approx * 1650.0 + 0.45 * np.sin(py_approx * 420.0)) * 0.5 + 0.5
    lip_height = -0.15 * (1.0 - lip_striae) * lip_zone * (1.0 - g1(py_approx, 1.5525, 0.0018))

    forehead_lines = np.sin(py_approx * 920.0 + 0.6 * value_noise_2d(U, V, 24, 24, 3.1)) * 0.05 * g2(px_approx, py_approx, 0.0, 1.662, 0.038, 0.016) * front_mask
    neck_micro_rings = np.sin(py_approx * 560.0) * 0.04 * g1(py_approx, 1.468, 0.032) * smooth(1.6, 0.2, abs_ang) * in_head

    alar_sulcus_h = -0.45 * g2(np.abs(px_approx), py_approx, 0.0198, 1.580, 0.0030, 0.0060) * front_mask
    philtrum_col_h = +0.22 * g1(np.abs(px_approx), 0.0052, 0.0020) * g1(py_approx, 1.5655, 0.0055) * mouth_ang_gate
    white_roll_h = +0.18 * g1(py_approx, 1.5608 - 0.0025 * (px_approx / 0.020) ** 2, 0.0014) * mouth_ang_gate

    # Sculpted directional eyebrow hair strokes (0b07591c.jpg clay brow relief + PBR hair micro-normals!)
    ax_b = np.abs(px_approx)
    brow_y_ctr = 1.6358 + 0.0044 * smooth(0.011, 0.035, ax_b) - 0.0040 * smooth(0.035, 0.051, ax_b)
    brow_env = g1(py_approx, brow_y_ctr, 0.0034) * smooth(0.010, 0.016, ax_b) * (1.0 - smooth(0.043, 0.051, ax_b)) * front_mask
    brow_fan = (ax_b * 1250.0 - (py_approx - brow_y_ctr) * 1950.0)
    brow_strokes = (np.sin(brow_fan + 1.8 * value_noise_2d(U, V, 64, 64, 7.7)) * 0.5 + 0.5) * (np.sin(brow_fan * 1.9 + 0.9) * 0.5 + 0.5)
    brow_relief_h = +0.34 * (brow_strokes - 0.35) * brow_env

    H = (pore_amp * (0.62 * pores_coarse + 0.38 * pores_fine + 0.28 * skin_micro_grain)
         + lip_height + forehead_lines + neck_micro_rings + alar_sulcus_h + philtrum_col_h + white_roll_h + brow_relief_h)

    ear_ao = np.ones_like(U)
    for side, u_ctr in ((1.0, 0.25), (-1.0, 0.75)):
        du_e = (U - u_ctr) / (0.46 * 0.44) * side
        dv_e = (V - 0.91) / (0.46 * 0.14)
        r_e = np.hypot(du_e, dv_e)
        mask_this_ear = (V >= 0.835) & (np.abs(U - u_ctr) < 0.235) & (r_e <= 1.02)
        t_rad_e = np.clip((1.0 - r_e) / 0.88, 0.0, 1.0)
        th_e = np.mod(np.arctan2(dv_e, du_e), TAU)
        cth_e = np.cos(th_e)
        sth_e = np.sin(th_e)

        weld_fade = smooth(0.06, 0.22, t_rad_e) * mask_this_ear.astype(np.float32)
        helix_m = smooth(0.18, 0.55, th_e) * (1.0 - smooth(4.15, 4.65, th_e)) * (th_e < 5.2).astype(np.float32)
        scapha_e = g1(t_rad_e, 0.56, 0.06) * helix_m
        tri_fossa_e = g1(t_rad_e, 0.63, 0.07) * g1(sth_e, 0.52, 0.18) * smooth(-0.25, 0.45, cth_e)
        concha_e = g1(t_rad_e, 0.85, 0.11)
        canal_e = smooth(0.86, 0.99, t_rad_e)
        antihelix_e = g1(t_rad_e, 0.68, 0.075) * smooth(0.35, -0.45, cth_e) * smooth(-0.68, 0.68, sth_e)

        ear_pores = cellular_pores_2d(U, V, 220, 220, seed=9.4) * 0.20
        H += weld_fade * (ear_pores - 0.42 * scapha_e - 0.36 * tri_fossa_e + 0.38 * antihelix_e - 0.50 * concha_e)
        this_ao = 1.0 - weld_fade * (0.26 * scapha_e + 0.24 * tri_fossa_e + 0.42 * concha_e + 0.58 * canal_e)
        ear_ao = np.minimum(ear_ao, this_ao)

    border_guard = (1.0 - g1(V, 0.831, 0.008)).astype(np.float32)
    H *= border_guard

    dH_dx = np.zeros_like(H)
    dH_dy = np.zeros_like(H)
    dH_dx[:, 1:-1] = (H[:, 2:] - H[:, :-2]) * 0.5
    dH_dx[:, 0] = (H[:, 1] - H[:, -1]) * 0.5
    dH_dx[:, -1] = (H[:, 0] - H[:, -2]) * 0.5
    dH_dy[1:-1, :] = (H[:-2, :] - H[2:, :]) * 0.5

    strength = 1.65
    nx = -dH_dx * strength
    ny = -dH_dy * strength
    nz = np.ones_like(H)
    inv_len = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
    nx *= inv_len
    ny *= inv_len
    nz *= inv_len

    normal_rgb = np.stack([
        np.clip((nx * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((ny * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((nz * 0.5 + 0.5) * 255.0, 0, 255),
    ], axis=-1).astype(np.uint8)

    nostril_ao = 0.30 * g2(np.abs(px_approx), py_approx, 0.0090, 1.5770, 0.0032, 0.0020) * front_mask
    alar_ao = 0.16 * g2(np.abs(px_approx), py_approx, 0.0198, 1.580, 0.0030, 0.0060) * front_mask
    rima_ao = 0.28 * g1(py_approx, 1.5525, 0.0014) * (1.0 - smooth(0.14, 0.22, abs_ang)) * in_head
    comm_ao = 0.08 * g2(abs_ang, py_approx, 0.235, 1.5526, 0.018, 0.0018) * in_head
    labio_ao = 0.10 * g1(py_approx, 1.5355, 0.0052) * g1(px_approx, 0.0, 0.018) * front_mask
    submental_ao = 0.15 * g1(py_approx, 1.501, 0.0095) * g1(px_approx, 0.0, 0.026) * front_mask
    jugular_ao = 0.15 * g2(px_approx, py_approx, 0.0, 1.408, 0.014, 0.014) * front_mask
    supraclav_ao = 0.10 * g2(np.abs(px_approx), py_approx, 0.056, 1.424, 0.022, 0.009) * front_mask
    orb_hood_ao = 0.08 * g2(np.abs(px_approx), py_approx, 0.029, 1.625, 0.018, 0.0048) * front_mask
    pore_cavity = np.clip(-pores_coarse * pore_amp * 0.04, 0.0, 0.04)

    head_ao = 1.0 - (nostril_ao + alar_ao + rima_ao + comm_ao + labio_ao + submental_ao + jugular_ao + supraclav_ao + orb_hood_ao + pore_cavity)
    total_ao = np.clip(np.where(V >= 0.835, ear_ao, head_ao), 0.18, 1.0)
    ao_rgb = np.repeat(np.clip(total_ao * 255.0, 0, 255).astype(np.uint8)[:, :, None], 3, axis=-1)

    nose_sheen = 0.20 * g1(px_approx, 0.0, 0.012) * smooth(1.576, 1.615, py_approx) * (1.0 - smooth(1.615, 1.628, py_approx)) * front_mask
    tip_sheen = 0.22 * g2(px_approx, py_approx, 0.0, 1.583, 0.012, 0.010) * front_mask
    malar_sheen = 0.16 * g2(np.abs(px_approx), py_approx, 0.048, 1.595, 0.020, 0.014) * front_mask
    brow_sheen = 0.12 * g2(np.abs(px_approx), py_approx, 0.026, 1.646, 0.034, 0.018) * front_mask
    lip_gloss = 0.24 * lip_zone
    pore_rough_lift = np.clip(-pores_coarse * pore_amp * 0.09, 0.0, 0.08) + (1.0 - total_ao) * 0.16

    rough = np.clip(0.66 - (nose_sheen + tip_sheen + malar_sheen + brow_sheen + lip_gloss) + pore_rough_lift, 0.32, 0.88)
    rough_rgb = np.repeat(np.clip(rough * 255.0, 0, 255).astype(np.uint8)[:, :, None], 3, axis=-1)

    return normal_rgb, ao_rgb, rough_rgb


def bake_512_hand_maps(size=512):
    ys = np.linspace(1.0 - 0.5 / size, 0.5 / size, size, dtype=np.float32)
    xs = np.linspace(0.5 / size, 1.0 - 0.5 / size, size, dtype=np.float32)
    U, V = np.meshgrid(xs, ys)

    diag1 = np.sin((U * 1.1 + V * 0.9) * 260.0 + 1.2 * value_noise_2d(U, V, 28, 28, 1.7))
    diag2 = np.sin((U * 0.9 - V * 1.1) * 260.0 + 1.2 * value_noise_2d(U, V, 28, 28, 4.3))
    rhytids = -0.14 * (np.abs(diag1) < 0.18).astype(np.float32) - 0.14 * (np.abs(diag2) < 0.18).astype(np.float32)
    pores = cellular_pores_2d(U, V, 150, 150, seed=6.2) * 0.20

    knuckle_wrinkles = (
        g1(V, 0.78, 0.025) * np.cos((V - 0.78) * 420.0) * 0.35 +
        g1(V, 0.88, 0.020) * np.cos((V - 0.88) * 460.0) * 0.28 +
        g1(V, 0.64, 0.030) * np.cos((V - 0.64) * 320.0) * 0.22
    )
    H = pores + 0.35 * rhytids + knuckle_wrinkles

    dH_dx = np.gradient(H, axis=1) * 1.6
    dH_dy = -np.gradient(H, axis=0) * 1.6
    nz = np.ones_like(H)
    inv_l = 1.0 / np.sqrt(dH_dx ** 2 + dH_dy ** 2 + nz ** 2)
    nrm_rgb = np.stack([
        np.clip((-dH_dx * inv_l * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((-dH_dy * inv_l * 0.5 + 0.5) * 255.0, 0, 255),
        np.clip((nz * inv_l * 0.5 + 0.5) * 255.0, 0, 255),
    ], axis=-1).astype(np.uint8)

    ao = np.clip(0.96 + 0.08 * knuckle_wrinkles + 0.04 * pores, 0.72, 1.0)
    rough = np.clip(0.65 - 0.08 * g1(V, 0.64, 0.05) - 0.06 * g1(V, 0.78, 0.04) - 0.05 * pores, 0.45, 0.84)
    ao_rough_rgb = np.stack([
        np.clip(ao * 255.0, 0, 255),
        np.clip(rough * 255.0, 0, 255),
        np.clip(ao * 255.0, 0, 255),
    ], axis=-1).astype(np.uint8)

    return nrm_rgb, ao_rough_rgb


def write_png_raw_rgb(path, rgb_arr):
    import zlib
    h, w, _ = rgb_arr.shape
    raw_rows = b"".join(b"\x00" + rgb_arr[y].tobytes() for y in range(h))
    compressed = zlib.compress(raw_rows, level=6)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", compressed))
        f.write(chunk(b"IEND", b""))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print("[1/4] Sculpting 5 Cast Phenotypes with Unified Manifold Topology & Taubin Clay Polish...")
    pheno_meshes = {}
    canon_topo = None
    for key in ("imani", "makeda", "june", "elder", "hanna"):
        m = build_phenotype_mesh(key, canonical_topology=canon_topo)
        if canon_topo is None:
            canon_topo = m["canonical_topology"]
        apply_taubin_clay_polish(m)
        pos, bind_pos, nrm = compute_smooth_normals_and_tuck(m)
        m["pos"] = pos
        m["bind_pos"] = bind_pos
        m["nrm"] = nrm
        pheno_meshes[key] = m
        print(f"  - {key:8s}: {len(pos)} verts, {len(m['idx']) // 3} tris")

    try:
        import bpy  # noqa: F401
        print("[2/4] Running Blender 3.4 Mesh + Shape-Key GLB Export...")
        run_blender_sculpt_and_glb_export(pheno_meshes)
    except ImportError:
        print("[2/4] Not inside Blender; skipping bpy GLB step.")

    print("[3/4] Baking 1024x1024 Head Normal + Cavity AO + Roughness Pore Maps & 512x512 Hand Maps...")
    head_nrm, head_ao, head_rough = bake_1k_head_maps(1024)
    hand_nrm, hand_ao_rough = bake_512_hand_maps(512)

    write_png_raw_rgb(os.path.join(OUT_DIR, "human_head_normal_1k.png"), head_nrm)
    write_png_raw_rgb(os.path.join(OUT_DIR, "human_head_ao_cavity_1k.png"), head_ao)
    write_png_raw_rgb(os.path.join(OUT_DIR, "human_head_roughness_pore_1k.png"), head_rough)
    write_png_raw_rgb(os.path.join(OUT_DIR, "human_hand_normal_512.png"), hand_nrm)
    write_png_raw_rgb(os.path.join(OUT_DIR, "human_hand_ao_rough_512.png"), hand_ao_rough)

    print("[4/4] Packing compact binary mesh & orbital socket tables...")
    base = pheno_meshes["imani"]
    v_count = len(base["pos"])
    i_count = len(base["idx"])

    p_f32 = base["pos"].astype(np.float32).tobytes()
    bp_f32 = base["bind_pos"].astype(np.float32).tobytes()
    n_i16 = np.clip(np.round(base["nrm"] * 32767.0), -32767, 32767).astype(np.int16).tobytes()
    uv_u16 = np.clip(np.round(base["uv"] * 65535.0), 0, 65535).astype(np.uint16).tobytes()
    ear_u8 = np.clip(np.round(base["is_ear"] * 255.0), 0, 255).astype(np.uint8).tobytes()
    if len(ear_u8) % 4 != 0:
        ear_u8 += b"\x00" * (4 - (len(ear_u8) % 4))
    idx_u16 = base["idx"].astype(np.uint16).tobytes()
    if len(idx_u16) % 4 != 0:
        idx_u16 += b"\x00" * (4 - (len(idx_u16) % 4))

    bin_chunks = [p_f32, bp_f32, n_i16, uv_u16, ear_u8, idx_u16]

    morph_meta = {}
    offset_cursor = sum(len(c) for c in bin_chunks)
    for k in ("makeda", "june", "elder", "hanna"):
        m = pheno_meshes[k]
        d_pos = np.clip(np.round((m["pos"] - base["pos"]) * 500000.0), -32767, 32767).astype(np.int16).tobytes()
        d_bpos = np.clip(np.round((m["bind_pos"] - base["bind_pos"]) * 500000.0), -32767, 32767).astype(np.int16).tobytes()
        d_nrm = np.clip(np.round((m["nrm"] - base["nrm"]) * 32767.0), -32767, 32767).astype(np.int16).tobytes()
        orb_bytes = m["orb_grid"].astype(np.float32).tobytes()
        morph_meta[k] = {
            "dPosOffset": offset_cursor,
            "dPosBytes": len(d_pos),
            "dBindOffset": offset_cursor + len(d_pos),
            "dBindBytes": len(d_bpos),
            "dNrmOffset": offset_cursor + len(d_pos) + len(d_bpos),
            "dNrmBytes": len(d_nrm),
            "orbOffset": offset_cursor + len(d_pos) + len(d_bpos) + len(d_nrm),
            "orbBytes": len(orb_bytes),
        }
        chunk_k = d_pos + d_bpos + d_nrm + orb_bytes
        bin_chunks.append(chunk_k)
        offset_cursor += len(chunk_k)

    imani_orb_bytes = base["orb_grid"].astype(np.float32).tobytes()
    imani_orb_offset = offset_cursor
    bin_chunks.append(imani_orb_bytes)

    bin_path = os.path.join(OUT_DIR, "human_bust_v6.bin")
    full_bin = b"".join(bin_chunks)
    with open(bin_path, "wb") as f:
        f.write(full_bin)

    manifest = {
        "version": "6.1.0",
        "generator": "Blender 3.4.1 + NumPy Anatomical Sculptor & 1K PBR Baker",
        "vertexCount": int(v_count),
        "triangleCount": int(i_count // 3),
        "gridCount": int(base["grid_count"]),
        "baseMouthVertex": int(base["base_mouth"]),
        "nMouth": int(base["nmouth"]),
        "vMouth": int(base["vmouth"]),
        "orbBounds": base["orb_bounds"],
        "orbGridShape": list(base["orb_grid"].shape),
        "layout": {
            "pos": [0, len(p_f32)],
            "bindPos": [len(p_f32), len(bp_f32)],
            "nrmInt16": [len(p_f32) + len(bp_f32), len(n_i16)],
            "uvUint16": [len(p_f32) + len(bp_f32) + len(n_i16), len(uv_u16)],
            "earUint8": [len(p_f32) + len(bp_f32) + len(n_i16) + len(uv_u16), v_count],
            "idxUint16": [len(p_f32) + len(bp_f32) + len(n_i16) + len(uv_u16) + len(ear_u8), i_count * 2],
            "imaniOrbFloat32": [imani_orb_offset, len(imani_orb_bytes)],
            "morphs": morph_meta,
        },
        "maps": {
            "headNormal": "human_head_normal_1k.png",
            "headAoCavity": "human_head_ao_cavity_1k.jpg",
            "headRoughnessPore": "human_head_roughness_pore_1k.jpg",
            "handNormal": "human_hand_normal_512.png",
            "handAoRough": "human_hand_ao_rough_512.jpg",
        },
        "phenotypes": {k: PHENOTYPES[k]["label"] for k in PHENOTYPES},
    }
    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print("Saved binary pack:", bin_path, "bytes:", len(full_bin))


if __name__ == "__main__":
    main()
