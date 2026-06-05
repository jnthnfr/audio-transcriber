# Audio Transcriber

A full-stack audio transcription tool. Upload any audio file, split into chunks, and transcribe via **Whisper Local**, **OpenAI API**, **Google Cloud STT**, or **Web Speech API**.

## Prerequisites

| Tool | Install |
|------|---------|
| Python 3.10+ | [python.org](https://python.org) |
| Node 18+ | [nodejs.org](https://nodejs.org) |
| FFmpeg | `winget install ffmpeg` |

## Quick Start

### 1. Backend

```powershell
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Copy and configure env
copy ..\env.example .\.env
# Edit .env — set API keys if needed

# Start backend
uvicorn main:app --reload
```

Backend runs at http://localhost:8000. Visit `/docs` for Swagger UI.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173.

## Configuration

Copy `.env.example` to `.env` in the project root and fill in:

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Required for OpenAI Whisper API backend |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Google Cloud service account JSON |
| `WHISPER_CACHE_DIR` | Where local Whisper models are cached |
| `DEFAULT_WHISPER_MODEL` | `tiny` / `base` / `small` / `medium` / `large` |
| `MAX_UPLOAD_SIZE_MB` | Max upload size in megabytes |
| `TEMP_DIR` | Directory for temporary job files |
| `HF_TOKEN` | Hugging Face token for speaker diarization (pyannote) |
| `DIARIZATION_MODEL` | Diarization model id (default `pyannote/speaker-diarization-3.1`) |

## Audio Trim (optional)

Use the **Trim audio** section in the config panel to transcribe only a
portion of the upload. A native audio player above the inputs lets you
scrub to find the right timestamps; the start/end fields accept seconds
(decimals OK). Leave **End** blank to run to the end of the file.

The trim is applied with `ffmpeg` before chunking, so transcript chunk
labels are relative to the trimmed clip rather than the original file.

## Transcription Backends

| Backend | Notes |
|---------|-------|
| **Whisper Local** | Runs on CPU/GPU, no API key needed, model downloaded on first use |
| **OpenAI API** | Requires `OPENAI_API_KEY`, 25MB/file limit (handled by chunking) |
| **Google Cloud STT** | Requires `GOOGLE_APPLICATION_CREDENTIALS` JSON |
| **Web Speech** | Experimental — Chrome only, files < 2 min |

## Speaker Detection (diarization)

Toggle **Detect speakers** in the UI to label each segment with a speaker
name (`Speaker 1`, `Speaker 2`, …). Diarization runs once on the full
source file after transcription completes, assigns each chunk's dominant
speaker, then formats the transcript as dialogue — consecutive turns by
the same speaker are grouped under a single prefix.

Two engines are supported, picked automatically in this order:

| Engine | Quality | Setup |
|--------|---------|-------|
| **pyannote.audio** | Higher | Requires `HF_TOKEN` + accepting the model license |
| **Resemblyzer** | Lower | Zero setup — installs with the requirements |

The transcript header chip shows which engine was used (`pyannote` or
`resemblyzer`).

Example output:

```
Speaker 1: Good morning. How are you?

Speaker 2: I'm fine, thanks. Anyway, let's begin.

Speaker 1: Sounds good.
```

Pyannote setup (one-time, optional):

1. Create a free Hugging Face token at https://huggingface.co/settings/tokens
2. Accept the model license at https://huggingface.co/pyannote/speaker-diarization-3.1
3. Set `HF_TOKEN=hf_...` in `backend/.env` (or HF Space / Render secrets)

If `HF_TOKEN` is unset, the backend falls back to Resemblyzer automatically.

Notes:

- Works with any transcription backend except Web Speech.
- CPU runtime adds ~0.5x the audio length to the job. GPU is much faster.
- On Render the free/Starter tier (512MB RAM) will OOM under PyTorch. Use the
  Standard plan (2GB) or stay on HF Spaces free CPU basic (16GB).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend availability status |
| POST | `/api/transcribe` | Upload and start transcription |
| GET | `/api/status/{job_id}` | Poll job progress |
| GET | `/api/result/{job_id}` | Get completed transcript |
| DELETE | `/api/job/{job_id}` | Clean up temp files |

## Deployment (free)

Two pieces, two hosts:

| Piece | Host | Cost |
|-------|------|------|
| Backend (FastAPI + FFmpeg) | Hugging Face Spaces (Docker SDK) | Free |
| Frontend (static React build) | Render Static Site | Free |

### Backend → Hugging Face Space

The `backend/` directory is a self-contained HF Space. The frontmatter in `backend/README.md` tells HF to build the Docker image.

```bash
# One-time setup
# 1. Create a Space at https://huggingface.co/new-space
#    - Owner: your HF username
#    - Space name: audio-transcriber
#    - SDK: Docker
#    - Hardware: CPU basic (free)

# 2. Push the backend folder to the Space:
git subtree push --prefix=backend https://huggingface.co/spaces/<your-username>/audio-transcriber main
```

After the first push, the Space builds and exposes the API at `https://<your-username>-audio-transcriber.hf.space`.

Set secrets in the Space's **Settings → Variables and secrets**:
- `OPENAI_API_KEY` — if using the OpenAI backend
- `FRONTEND_ORIGIN` — your Render frontend URL (e.g. `https://audio-transcriber-web.onrender.com`)

> Note: the free CPU plan runs local Whisper at ~10x realtime. For production loads use the OpenAI API backend or upgrade the Space hardware.

### Frontend → Render Static Site

`render.yaml` deploys the frontend as a free static site.

1. In the Render dashboard, **New → Blueprint** and select this repo.
2. On the deployed service, set the env var `VITE_API_BASE_URL` to your HF Space URL (`https://<your-username>-audio-transcriber.hf.space`).
3. Render rebuilds with the URL baked in.

### Local Docker test (optional)

```powershell
cd backend
docker build -t audio-transcriber-api .
docker run --rm -p 7860:7860 -e FRONTEND_ORIGIN=http://localhost:5173 audio-transcriber-api
```

## Project Structure

```
AudioTranscriber/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings from .env
│   ├── requirements.txt
│   ├── routers/
│   │   ├── health.py
│   │   └── transcription.py
│   ├── services/
│   │   ├── audio_processor.py
│   │   ├── whisper_service.py
│   │   ├── openai_service.py
│   │   └── google_stt_service.py
│   └── models/
│       └── schemas.py
└── frontend/
    └── src/
        ├── components/      # UI components
        ├── hooks/           # React hooks
        ├── store/           # Zustand state
        ├── api/             # Axios wrappers
        └── types/           # TypeScript types
```
