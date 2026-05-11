import { useTranscriptionStore } from '../store/transcriptionStore'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function TranscriptViewer() {
  const { transcript, status, durationSeconds, resultBackend, resultModel, setTranscript } = useTranscriptionStore()

  if (!transcript && status !== 'processing') return null

  return (
    <div className="transcript-viewer">
      <div className="transcript-header">
        <h2 className="transcript-title">Transcript</h2>
        {durationSeconds > 0 && (
          <div className="transcript-meta">
            <span className="meta-chip">⏱ {formatDuration(durationSeconds)}</span>
            <span className="meta-chip">
              {resultBackend === 'whisper_local' ? `Whisper Local${resultModel ? ` (${resultModel})` : ''}` :
               resultBackend === 'whisper_api' ? 'OpenAI API' :
               resultBackend === 'google_cloud' ? 'Google Cloud STT' : 'Web Speech'}
            </span>
          </div>
        )}
      </div>
      <textarea
        id="transcript-textarea"
        className="transcript-textarea"
        value={transcript}
        readOnly={status !== 'done'}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder={status === 'processing' ? 'Transcript will appear here as chunks complete…' : ''}
        spellCheck={false}
        aria-label="Transcription result"
      />
    </div>
  )
}
