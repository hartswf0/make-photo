# Meta Sapiens 2 & Sapiens 1 Availability Status

*Verified: 2026-11-20 via unauthenticated HuggingFace Hub API (`HEAD` + `GET` without token).*

## 1. Meta Sapiens 2 (`arXiv:2604.21681`)
- **Paper / Code:** [arXiv:2604.21681](https://arxiv.org/abs/2604.21681) · [github.com/facebookresearch/sapiens2](https://github.com/facebookresearch/sapiens2)
- **HuggingFace Availability:** **PUBLIC & UNGATED (`gated: false`)** — no login or HF token required for download.
- **License:** Custom **Sapiens2 License** (`license: other`, `https://github.com/facebookresearch/sapiens2/blob/main/LICENSE.md`). **Not CC0 / Apache-2.0** — keep weights out of this CC0/open repo; download on demand into `~/.cache/huggingface/hub`.
- **Verified Repositories & Sizes (`0.4B` tier):**
  - `facebook/sapiens2-pose-0.4b` (`Sapiens2ForPoseEstimation`, `model.safetensors`, **1702.8 MB**, 308 Sociopticon keypoints)
  - `facebook/sapiens2-normal-0.4b` (`Sapiens2ForNormalEstimation`, `model.safetensors`, **1813.5 MB**)
  - `facebook/sapiens2-seg-0.4b` (`Sapiens2ForSemanticSegmentation`, `model.safetensors`, **1626.5 MB**)
  - `facebook/sapiens2-pointmap-0.4b` (`model.safetensors`)
  - Also available in `0.8B`, `1B`, `5B` tiers and `sapiens2-matting-1b`.
- **Local Runtime Note:** Sapiens 2 checkpoints use `library_name: sapiens2` (`model_type: "sapiens2"`, `Sapiens2For*`). On this workstation (`transformers 4.29.2`, without the `sapiens2` package installed), direct `AutoModel.from_pretrained` requires installing `facebookresearch/sapiens2` or a `transformers` build with `sapiens2` support. `extract_sapiens.py --backend sapiens2` is wired and ready once `sapiens2` is installed.

## 2. Meta Sapiens 1 TorchScript Lite (`0.3B`)
- **HuggingFace Availability:** **PUBLIC & UNGATED (`gated: false`)** — HTTP 200 keyless download.
- **License:** **CC-BY-NC-4.0** (non-commercial research/study). Weights are cached locally in `~/.cache/huggingface/hub` and never committed to git.
- **Verified Self-Contained TorchScript Checkpoints (zero external library deps beyond `torch`):**
  - `facebook/sapiens-normal-0.3b-torchscript` → `sapiens_0.3b_normal_render_people_epoch_66_torchscript.pt2` (**1358.8 MB**)
  - `facebook/sapiens-pose-0.3b-torchscript` → `sapiens_0.3b_goliath_best_goliath_AP_573_torchscript.pt2` (**1319.6 MB**, 308 Goliath keypoints)
  - `facebook/sapiens-seg-0.3b-torchscript` → `sapiens_0.3b_goliath_best_goliath_mIoU_7673_epoch_194_torchscript.pt2` (**1358.9 MB**, 28 body-part classes)
- **Local Runtime:** Runs natively on Apple Silicon (`torch 2.13.0`, `MPS` / `CPU`) via `torch.jit.load()`.

## 3. Open Local Fallback Backend
- If offline or running without downloading ~1.3 GB checkpoints, `extract_sapiens.py --backend fallback` runs a pure OpenCV/NumPy luminance-gradient normal + contour/skin-mask + optical-flow upper-body landmark extractor and explicitly tags `extracted/manifest.json` with `"backend": "fallback"`.

## 4. Usage
```bash
# Default: auto-select Sapiens 1 TorchScript 0.3B (keyless HF download -> MPS/CPU),
# or pass --backend sapiens2 when facebookresearch/sapiens2 is installed,
# or --backend fallback for zero-download offline mode.
python3 motion-pipeline/sapiens2/extract_sapiens.py --backend auto

# With explicit local checkpoints or HF token:
python3 motion-pipeline/sapiens2/extract_sapiens.py \
  --backend sapiens1-ts \
  --hf-token "$HF_TOKEN" \
  --normal-ckpt /path/to/sapiens_0.3b_normal.pt2 \
  --pose-ckpt /path/to/sapiens_0.3b_pose.pt2
```
