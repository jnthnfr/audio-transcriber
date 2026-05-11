import { useTranscriptionStore } from '../store/transcriptionStore'
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

export function ConfigPanel() {
  const {
    backend, setBackend,
    chunkDuration, setChunkDuration,
    language, setLanguage,
    whisperModel, setWhisperModel,
    health, status,
  } = useTranscriptionStore()

  const isDisabled = status === 'processing' || status === 'queued'

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
    </div>
  )
}
