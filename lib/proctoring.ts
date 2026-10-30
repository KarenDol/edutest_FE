/** Client helpers for olymp-app-style proctoring (IndexedDB queue + API). */

import { apiClientForm, apiClientJson } from "@/lib/client-api"

export const PROCTORING_REPORT = {
  NO_FACE: "no_face",
  MORE_FACE: "more_face",
  LOSE_FOCUS: "lose_focus",
  CAMERA_PERMISSION_REVOKED: "camera_permission_revoked",
  SCREEN_PERMISSION_REVOKED: "screen_permission_revoked",
  MEDIA_PERMISSION: "media_permission",
} as const

export type ProctoringSource = "web-camera" | "screen"

export type QueuedChunk = {
  fileName: string
  source: ProctoringSource
  isFinal: boolean
  blob: Blob
  createdAt: number
}

const DB_NAME = "edutest-proctoring"
const STORE = "chunks"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "fileName" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueChunk(chunk: QueuedChunk): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(chunk)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function pendingChunks(): Promise<QueuedChunk[]> {
  const db = await openDb()
  const rows = await new Promise<QueuedChunk[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as QueuedChunk[]) || [])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return rows
}

export async function deleteChunk(fileName: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(fileName)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

let uploading = false

export async function flushChunkQueue(submissionId: string): Promise<void> {
  if (!submissionId || uploading || !navigator.onLine) return
  uploading = true
  try {
    let list = await pendingChunks()
    while (list.length) {
      for (const chunk of list) {
        const form = new FormData()
        form.append("source", chunk.source)
        form.append("file_name", chunk.fileName)
        form.append("is_final", chunk.isFinal ? "true" : "false")
        form.append("file", chunk.blob, chunk.fileName)
        await apiClientForm(`/submissions/${submissionId}/proctoring/chunks`, form)
        await deleteChunk(chunk.fileName)
      }
      list = await pendingChunks()
    }
  } catch (err) {
    console.error("[proctoring] chunk upload failed", err)
  } finally {
    uploading = false
  }
}

export async function sendProctoringReport(
  submissionId: string,
  body: { type: string; timecode?: string; filename?: string; description?: string },
): Promise<void> {
  if (!submissionId) return
  await apiClientJson(`/submissions/${submissionId}/proctoring/reports`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function sendDetectionLog(
  submissionId: string,
  body: { filename?: string; start_timecode?: string; logs: string },
): Promise<void> {
  if (!submissionId) return
  await apiClientJson(`/submissions/${submissionId}/proctoring/detection-logs`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export function formatElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":")
}

export function formatTimecode(startedAtMs: number): string {
  return formatElapsed((Date.now() - startedAtMs) / 1000)
}

type FaceApi = {
  nets: { tinyFaceDetector: { loadFromUri: (uri: string) => Promise<unknown> } }
  TinyFaceDetectorOptions: new () => unknown
  matchDimensions: (canvas: HTMLCanvasElement, size: { width: number; height: number }) => void
  detectAllFaces: (video: HTMLVideoElement, opts: unknown) => Promise<unknown[]>
  resizeResults: (dets: unknown[], size: { width: number; height: number }) => unknown[]
  draw: { drawDetections: (canvas: HTMLCanvasElement, dets: unknown[]) => void }
}

export async function loadFaceApi(): Promise<FaceApi> {
  const w = window as unknown as { faceapi?: FaceApi }
  if (w.faceapi?.nets?.tinyFaceDetector) {
    return w.faceapi
  }
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-edutest-faceapi="1"]')
    if (existing) {
      existing.addEventListener("load", () => resolve())
      existing.addEventListener("error", () => reject(new Error("face-api load failed")))
      return
    }
    const script = document.createElement("script")
    script.dataset.edutestFaceapi = "1"
    script.src = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("face-api load failed"))
    document.head.appendChild(script)
  })
  const faceapi = (window as unknown as { faceapi: FaceApi }).faceapi
  await faceapi.nets.tinyFaceDetector.loadFromUri(
    "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights",
  )
  return faceapi
}
