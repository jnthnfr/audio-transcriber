import { useEffect, useRef } from 'react'
import { fetchStatus, fetchResult, deleteJob } from '../api/transcriptionApi'
import { useTranscriptionStore } from '../store/transcriptionStore'

export function usePolling() {
  const { jobId, status, setJobStatus, setResult } = useTranscriptionStore()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId || status === 'done' || status === 'error') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const poll = async () => {
      try {
        const s = await fetchStatus(jobId)
        setJobStatus(
          s.status,
          s.completed_chunks,
          s.total_chunks,
          s.progress_percent,
          s.current_chunk_label,
          s.error_message,
        )

        if (s.status === 'done') {
          const result = await fetchResult(jobId)
          setResult(
            result.transcript,
            result.chunks,
            result.duration_seconds,
            result.backend,
            result.model,
            result.diarized,
            result.diarization_engine,
          )
          clearInterval(intervalRef.current!)
          intervalRef.current = null
        } else if (s.status === 'error') {
          clearInterval(intervalRef.current!)
          intervalRef.current = null
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }

    intervalRef.current = setInterval(poll, 2000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [jobId, status])
}
