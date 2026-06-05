import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  duration: number
  start: number
  end: number | null  // null = end of file
  onChange: (start: number, end: number | null) => void
  onPreviewSeek?: (seconds: number) => void
  disabled?: boolean
}

const MIN_DISTANCE = 0.1  // seconds — keep handles from overlapping

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1).padStart(4, '0')
  return `${m}:${sec}`
}

export function TrimSlider({ duration, start, end, onChange, onPreviewSeek, disabled }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null)

  const effectiveEnd = end ?? duration
  const startPct = (start / duration) * 100
  const endPct = (effectiveEnd / duration) * 100

  const pctToSeconds = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return 0
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return pct * duration
    },
    [duration],
  )

  useEffect(() => {
    if (!dragging) return

    const move = (e: PointerEvent) => {
      const sec = pctToSeconds(e.clientX)
      if (dragging === 'start') {
        const newStart = Math.max(0, Math.min(sec, effectiveEnd - MIN_DISTANCE))
        onChange(newStart, end)
        onPreviewSeek?.(newStart)
      } else {
        const newEnd = Math.min(duration, Math.max(sec, start + MIN_DISTANCE))
        // Treat dragging to the very end as "no end limit"
        onChange(start, newEnd >= duration - 0.05 ? null : newEnd)
        onPreviewSeek?.(newEnd)
      }
    }
    const up = () => setDragging(null)

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, pctToSeconds, start, end, effectiveEnd, duration, onChange, onPreviewSeek])

  const handleKey = (which: 'start' | 'end') => (e: React.KeyboardEvent) => {
    let delta = 0
    if (e.key === 'ArrowLeft') delta = -0.1
    if (e.key === 'ArrowRight') delta = 0.1
    if (delta === 0) return
    if (e.shiftKey) delta *= 10
    e.preventDefault()

    if (which === 'start') {
      const ns = Math.max(0, Math.min(effectiveEnd - MIN_DISTANCE, start + delta))
      onChange(ns, end)
      onPreviewSeek?.(ns)
    } else {
      const ne = Math.min(duration, Math.max(start + MIN_DISTANCE, effectiveEnd + delta))
      onChange(start, ne >= duration - 0.05 ? null : ne)
      onPreviewSeek?.(ne)
    }
  }

  const beginDrag = (which: 'start' | 'end') => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return
    e.preventDefault()
    e.currentTarget.focus()
    setDragging(which)
  }

  return (
    <div className={`trim-slider ${disabled ? 'disabled' : ''}`} aria-disabled={disabled}>
      <div ref={trackRef} className="trim-track">
        <div
          className="trim-selected"
          style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
        />
        <button
          type="button"
          className={`trim-handle trim-handle-start ${dragging === 'start' ? 'active' : ''}`}
          style={{ left: `${startPct}%` }}
          onPointerDown={beginDrag('start')}
          onKeyDown={handleKey('start')}
          disabled={disabled}
          aria-label={`Trim start, currently ${formatTime(start)}`}
          aria-valuemin={0}
          aria-valuemax={effectiveEnd}
          aria-valuenow={start}
          role="slider"
        />
        <button
          type="button"
          className={`trim-handle trim-handle-end ${dragging === 'end' ? 'active' : ''}`}
          style={{ left: `${endPct}%` }}
          onPointerDown={beginDrag('end')}
          onKeyDown={handleKey('end')}
          disabled={disabled}
          aria-label={`Trim end, currently ${formatTime(effectiveEnd)}`}
          aria-valuemin={start}
          aria-valuemax={duration}
          aria-valuenow={effectiveEnd}
          role="slider"
        />
      </div>
      <div className="trim-times">
        <span><strong>Start</strong> {formatTime(start)}</span>
        <span>
          <strong>End</strong> {end === null ? `${formatTime(duration)} (end of file)` : formatTime(end)}
        </span>
      </div>
    </div>
  )
}
