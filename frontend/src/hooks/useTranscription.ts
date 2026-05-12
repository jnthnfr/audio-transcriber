import { useCallback } from 'react'
import { startTranscription, deleteJob } from '../api/transcriptionApi'
import { useTranscriptionStore } from '../store/transcriptionStore'

export function useTranscription() {
  const start = useCallback(async () => {
    const s = useTranscriptionStore.getState()
    const file = s.file
    if (!file) return

    // Reset job state only — keep file + config selections
    s.resetJob()
    s.setJobStatus('queued', 0, 0, 0, null, null)

    try {
      const res = await startTranscription(
        file,
        s.backend,
        s.chunkDuration,
        s.language,
        s.whisperModel,
        s.diarize,
        (pct) => useTranscriptionStore.getState().setUploadProgress(pct),
      )
      const next = useTranscriptionStore.getState()
      next.setJobId(res.job_id)
      next.setJobStatus('queued', 0, res.total_chunks, 0, null, null)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Upload failed'
      useTranscriptionStore.getState().setJobStatus('error', 0, 0, 0, null, msg)
    }
  }, [])

  const clear = useCallback(async () => {
    const { jobId, resetJob } = useTranscriptionStore.getState()
    if (jobId) {
      try {
        await deleteJob(jobId)
      } catch {
        // best-effort cleanup
      }
    }
    resetJob()
  }, [])

  return { start, clear }
}
