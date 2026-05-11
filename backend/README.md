---
title: Audio Transcriber API
emoji: 🎙
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Audio Transcriber API

FastAPI backend for the [Audio Transcriber](https://github.com/jnthnfr/audio-transcriber) project. Splits uploaded audio into chunks via FFmpeg and routes each chunk through one of four transcription engines (local Whisper, OpenAI API, Google Cloud STT, browser Web Speech).

## Endpoints

- `GET /api/health` — backend availability + which engines are reachable
- `POST /api/transcribe` — multipart upload, returns `job_id`
- `GET /api/status/{job_id}` — poll progress
- `GET /api/result/{job_id}` — fetch completed transcript
- `DELETE /api/job/{job_id}` — clean up

Interactive docs at `/docs`.

## Configuration

Set these as Space secrets (Settings → Variables and secrets):

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Enables the OpenAI Whisper API backend |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Cloud service account JSON |
| `FRONTEND_ORIGIN` | Comma-separated list of allowed CORS origins (e.g. your deployed frontend URL) |

On the free Space CPU plan, **local Whisper inference is slow** (~10x realtime for the `base` model). Prefer the OpenAI API backend for production loads, or upgrade the Space hardware.
