export type JobStatus = 'queued' | 'processing' | 'done' | 'error'

export type TranscriptionBackend =
  | 'whisper_local'
  | 'whisper_api'
  | 'google_cloud'
  | 'web_speech'

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large'

export interface HealthResponse {
  status: string
  ffmpeg_available: boolean
  whisper_local: boolean
  whisper_api: boolean
  google_cloud: boolean
  web_speech: boolean
  diarization: boolean
}

export interface TranscribeResponse {
  job_id: string
  total_chunks: number
  status: JobStatus
}

export interface StatusResponse {
  job_id: string
  status: JobStatus
  completed_chunks: number
  total_chunks: number
  current_chunk_label: string | null
  error_message: string | null
  progress_percent: number
}

export interface ChunkResult {
  index: number
  label: string
  text: string
  start_seconds: number
  end_seconds: number
  speaker: string | null
}

export interface ResultResponse {
  job_id: string
  status: JobStatus
  transcript: string
  chunks: ChunkResult[]
  duration_seconds: number
  backend: string
  model: string | null
  diarized: boolean
  diarization_engine: string | null
}

export interface TranscriptionConfig {
  backend: TranscriptionBackend
  chunkDuration: number
  language: string
  whisperModel: WhisperModel
  diarize: boolean
}
