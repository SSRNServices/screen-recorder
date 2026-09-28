# FFmpeg Video Processing Engine

## Supported Transcoding Profiles

ScreenRecorder standardizes on three FFmpeg profiles:

### 1. Standard (Default)
- **Video Codec**: `libx264`
- **Rate Control**: CRF 23
- **Speed Preset**: `medium`
- **Pixel Format**: `yuv420p` (maximum player compatibility)
- **Audio Codec**: `aac`
- **Audio Bitrate**: 192 kbps

### 2. High Quality
- **Video Codec**: `libx264`
- **Rate Control**: CRF 18
- **Speed Preset**: `slow`
- **Audio Codec**: `aac`
- **Audio Bitrate**: 256 kbps

### 3. Small File
- **Video Codec**: `libx264`
- **Rate Control**: CRF 28
- **Speed Preset**: `medium`
- **Audio Codec**: `aac`
- **Audio Bitrate**: 128 kbps

## Progress Reporting

ScreenRecorder uses `-progress pipe:1` or `progress` monitoring flags to parse deterministic, machine-readable key-value updates:

```text
frame=425
fps=59.4
total_size=1209382
out_time_us=7120000
dup_frames=0
drop_frames=0
speed=1.02x
progress=continue
```
