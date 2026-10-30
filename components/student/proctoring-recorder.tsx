"use client"

import { useEffect, useRef, useState } from "react"
import {
  formatTimecode,
  loadFaceApi,
  PROCTORING_REPORT,
  queueChunk,
  flushChunkQueue,
  sendDetectionLog,
  sendProctoringReport,
  type ProctoringSource,
} from "@/lib/proctoring"

type AccessStatus = 0 | 1 | 2

type Props = {
  source: ProctoringSource
  aiEnabled: boolean
  uploadingEnabled: boolean
  submissionId: string | null
  onAccess: (status: AccessStatus) => void
  onAiFaceCount?: (count: number) => void
  onHint?: (message: string | null) => void
}

export function ProctoringRecorder({
  source,
  aiEnabled,
  uploadingEnabled,
  submissionId,
  onAccess,
  onAiFaceCount,
  onHint,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileIdRef = useRef(Math.random().toString(16).slice(2))
  const startedAtRef = useRef(Date.now())
  const detectTimerRef = useRef(0)
  const logBufRef = useRef("")
  const logTickRef = useRef(0)
  const submissionIdRef = useRef(submissionId)
  const uploadingRef = useRef(uploadingEnabled)
  const [live, setLive] = useState(false)
  const [permissionRevoked, setPermissionRevoked] = useState(false)

  useEffect(() => {
    submissionIdRef.current = submissionId
    if (submissionId && uploadingEnabled) {
      void flushChunkQueue(submissionId)
    }
  }, [submissionId, uploadingEnabled])

  useEffect(() => {
    uploadingRef.current = uploadingEnabled
  }, [uploadingEnabled])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await requireStream(source, onHint)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            setPermissionRevoked(true)
            onAiFaceCount?.(source === "web-camera" ? 100 : 200)
            const sid = submissionIdRef.current
            if (sid && uploadingRef.current) {
              void sendProctoringReport(sid, {
                type:
                  source === "web-camera"
                    ? PROCTORING_REPORT.CAMERA_PERMISSION_REVOKED
                    : PROCTORING_REPORT.SCREEN_PERMISSION_REVOKED,
                timecode: formatTimecode(startedAtRef.current),
                filename: `${source}_${fileIdRef.current}.webm`,
              })
            }
          }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        setLive(true)
        onAccess(1)
      } catch (err) {
        const name = err instanceof Error ? err.name : ""
        const message = err instanceof Error ? err.message : String(err)
        const sid = submissionIdRef.current
        if (sid && uploadingRef.current) {
          void sendProctoringReport(sid, {
            type: PROCTORING_REPORT.MEDIA_PERMISSION,
            description: JSON.stringify({ err: { name, message }, src: source }),
            filename: `${source}_${fileIdRef.current}.webm`,
          })
        }
        onAccess(name === "NotAllowedError" ? 0 : 2)
      }
    })()
    return () => {
      cancelled = true
      try {
        recorderRef.current?.stop()
      } catch {
        /* ignore */
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (detectTimerRef.current) window.clearInterval(detectTimerRef.current)
    }
    // Preview stream once on mount. Recording starts separately when the exam begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const stream = streamRef.current
    if (!live || !stream || permissionRevoked) return

    if (!uploadingEnabled) {
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop()
        }
      } catch {
        /* ignore */
      }
      recorderRef.current = null
      flushFaceLog(source, fileIdRef.current, startedAtRef.current, logBufRef, logTickRef, submissionIdRef)
      return
    }

    if (recorderRef.current && recorderRef.current.state === "recording") return

    startedAtRef.current = Date.now()
    logBufRef.current = ""
    logTickRef.current = 0
    const recorder = prepareRecorder(stream, source)
    recorderRef.current = recorder
    recorder.ondataavailable = (ev) => {
      if (!ev.data?.size || !uploadingRef.current) return
      const seconds = Math.floor((Date.now() - startedAtRef.current) / 1000)
      const fileName = `${source}-chunk_${fileIdRef.current}_${seconds}.webm`
      const isFinal = recorder.state === "inactive"
      void (async () => {
        await queueChunk({
          fileName,
          source,
          isFinal,
          blob: ev.data,
          createdAt: Date.now(),
        })
        const sid = submissionIdRef.current
        if (sid) await flushChunkQueue(sid)
      })()
    }
    recorder.start(30_000)

    return () => {
      try {
        if (recorder.state !== "inactive") recorder.stop()
      } catch {
        /* ignore */
      }
      flushFaceLog(source, fileIdRef.current, startedAtRef.current, logBufRef, logTickRef, submissionIdRef)
      if (recorderRef.current === recorder) recorderRef.current = null
    }
  }, [uploadingEnabled, live, permissionRevoked, source])

  useEffect(() => {
    if (!aiEnabled || source !== "web-camera" || !live || permissionRevoked) return
    let stopped = false
    ;(async () => {
      try {
        const faceapi = await loadFaceApi()
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return
        const run = () => {
          if (stopped || permissionRevoked || video.readyState < 2) return
          const displaySize = { width: video.videoWidth || 640, height: video.videoHeight || 480 }
          canvas.width = displaySize.width
          canvas.height = displaySize.height
          faceapi.matchDimensions(canvas, displaySize)
          const opts = new faceapi.TinyFaceDetectorOptions()
          void faceapi.detectAllFaces(video, opts).then((detections) => {
            if (stopped) return
            const resized = faceapi.resizeResults(detections, displaySize)
            const ctx = canvas.getContext("2d")
            ctx?.clearRect(0, 0, canvas.width, canvas.height)
            faceapi.draw.drawDetections(canvas, resized)
            const count = resized.length
            onAiFaceCount?.(count)
            if (!uploadingRef.current) return
            logBufRef.current += String(Math.min(count, 9))
            logTickRef.current += 1
            if (logTickRef.current > 59) {
              const logs = logBufRef.current
              logBufRef.current = ""
              logTickRef.current = 0
              const sid = submissionIdRef.current
              if (sid && logs) {
                void sendDetectionLog(sid, {
                  filename: `${source}_${fileIdRef.current}.webm`,
                  start_timecode: formatTimecode(startedAtRef.current),
                  logs,
                })
              }
            }
          })
        }
        detectTimerRef.current = window.setInterval(run, 1000)
      } catch (err) {
        console.error("[proctoring] face-api init failed", err)
      }
    })()
    return () => {
      stopped = true
      if (detectTimerRef.current) window.clearInterval(detectTimerRef.current)
    }
  }, [aiEnabled, live, permissionRevoked, onAiFaceCount, source])

  return (
    <div
      className={`relative w-[200px] aspect-[16/12] overflow-hidden rounded-2xl bg-black ${
        source === "web-camera" ? "[transform:scaleX(-1)]" : ""
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {live && uploadingEnabled && (
        <span className="absolute bottom-3 right-3 h-4 w-4 animate-pulse rounded-full bg-red-500" />
      )}
    </div>
  )
}

async function requireStream(
  source: ProctoringSource,
  onHint?: (message: string | null) => void,
): Promise<MediaStream> {
  if (source === "web-camera") {
    return navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 24 } },
      audio: true,
    })
  }

  onHint?.("В диалоге Chrome откройте вкладку «Весь экран» и выберите монитор.")
  for (;;) {
    const stream = await navigator.mediaDevices.getDisplayMedia(fullScreenCaptureOptions())
    if (isEntireScreenShare(stream)) {
      onHint?.(null)
      return stream
    }
    stream.getTracks().forEach((t) => t.stop())
    onHint?.(
      "Нужен весь экран, не окно Chrome и не вкладка. Снова нажмите «Поделиться» → «Весь экран».",
    )
  }
}

function fullScreenCaptureOptions(): DisplayMediaStreamOptions {
  return {
    video: {
      frameRate: { ideal: 24, max: 24 },
      width: { ideal: 1920, max: 1920 },
      height: { ideal: 1080, max: 1080 },
      displaySurface: "monitor",
    } as MediaTrackConstraints,
    audio: false,
    preferCurrentTab: false,
    selfBrowserSurface: "exclude",
    surfaceSwitching: "exclude",
    systemAudio: "exclude",
    monitorTypeSurfaces: "include",
  } as DisplayMediaStreamOptions
}

function isEntireScreenShare(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0]
  if (!track) return false
  const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string }
  if (settings.displaySurface === "monitor") return true
  if (settings.displaySurface === "window" || settings.displaySurface === "browser") return false
  const w = settings.width ?? 0
  const h = settings.height ?? 0
  if (!w || !h) return false
  return w >= window.screen.width * 0.9 && h >= window.screen.height * 0.85
}

function prepareRecorder(stream: MediaStream, source: ProctoringSource): MediaRecorder {
  const params: MediaRecorderOptions = {
    videoBitsPerSecond: source === "screen" ? 440_000 : 350_000,
    audioBitsPerSecond: source === "screen" ? 0 : 48_000,
  }
  const mime = 'video/webm; codecs="vp8"'
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
    params.mimeType = mime
  } else if (MediaRecorder.isTypeSupported("video/webm")) {
    params.mimeType = "video/webm"
  }
  return new MediaRecorder(stream, params)
}

function flushFaceLog(
  source: ProctoringSource,
  fileId: string,
  startedAt: number,
  logBufRef: { current: string },
  logTickRef: { current: number },
  submissionIdRef: { current: string | null },
) {
  const logs = logBufRef.current
  logBufRef.current = ""
  logTickRef.current = 0
  const sid = submissionIdRef.current
  if (!sid || !logs) return
  void sendDetectionLog(sid, {
    filename: `${source}_${fileId}.webm`,
    start_timecode: formatTimecode(startedAt),
    logs,
  })
}
