FROM python:3.11-slim

# System deps: ffmpeg for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces expects a non-root user with a writable home directory.
# Create one and use it as the runtime user.
RUN useradd -m -u 1000 app
USER app
ENV HOME=/home/app PATH=/home/app/.local/bin:$PATH

WORKDIR /home/app

# Install Python deps first for better Docker layer caching
COPY --chown=app:app requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy backend source
COPY --chown=app:app . .

# Writable runtime dirs (HF Spaces / containers prefer /tmp for ephemeral data)
ENV TEMP_DIR=/tmp/audio-transcriber \
    WHISPER_CACHE_DIR=/home/app/models \
    PORT=7860
RUN mkdir -p ${TEMP_DIR} ${WHISPER_CACHE_DIR}

EXPOSE 7860

# HF Spaces inject $PORT (typically 7860). Render also injects $PORT.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}
