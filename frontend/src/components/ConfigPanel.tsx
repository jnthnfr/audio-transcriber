import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranscriptionStore } from '../store/transcriptionStore'
import { TrimSlider } from './TrimSlider'
import type { TranscriptionBackend, WhisperModel, HealthResponse } from '../types'

const BACKENDS: { value: TranscriptionBackend; label: string; desc: string }[] = [
  { value: 'whisper_local', label: 'Whisper Local', desc: 'Runs on your machine, no API key needed' },
  { value: 'whisper_api', label: 'OpenAI API', desc: 'Cloud API, requires key, fast' },
  { value: 'google_cloud', label: 'Google Cloud', desc: 'Requires credentials JSON' },
  { value: 'web_speech', label: 'Web Speech', desc: 'Experimental · Chrome only · < 2 min' },
]

const CHUNK_OPTIONS = [
  { value: 0, label: 'No chunking' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
]

const WHISPER_MODELS: WhisperModel[] = ['tiny', 'base', 'small', 'medium', 'large']

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ru', label: 'Russian' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'ar', label: 'Arabic' },
]

function isBackendAvailable(b: TranscriptionBackend, health: HealthResponse | null): boolean {
  if (!health) return b === 'whisper_local'
  switch (b) {
    case 'whisper_local': return health.whisper_local
    case 'whisper_api':   return health.whisper_api
    case 'google_cloud':  return health.google_cloud
    case 'web_speech':    return health.web_speech
  }
}

function formatSeconds(s: number): string {
  if (!isFinite(s) || s < 0) return '—'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function ConfigPanel() {
  const {
    file,
    backend, setBackend,
    chunkDuration, setChunkDuration,
    language, setLanguage,
    whisperModel, setWhisperModel,
    diarize, setDiarize,
    trimStartSeconds, setTrimStartSeconds,
    trimEndSeconds, setTrimEndSeconds,
    health, status,
  } = useTranscriptionStore()

  const isDisabled = status === 'processing' || status === 'queued'
  const diarizationAvailable = health?.diarization ?? false
  const diarizationSupportedForBackend = backend !== 'web_speech'

  // Object URL for the preview player. Recreated when the file changes, revoked on unmount.
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => { if (fileUrl) URL.revokeObjectURL(fileUrl) }
  }, [fileUrl])

  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)
  // Reset previewed duration + trim range when the file changes.
  useEffect(() => {
    setAudioDuration(null)
    setTrimStartSeconds(0)
    setTrimEndSeconds(null)
  }, [file, setTrimStartSeconds, setTrimEndSeconds])

  const seekPreview = (seconds: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration || seconds, seconds))
  }

  return (
    <div className="config-panel">
      {/* Backend selector */}
      <div className="config-section">
        <label className="config-label">Transcription Backend</label>
        <div className="backend-grid">
          {BACKENDS.map((b) => {
            const available = isBackendAvailable(b.value, health)
            return (
              <button
                key={b.value}
                id={`backend-${b.value}`}
                className={`backend-option ${backend === b.value ? 'active' : ''} ${!available ? 'unavailable' : ''}`}
                onClick={() => !isDisabled && available && setBackend(b.value)}
                disabled={isDisabled || !available}
                title={!available ? 'Not available — check API keys or install dependencies' : b.desc}
              >
                <span className="backend-dot" />
                <div className="backend-text">
                  <span className="backend-name">{b.label}</span>
                  <span className="backend-desc">{b.desc}</span>
                </div>
                {!available && <span className="backend-badge">Unavailable</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Row: chunk + language + model */}
      <div className="config-row">
        <div className="config-field">
          <label htmlFor="chunk-select" className="config-label">Chunk Size</label>
          <select
            id="chunk-select"
            className="config-select"
            value={chunkDuration}
            onChange={(e) => setChunkDuration(Number(e.target.value))}
            disabled={isDisabled}
          >
            {CHUNK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="config-field">
          <label htmlFor="language-select" className="config-label">Language</label>
          <select
            id="language-select"
            className="config-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isDisabled}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {backend === 'whisper_local' && (
          <div className="config-field">
            <label htmlFor="model-select" className="config-label">Whisper Model</label>
            <select
              id="model-select"
              className="config-select"
              value={whisperModel}
              onChange={(e) => setWhisperModel(e.target.value as WhisperModel)}
              disabled={isDisabled}
            >
              {WHISPER_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Trim — only when a file is loaded */}
      {file && fileUrl && (
        <div className="config-section">
          <label className="config-label">
            Trim audio (optional)
            {audioDuration !== null && (
              <span className="config-hint"> · file is {formatSeconds(audioDuration)}</span>
            )}
          </label>
          <audio
            id="trim-preview"
            ref={audioRef}
            className="trim-preview"
            src={fileUrl}
            controls
            preload="metadata"
            onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)}
          />
          {audioDuration !== null && audioDuration > 0 && (
            <TrimSlider
              duration={audioDuration}
              start={trimStartSeconds}
              end={trimEndSeconds}
              onChange={(s, e) => { setTrimStartSeconds(s); setTrimEndSeconds(e) }}
              onPreviewSeek={seekPreview}
              disabled={isDisabled}
            />
          )}
        </div>
      )}

      {/* Speaker detection */}
      {diarizationSupportedForBackend && (
        <div className="config-section">
          <label className="diarize-toggle" title={
            !diarizationAvailable
              ? 'Unavailable — set HF_TOKEN on the backend and accept the pyannote license, or install resemblyzer for a no-token fallback'
              : 'Detect and label distinct speakers (adds ~0.5x audio length on CPU)'
          }>
            <input
              id="diarize-checkbox"
              type="checkbox"
              checked={diarize && diarizationAvailable}
              onChange={(e) => setDiarize(e.target.checked)}
              disabled={isDisabled || !diarizationAvailable}
            />
            <div className="diarize-text">
              <span className="diarize-name">
                Detect speakers
                {!diarizationAvailable && <span className="backend-badge" style={{ position: 'static', marginLeft: 8 }}>Unavailable</span>}
              </span>
              <span className="diarize-desc">
                Run speaker diarization and prefix each segment with a speaker label.
              </span>
            </div>
          </label>
        </div>
      )}
    </div>
  )
}
