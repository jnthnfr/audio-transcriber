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
// In production, VITE_API_BASE_URL points at the deployed backend (e.g. https://audio-transcriber-api.onrender.com).
const baseURL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : '/api'

const api = axios.create({ baseURL })

export const fetchHealth = async (): Promise<HealthResponse> => {
  const { data } = await api.get<HealthResponse>('/health')
  return data
}

export const startTranscription = async (
  file: File,
  backend: TranscriptionBackend,
  chunkDuration: number,
  language: string,
  whisperModel: WhisperModel,
  diarize: boolean,
  onUploadProgress?: (pct: number) => void,
): Promise<TranscribeResponse> => {
  const form = new FormData()
  form.append('file', file)
  form.append('backend', backend)
  form.append('chunk_duration', String(chunkDuration))
  form.append('language', language)
  form.append('whisper_model', whisperModel)
  form.append('diarize', String(diarize))

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
