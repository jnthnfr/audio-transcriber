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

## Transcription Backends

| Backend | Notes |
|---------|-------|
| **Whisper Local** | Runs on CPU/GPU, no API key needed, model downloaded on first use |
| **OpenAI API** | Requires `OPENAI_API_KEY`, 25MB/file limit (handled by chunking) |
| **Google Cloud STT** | Requires `GOOGLE_APPLICATION_CREDENTIALS` JSON |
| **Web Speech** | Experimental — Chrome only, files < 2 min |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Backend availability status |
| POST | `/api/transcribe` | Upload and start transcription |
| GET | `/api/status/{job_id}` | Poll job progress |
| GET | `/api/result/{job_id}` | Get completed transcript |
| DELETE | `/api/job/{job_id}` | Clean up temp files |

## Deploying to Render

A `render.yaml` Blueprint at the repo root deploys both services from a single commit.

1. Push this repo to GitHub.
2. In the Render dashboard, **New → Blueprint** and select the repo. Render reads `render.yaml` and creates:
   - **audio-transcriber-api** — Docker web service (Python + FFmpeg + Whisper). Health-checked at `/api/health`.
   - **audio-transcriber-web** — Static site (Vite build). Routes are rewritten to `index.html` for SPA support.
3. Set sync-disabled env vars on the API service:
   - `OPENAI_API_KEY` (only if using the OpenAI backend)
   - `GOOGLE_APPLICATION_CREDENTIALS` (only if using Google Cloud STT — paste the JSON path or use Render Secret Files)
4. Render automatically wires `VITE_API_BASE_URL` on the frontend to the backend's URL, and `FRONTEND_ORIGIN` on the backend to the frontend's URL (so CORS works out of the box).

The free Render plan sleeps idle services. The first request after a sleep period will time out while the container cold-starts; the Whisper backend additionally needs to download the model on first use, so consider a paid plan for production.

### Local Docker test (optional)

```powershell
cd backend
docker build -t audio-transcriber-api .
docker run --rm -p 8000:8000 -e FRONTEND_ORIGIN=http://localhost:5173 audio-transcriber-api
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
