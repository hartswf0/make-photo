#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <input-video.mp4|mov> [output-dir=video/music-video]" >&2
  exit 1
fi

INPUT="$1"
OUTDIR="${2:-video/music-video}"

if [ ! -f "$INPUT" ]; then
  echo "Input file not found: $INPUT" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required (brew install ffmpeg)" >&2
  exit 1
fi

mkdir -p "$OUTDIR"

ffmpeg -y -i "$INPUT" \
  -vf "scale='min(1920,iw)':-2" \
  -c:v libx264 -preset medium -crf 21 -maxrate 4.5M -bufsize 9M \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  -c:a aac -b:a 192k \
  -hls_time 4 -hls_playlist_type vod \
  -hls_segment_filename "$OUTDIR/seg_%04d.ts" \
  "$OUTDIR/playlist.m3u8"

echo ""
echo "Largest segment in $OUTDIR:"
ls -lhS "$OUTDIR" | head -n 5
echo ""
echo "Test locally or on GitHub Pages:"
echo "  music-video.html?hls=./${OUTDIR}/playlist.m3u8"
