from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routers import health, transcription

app = FastAPI(
    title="Audio Transcriber API",
    version="1.0.0",
    description="Transcribe audio files using multiple backends.",
)

# CORS — accept comma-separated origins so dev (5173) and prod (Render URL) both work.
origins = [o.strip() for o in settings.frontend_origin.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure temp dir exists
Path(settings.temp_dir).mkdir(parents=True, exist_ok=True)

# Register routers
app.include_router(health.router, prefix="/api")
app.include_router(transcription.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Audio Transcriber API is running. Visit /docs for API reference."}
