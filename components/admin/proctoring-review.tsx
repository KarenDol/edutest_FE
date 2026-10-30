"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react"
import { Camera, Monitor, Pause, Play } from "lucide-react"
import { apiAssetUrl } from "@/lib/public-api"
import { apiClientJson } from "@/lib/client-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Report = {
  id: string
  type: string
  timecode: string
  filename: string
  description: string | null
  created_at: string
}

type Chunk = {
  id: string
  source: string
  file_name: string
  url: string
  size_bytes: number
  is_final: boolean
  created_at: string
}

type Log = {
  id: string
  filename: string
  start_timecode: string
  logs: string
  created_at: string
}

type Summary = {
  proctoring_version: number
  reports: Report[]
  chunks: Chunk[]
  detection_logs: Log[]
}

type TimedChunk = Chunk & { at: number }

type Marker = {
  at: number
  type: string
  label: string
}

const TYPE_LABEL: Record<string, string> = {
  lose_focus: "Потеря фокуса (вкладка / окно)",
  no_face: "Лицо не видно",
  more_face: "Несколько лиц",
  camera_permission_revoked: "Камера отключена",
  screen_permission_revoked: "Демонстрация экрана остановлена",
  media_permission: "Отказ в доступе к медиа",
}

export function ProctoringReview({ submissionId }: { submissionId: string }) {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [seekTo, setSeekTo] = useState<number | null>(null)
  const [playhead, setPlayhead] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiClientJson<Summary>(`/submissions/${submissionId}/proctoring/summary`)
        if (!cancelled) setData(res)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить прокторинг")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [submissionId])

  const face = useMemo(() => (data ? parseFaceSamples(data.detection_logs) : emptyFace()), [data])
  const { camera, screen, estimateSec } = useMemo(
    () => splitSources(data?.chunks ?? []),
    [data],
  )
  const markers = useMemo(() => (data ? toMarkers(data.reports) : []), [data])
  const duration = Math.max(face.samples.length, estimateSec, ...markers.map((m) => m.at + 1), 1)
  const focusCount = data?.reports.filter((r) => r.type === "lose_focus").length ?? 0

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">Загрузка прокторинга…</p>
  }
  if (data.proctoring_version <= 0 && data.reports.length === 0 && data.chunks.length === 0) {
    return null
  }

  const mode =
    data.proctoring_version === 3
      ? "Камера + экран + ИИ"
      : data.proctoring_version === 1
        ? "Камера + экран"
        : "Выкл"

  const reports = [...data.reports].sort((a, b) => {
    if (a.type === "lose_focus" && b.type !== "lose_focus") return -1
    if (b.type === "lose_focus" && a.type !== "lose_focus") return 1
    return (parseTimecode(a.timecode) ?? 0) - (parseTimecode(b.timecode) ?? 0)
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Прокторинг</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{mode}</Badge>
            <Badge variant={focusCount ? "destructive" : "secondary"}>
              {focusCount
                ? `Потеря фокуса: ${focusCount}`
                : "Потери фокуса не было"}
            </Badge>
            <Badge variant={data.reports.length ? "destructive" : "secondary"}>
              {data.reports.length
                ? `${data.reports.length} ${plural(data.reports.length, "событие", "события", "событий")}`
                : "Нарушений нет"}
            </Badge>
            {face.samples.length > 0 && (
              <Badge variant="secondary">Лицо видно {face.visiblePct}%</Badge>
            )}
            {duration > 1 && <Badge variant="outline">{formatClock(duration)}</Badge>}
          </div>

          {reports.length > 0 && (
            <ul className="divide-y divide-border rounded-xl border">
              {reports.map((r) => {
                const sec = parseTimecode(r.timecode)
                const isFocus = r.type === "lose_focus"
                return (
                  <li
                    key={r.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-4 py-3 text-sm",
                      isFocus && "bg-red-50 dark:bg-red-950/30",
                    )}
                  >
                    <span className="w-16 shrink-0 font-mono text-muted-foreground">
                      {r.timecode || "—"}
                    </span>
                    <span className={cn("min-w-0 flex-1 font-medium", isFocus && "text-red-700 dark:text-red-400")}>
                      {TYPE_LABEL[r.type] || r.type}
                    </span>
                    {sec != null && (camera.length > 0 || screen.length > 0) && (
                      <Button variant="outline" size="sm" onClick={() => setSeekTo(sec)}>
                        Смотреть
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {(camera.length > 0 || screen.length > 0) && (
        <RecordingPlayer
          camera={camera}
          screen={screen}
          markers={markers}
          estimateSec={duration}
          seekTo={seekTo}
          onTime={setPlayhead}
        />
      )}

      {face.samples.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Лицо по секундам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Зелёный — лицо в кадре, красный — не видно, жёлтый — несколько лиц. Нажмите, чтобы
              перейти к этому моменту в записи.
            </p>
            <FaceTimeline samples={face.samples} onSeek={setSeekTo} playhead={playhead} />
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Лицо
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Нет лица ({face.missingSec} сек)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Несколько лиц ({face.multiSec} сек)
              </span>
            </div>
            {face.gaps.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Пропуски</p>
                <ul className="flex flex-wrap gap-2">
                  {face.gaps.map((g) => (
                    <button
                      key={`${g.start}-${g.end}`}
                      type="button"
                      className="rounded-full border bg-background px-3 py-1 text-xs hover:bg-muted"
                      onClick={() => setSeekTo(g.start)}
                    >
                      {formatClock(g.start)}–{formatClock(g.end)} · {g.end - g.start + 1} сек
                      {g.kind === "multi" ? " (несколько лиц)" : ""}
                    </button>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RecordingPlayer({
  camera,
  screen,
  markers,
  estimateSec,
  seekTo,
  onTime,
}: {
  camera: TimedChunk[]
  screen: TimedChunk[]
  markers: Marker[]
  estimateSec: number
  seekTo: number | null
  onTime?: (sec: number) => void
}) {
  const camRef = useRef<HTMLVideoElement>(null)
  const scrRef = useRef<HTMLVideoElement>(null)
  const camMedia = useStitchedMedia(camera, true)
  const scrMedia = useStitchedMedia(screen, false)
  const [playing, setPlaying] = useState(false)
  const [clock, setClock] = useState(0)
  const [mediaDuration, setMediaDuration] = useState(0)
  const duration = Math.max(estimateSec, mediaDuration, 1)

  function syncDuration() {
    setMediaDuration(
      Math.max(finiteDuration(camRef.current), finiteDuration(scrRef.current)),
    )
  }

  useEffect(() => {
    if (seekTo == null) return
    jumpBoth(camRef.current, scrRef.current, seekTo)
    setClock(seekTo)
    onTime?.(seekTo)
  }, [seekTo, camMedia.url, scrMedia.url])

  function togglePlay() {
    const next = !playing
    setPlaying(next)
    if (next) {
      void camRef.current?.play().catch(() => undefined)
      void scrRef.current?.play().catch(() => undefined)
    } else {
      camRef.current?.pause()
      scrRef.current?.pause()
    }
  }

  function onTimeUpdate() {
    const t = camRef.current?.currentTime ?? scrRef.current?.currentTime ?? 0
    setClock(t)
    onTime?.(t)
    const other = camRef.current ? scrRef.current : null
    if (other && Math.abs(other.currentTime - t) > 0.6) {
      other.currentTime = t
    }
  }

  function onSeek(sec: number) {
    jumpBoth(camRef.current, scrRef.current, sec)
    setClock(sec)
    onTime?.(sec)
  }

  const loading = (camera.length > 0 && !camMedia.url) || (screen.length > 0 && !scrMedia.url)
  const fail = camMedia.error || scrMedia.error

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Запись</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fail && <p className="text-sm text-destructive">{fail}</p>}
        {loading && (
          <p className="text-sm text-muted-foreground">Сборка записи из фрагментов…</p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <StitchedPane
            refEl={camRef}
            label="Камера"
            icon={<Camera className="h-3.5 w-3.5" />}
            url={camMedia.url}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={syncDuration}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            mirror
          />
          <StitchedPane
            refEl={scrRef}
            label="Экран"
            icon={<Monitor className="h-3.5 w-3.5" />}
            url={scrMedia.url}
            onLoadedMetadata={syncDuration}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button size="icon-sm" onClick={togglePlay} disabled={loading}>
            {playing ? <Pause /> : <Play />}
          </Button>
          <span className="font-mono text-sm tabular-nums">
            {formatClock(clock)} / {formatClock(duration)}
          </span>
        </div>

        <div className="relative pt-4">
          <input
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            step={0.1}
            value={Math.min(clock, duration)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full"
            disabled={loading}
          />
          {markers.map((m) => (
            <button
              key={`${m.type}-${m.at}`}
              type="button"
              title={`${formatClock(m.at)} — ${m.label}`}
              className={cn(
                "absolute top-0 h-3 w-1.5 -translate-x-1/2 rounded-sm",
                m.type === "lose_focus" ? "bg-red-600" : "bg-amber-500",
              )}
              style={{ left: `${(m.at / duration) * 100}%` }}
              onClick={() => onSeek(m.at)}
            />
          ))}
        </div>
        {markers.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Красные метки на шкале — потеря фокуса. Нажмите метку или «Смотреть» в списке событий.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function StitchedPane({
  refEl,
  label,
  icon,
  url,
  onTimeUpdate,
  onLoadedMetadata,
  onPlay,
  onPause,
  mirror = false,
}: {
  refEl: RefObject<HTMLVideoElement | null>
  label: string
  icon: ReactNode
  url: string | null
  onTimeUpdate?: () => void
  onLoadedMetadata?: () => void
  onPlay?: () => void
  onPause?: () => void
  mirror?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
      </p>
      {url ? (
        <video
          ref={refEl}
          className={cn(
            "aspect-video w-full rounded-xl bg-black",
            mirror && "[transform:scaleX(-1)]",
          )}
          src={url}
          preload="auto"
          playsInline
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          onDurationChange={onLoadedMetadata}
          onPlay={onPlay}
          onPause={onPause}
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
          Нет записи
        </div>
      )}
    </div>
  )
}

function FaceTimeline({
  samples,
  onSeek,
  playhead,
}: {
  samples: number[]
  onSeek: (sec: number) => void
  playhead?: number
}) {
  const len = Math.max(samples.length, 1)
  return (
    <div className="relative">
      <div
        className="flex h-10 w-full overflow-hidden rounded-lg border bg-muted"
        role="img"
        aria-label="Шкала наличия лица"
      >
        {samples.map((v, i) => (
          <button
            key={i}
            type="button"
            title={`${formatClock(i)} — ${v === 0 ? "лицо не видно" : v === 1 ? "лицо видно" : `${v} лиц`}`}
            className={cn(
              "h-full min-w-px flex-1",
              v === 0 ? "bg-red-500" : v === 1 ? "bg-emerald-500" : "bg-amber-500",
            )}
            onClick={() => onSeek(i)}
          />
        ))}
      </div>
      {playhead != null && (
        <div
          className="pointer-events-none absolute top-0 h-10 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
          style={{ left: `${Math.min(100, Math.max(0, (playhead / len) * 100))}%` }}
        />
      )}
    </div>
  )
}

function useStitchedMedia(chunks: TimedChunk[], withAudio: boolean) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = chunks.map((c) => c.id).join(",")

  useEffect(() => {
    if (!chunks.length) {
      setUrl(null)
      setError(null)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    let mediaSource: MediaSource | null = null

    ;(async () => {
      const ordered = [...chunks].sort((a, b) => a.at - b.at)
      const buffers: ArrayBuffer[] = []
      for (const c of ordered) {
        const res = await fetch(apiAssetUrl(c.url))
        if (!res.ok) throw new Error("Не удалось скачать фрагмент записи")
        buffers.push(await res.arrayBuffer())
      }
      if (cancelled) return

      const initCount = buffers.filter(isEbml).length
      const mimes = withAudio
        ? ['video/webm; codecs="vp8,opus"', 'video/webm; codecs="vp8"', "video/webm"]
        : ['video/webm; codecs="vp8"', "video/webm"]
      const mime =
        typeof MediaSource !== "undefined"
          ? mimes.find((m) => MediaSource.isTypeSupported(m))
          : undefined

      if (mime && initCount <= 1 && buffers.length > 1) {
        mediaSource = new MediaSource()
        objectUrl = URL.createObjectURL(mediaSource)
        setUrl(objectUrl)
        mediaSource.addEventListener(
          "sourceopen",
          async () => {
            try {
              const sb = mediaSource!.addSourceBuffer(mime)
              sb.mode = "sequence"
              for (const buf of buffers) {
                if (cancelled || mediaSource!.readyState !== "open") return
                sb.appendBuffer(buf)
                await waitSourceBuffer(sb)
              }
              if (mediaSource!.readyState === "open") mediaSource!.endOfStream()
            } catch {
              if (cancelled) return
              const blobUrl = URL.createObjectURL(new Blob(buffers, { type: "video/webm" }))
              if (objectUrl) URL.revokeObjectURL(objectUrl)
              objectUrl = blobUrl
              setUrl(blobUrl)
            }
          },
          { once: true },
        )
        return
      }

      objectUrl = URL.createObjectURL(new Blob(buffers, { type: "video/webm" }))
      if (!cancelled) {
        setUrl(objectUrl)
        setError(null)
      }
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка записи")
    })

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      try {
        if (mediaSource && mediaSource.readyState === "open") mediaSource.endOfStream()
      } catch {
        /* ignore */
      }
    }
  }, [key, withAudio])

  return { url, error }
}

function isEbml(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf)
  return u.length >= 4 && u[0] === 0x1a && u[1] === 0x45 && u[2] === 0xdf && u[3] === 0xa3
}

function waitSourceBuffer(sb: SourceBuffer): Promise<void> {
  if (!sb.updating) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const onEnd = () => {
      sb.removeEventListener("updateend", onEnd)
      sb.removeEventListener("error", onErr)
      resolve()
    }
    const onErr = () => {
      sb.removeEventListener("updateend", onEnd)
      sb.removeEventListener("error", onErr)
      reject(new Error("sourcebuffer"))
    }
    sb.addEventListener("updateend", onEnd)
    sb.addEventListener("error", onErr)
  })
}

function jumpBoth(a: HTMLVideoElement | null, b: HTMLVideoElement | null, sec: number) {
  for (const v of [a, b]) {
    if (!v) continue
    const max = Number.isFinite(v.duration) && v.duration > 0 ? v.duration - 0.05 : sec
    v.currentTime = Math.max(0, Math.min(sec, max))
  }
}

function finiteDuration(v: HTMLVideoElement | null): number {
  if (!v) return 0
  return Number.isFinite(v.duration) ? v.duration : 0
}

function splitSources(chunks: Chunk[]) {
  const timed = chunks.map((c) => ({ ...c, at: chunkOffset(c) }))
  const minAt = timed.length ? Math.min(...timed.map((c) => c.at)) : 0
  const camera = timed
    .filter((c) => c.source === "web-camera")
    .map((c) => ({ ...c, at: c.at - minAt }))
    .sort((a, b) => a.at - b.at)
  const screen = timed
    .filter((c) => c.source === "screen")
    .map((c) => ({ ...c, at: c.at - minAt }))
    .sort((a, b) => a.at - b.at)
  const last = Math.max(camera.at(-1)?.at ?? 0, screen.at(-1)?.at ?? 0)
  const estimateSec = last > 0 ? last + 30 : Math.max(camera.length, screen.length) * 30
  return { camera, screen, estimateSec }
}

function chunkOffset(c: Chunk): number {
  const m = c.file_name.match(/_(\d+)\.webm$/i)
  if (m) return Number(m[1])
  const t = Date.parse(c.created_at)
  return Number.isFinite(t) ? Math.round(t / 1000) : 0
}

function toMarkers(reports: Report[]): Marker[] {
  return reports
    .map((r) => {
      const at = parseTimecode(r.timecode)
      if (at == null) return null
      return { at, type: r.type, label: TYPE_LABEL[r.type] || r.type }
    })
    .filter((m): m is Marker => m != null)
}

function parseTimecode(value: string): number | null {
  if (!value) return null
  const parts = value.split(":").map((p) => Number(p))
  if (parts.some((n) => Number.isNaN(n))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 1) return parts[0]
  return null
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":")
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

type FaceGap = { start: number; end: number; kind: "none" | "multi" }

function emptyFace() {
  return { samples: [] as number[], visiblePct: 0, missingSec: 0, multiSec: 0, gaps: [] as FaceGap[] }
}

function parseFaceSamples(logs: Log[]) {
  if (!logs.length) return emptyFace()
  const ordered = [...logs].sort((a, b) => {
    const ta = parseTimecode(a.start_timecode) ?? 0
    const tb = parseTimecode(b.start_timecode) ?? 0
    return ta - tb
  })
  const maxEnd = Math.max(
    ...ordered.map((l) => {
      const end = parseTimecode(l.start_timecode) ?? l.logs.length
      return Math.max(end, l.logs.length)
    }),
    0,
  )
  const samples = Array.from({ length: maxEnd }, () => -1)
  for (const log of ordered) {
    const end = parseTimecode(log.start_timecode) ?? log.logs.length
    const start = Math.max(0, end - log.logs.length)
    for (let i = 0; i < log.logs.length; i++) {
      const n = Number(log.logs[i])
      if (!Number.isNaN(n)) samples[start + i] = n
    }
  }
  const known = samples.map((v) => (v < 0 ? 0 : v))
  const missingSec = known.filter((v) => v === 0).length
  const multiSec = known.filter((v) => v > 1).length
  const visible = known.filter((v) => v === 1).length
  const visiblePct = known.length ? Math.round((visible / known.length) * 100) : 0
  return { samples: known, visiblePct, missingSec, multiSec, gaps: collectGaps(known) }
}

function collectGaps(samples: number[]): FaceGap[] {
  const gaps: FaceGap[] = []
  let i = 0
  while (i < samples.length) {
    if (samples[i] === 1) {
      i += 1
      continue
    }
    const kind: FaceGap["kind"] = samples[i] > 1 ? "multi" : "none"
    const start = i
    while (i < samples.length && (kind === "multi" ? samples[i] > 1 : samples[i] === 0)) i += 1
    gaps.push({ start, end: i - 1, kind })
  }
  return gaps.filter((g) => g.end - g.start >= 2)
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}
