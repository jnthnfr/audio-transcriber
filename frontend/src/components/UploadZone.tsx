import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { useTranscriptionStore } from '../store/transcriptionStore'

const ACCEPTED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/flac',
  'audio/webm', 'audio/aac', 'video/webm', 'video/mp4',
]
const ACCEPTED_EXTS = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.webm', '.aac', '.opus', '.wma']

function isValidFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  return ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTS.includes(ext)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UploadZone() {
  const { file, setFile, status } = useTranscriptionStore()
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((f: File) => {
    setError(null)
    if (!isValidFile(f)) {
      setError('Unsupported format. Please use MP3, WAV, M4A, OGG, FLAC, WebM, or AAC.')
      return
    }
    setFile(f)
  }, [setFile])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const isDisabled = status === 'processing' || status === 'queued'

  return (
    <div className="upload-zone-wrapper">
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''} ${isDisabled ? 'disabled' : ''}`}
        onClick={() => !isDisabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); !isDisabled && setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={!isDisabled ? onDrop : undefined}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !isDisabled && inputRef.current?.click()}
        id="upload-zone"
        aria-label="Upload audio file"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTS.join(',')}
          style={{ display: 'none' }}
          onChange={onInputChange}
          id="file-input"
        />

        {file ? (
          <div className="file-info">
            <div className="file-icon">🎵</div>
            <div className="file-details">
              <span className="file-name">{file.name}</span>
              <span className="file-size">{formatFileSize(file.size)}</span>
            </div>
            {!isDisabled && (
              <button
                className="remove-file"
                onClick={(e) => { e.stopPropagation(); setFile(null) }}
                aria-label="Remove file"
              >✕</button>
            )}
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="upload-text">
              <strong>Drop audio file here</strong> or <span className="upload-link">click to browse</span>
            </p>
            <p className="upload-formats">MP3 · WAV · M4A · OGG · FLAC · WebM · AAC · OPUS</p>
          </div>
        )}
      </div>
      {error && <p className="upload-error" role="alert">{error}</p>}
    </div>
  )
}
