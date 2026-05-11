import { useEffect, useState } from 'react'
import { useTranscriptionStore } from '../store/transcriptionStore'

export function ProgressPanel() {
  const {
    status,
    completedChunks,
    totalChunks,
    progressPercent,
    currentChunkLabel,
    chunks,
    uploadProgress,
    errorMessage,
  } = useTranscriptionStore()

  const [optimisticProgress, setOptimisticProgress] = useState(0)

  // Use an optimistic progress that smoothly increments while waiting for a chunk
  useEffect(() => {
    setOptimisticProgress(progressPercent)

    if (status === 'processing' && progressPercent < 100) {
      const chunkPct = totalChunks > 0 ? 100 / totalChunks : 100
      // Animate up to 95% of the current chunk's progress so it doesn't get completely stuck
      const targetMax = progressPercent + chunkPct * 0.95

      const interval = setInterval(() => {
        setOptimisticProgress((prev) => {
          const diff = targetMax - prev
          if (diff <= 0.1) return prev
          return prev + diff * 0.05 // Asymptotically approach the target
        })
      }, 500)

      return () => clearInterval(interval)
    }
  }, [status, progressPercent, totalChunks])

  if (!status) return null

  return (
    <div className="progress-panel">
      {/* Upload phase */}
      {status === 'queued' && uploadProgress < 100 && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">Uploading…</span>
            <span className="progress-pct">{uploadProgress}%</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill upload" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Transcription phase */}
      {(status === 'queued' || status === 'processing' || status === 'done') && (
        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">
              {status === 'done' ? '✓ Complete' : status === 'queued' ? '⏳ Queued…' : `⟳ Transcribing…`}
            </span>
            <span className="progress-pct">
              {status === 'done' ? 100 : Math.round(optimisticProgress)}% ({completedChunks} / {totalChunks} chunk{totalChunks !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="progress-bar-track">
            <div
              className={`progress-bar-fill transcribe ${status === 'done' ? 'done' : ''}`}
              style={{ width: `${status === 'done' ? 100 : optimisticProgress}%` }}
            />
          </div>
          {currentChunkLabel && (
            <p className="progress-current">Processing: {currentChunkLabel}</p>
          )}
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="progress-error" role="alert">
          <span className="error-icon">⚠</span>
          <span>{errorMessage || 'An error occurred during transcription.'}</span>
        </div>
      )}

      {/* Chunk list */}
      {chunks.length > 0 && (
        <div className="chunk-list">
          {chunks.map((chunk) => (
            <div key={chunk.index} className="chunk-item">
              <span className="chunk-check">✓</span>
              <span className="chunk-label">{chunk.label}</span>
              <span className="chunk-preview">
                {chunk.text.length > 80 ? chunk.text.slice(0, 80) + '…' : chunk.text}
              </span>
            </div>
          ))}
          {status === 'processing' && currentChunkLabel && (
            <div className="chunk-item processing">
              <span className="chunk-spinner">⟳</span>
              <span className="chunk-label">{currentChunkLabel}</span>
              <span className="chunk-preview muted">processing…</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
