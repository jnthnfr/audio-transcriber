import axios from 'axios'
import type {
  HealthResponse,
  TranscribeResponse,
  StatusResponse,
  ResultResponse,
  TranscriptionBackend,
  WhisperModel,
} from '../types'

// In dev, the Vite proxy forwards /api → http://localhost:8000.
// In production, VITE_API_BASE_URL points at the deployed backend.
const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : '/api'

const api = axios.create({ baseURL })

export interface StartTranscriptionParams {
  file: File
  backend: TranscriptionBackend
  chunkDuration: number
  language: string
  whisperModel: WhisperModel
  diarize: boolean
  trimStartSeconds: number
  trimEndSeconds: number | null
}

export const fetchHealth = async (): Promise<HealthResponse> => {
  const { data } = await api.get<HealthResponse>('/health')
  return data
}

export const startTranscription = async (
  params: StartTranscriptionParams,
  onUploadProgress?: (pct: number) => void,
): Promise<TranscribeResponse> => {
  const form = new FormData()
  form.append('file', params.file)
  form.append('backend', params.backend)
  form.append('chunk_duration', String(params.chunkDuration))
  form.append('language', params.language)
  form.append('whisper_model', params.whisperModel)
  form.append('diarize', String(params.diarize))
  form.append('trim_start_seconds', String(params.trimStartSeconds))
  if (params.trimEndSeconds != null) {
    form.append('trim_end_seconds', String(params.trimEndSeconds))
  }

  const { data } = await api.post<TranscribeResponse>('/transcribe', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) {
        onUploadProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
  return data
}

export const fetchStatus = async (jobId: string): Promise<StatusResponse> => {
  const { data } = await api.get<StatusResponse>(`/status/${jobId}`)
  return data
}

export const fetchResult = async (jobId: string): Promise<ResultResponse> => {
  const { data } = await api.get<ResultResponse>(`/result/${jobId}`)
  return data
}

export const deleteJob = async (jobId: string): Promise<void> => {
  await api.delete(`/job/${jobId}`)
}
