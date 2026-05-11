import { useEffect, useState } from 'react'
import { UploadZone } from './components/UploadZone'
import { ConfigPanel } from './components/ConfigPanel'
import { ProgressPanel } from './components/ProgressPanel'
import { TranscriptViewer } from './components/TranscriptViewer'
import { ExportButton } from './components/ExportButton'
import { useTranscription } from './hooks/useTranscription'
import { usePolling } from './hooks/usePolling'
import { useTranscriptionStore } from './store/transcriptionStore'
import { fetchHealth } from './api/transcriptionApi'

export default function App() {
  const { file, status, setHealth, health } = useTranscriptionStore()
  const { start, clear } = useTranscription()
  const [darkMode, setDarkMode] = useState(true)

  // Start polling whenever jobId changes
  usePolling()

  // Load health on mount
  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => {/* backend not running — handled gracefully */})
  }, [setHealth])

  const canStart = !!file && status !== 'processing' && status !== 'queued'
  const isRunning = status === 'processing' || status === 'queued'

  return (
    <div className={`app ${darkMode ? 'dark' : 'light'}`}>
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">🎙</span>
            <span className="logo-text">Audio<span className="logo-accent">Transcriber</span></span>
          </div>
          {health && (
            <div className={`health-indicator ${health.ffmpeg_available ? 'healthy' : 'warning'}`}>
              <span className="health-dot" />
              {health.ffmpeg_available ? 'Backend ready' : 'FFmpeg missing'}
            </div>
          )}
        </div>
        <div className="header-right">
          <button
            id="dark-mode-toggle"
            className="icon-btn"
            onClick={() => setDarkMode((d) => !d)}
            aria-label="Toggle dark mode"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀' : '🌙'}
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="card">
          <UploadZone />
        </div>

        <div className="card">
          <ConfigPanel />
          <div className="action-row">
            {isRunning ? (
              <button id="cancel-btn" className="btn btn-danger" onClick={clear}>
                ✕ Cancel
              </button>
            ) : status === 'done' || status === 'error' ? (
              <button id="reset-btn" className="btn btn-ghost" onClick={clear}>
                ↺ Start Over
              </button>
            ) : null}
            <button
              id="start-btn"
              className="btn btn-primary btn-large"
              onClick={start}
              disabled={!canStart}
            >
              {isRunning ? (
                <><span className="spinner" /> Transcribing…</>
              ) : (
                <>▶ Start Transcription</>
              )}
            </button>
          </div>
        </div>

        <ProgressPanel />
        <TranscriptViewer />
        <ExportButton />
      </main>

      <footer className="app-footer">
        <p>Audio Transcriber · Powered by Whisper, OpenAI &amp; Google Cloud STT</p>
      </footer>
    </div>
  )
}
