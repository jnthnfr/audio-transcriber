import { create } from 'zustand'
import type {
  JobStatus,
  TranscriptionBackend,
  WhisperModel,
  ChunkResult,
  HealthResponse,
} from '../types'

interface TranscriptionState {
  // File
  file: File | null
  setFile: (file: File | null) => void

  // Config
  backend: TranscriptionBackend
  chunkDuration: number
  language: string
  whisperModel: WhisperModel
  diarize: boolean
  trimStartSeconds: number
  trimEndSeconds: number | null
  setBackend: (b: TranscriptionBackend) => void
  setChunkDuration: (d: number) => void
  setLanguage: (l: string) => void
  setWhisperModel: (m: WhisperModel) => void
  setDiarize: (d: boolean) => void
  setTrimStartSeconds: (s: number) => void
  setTrimEndSeconds: (s: number | null) => void

  // Job lifecycle
  jobId: string | null
  status: JobStatus | null
  completedChunks: number
  totalChunks: number
  progressPercent: number
  currentChunkLabel: string | null
  errorMessage: string | null
  uploadProgress: number

  // Results
  chunks: ChunkResult[]
  transcript: string
  durationSeconds: number
  resultBackend: string
  resultModel: string | null
  resultDiarized: boolean
  resultDiarizationEngine: string | null

  // Health
  health: HealthResponse | null
  setHealth: (h: HealthResponse) => void

  // Actions
  setJobId: (id: string | null) => void
  setJobStatus: (
    status: JobStatus,
    completed: number,
    total: number,
    percent: number,
    label: string | null,
    error: string | null,
  ) => void
  setResult: (
    transcript: string,
    chunks: ChunkResult[],
    duration: number,
    backend: string,
    model: string | null,
    diarized: boolean,
    diarizationEngine: string | null,
  ) => void
  setUploadProgress: (pct: number) => void
  setTranscript: (t: string) => void
  resetJob: () => void
  reset: () => void
}

const jobDefaults = {
  jobId: null,
  status: null,
  completedChunks: 0,
  totalChunks: 0,
  progressPercent: 0,
  currentChunkLabel: null,
  errorMessage: null,
  uploadProgress: 0,
  chunks: [],
  transcript: '',
  durationSeconds: 0,
  resultBackend: '',
  resultModel: null,
  resultDiarized: false,
  resultDiarizationEngine: null,
}

const defaults = {
  file: null,
  backend: 'whisper_local' as TranscriptionBackend,
  chunkDuration: 60,
  language: 'auto',
  whisperModel: 'base' as WhisperModel,
  diarize: false,
  trimStartSeconds: 0,
  trimEndSeconds: null,
  jobId: null,
  status: null,
  completedChunks: 0,
  totalChunks: 0,
  progressPercent: 0,
  currentChunkLabel: null,
  errorMessage: null,
  uploadProgress: 0,
  chunks: [],
  transcript: '',
  durationSeconds: 0,
  resultBackend: '',
  resultModel: null,
  resultDiarized: false,
  resultDiarizationEngine: null,
  health: null,
}

export const useTranscriptionStore = create<TranscriptionState>((set) => ({
  ...defaults,

  setFile: (file) => set({ file }),
  setBackend: (backend) => set({ backend }),
  setChunkDuration: (chunkDuration) => set({ chunkDuration }),
  setLanguage: (language) => set({ language }),
  setWhisperModel: (whisperModel) => set({ whisperModel }),
  setDiarize: (diarize) => set({ diarize }),
  setTrimStartSeconds: (trimStartSeconds) => set({ trimStartSeconds }),
  setTrimEndSeconds: (trimEndSeconds) => set({ trimEndSeconds }),
  setHealth: (health) => set({ health }),
  setJobId: (jobId) => set({ jobId }),
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
  setTranscript: (transcript) => set({ transcript }),

  setJobStatus: (status, completedChunks, totalChunks, progressPercent, currentChunkLabel, errorMessage) =>
    set({ status, completedChunks, totalChunks, progressPercent, currentChunkLabel, errorMessage }),

  setResult: (transcript, chunks, durationSeconds, resultBackend, resultModel, resultDiarized, resultDiarizationEngine) =>
    set({ transcript, chunks, durationSeconds, resultBackend, resultModel, resultDiarized, resultDiarizationEngine }),

  resetJob: () => set({ ...jobDefaults }),
  reset: () => set({ ...defaults }),
}))
