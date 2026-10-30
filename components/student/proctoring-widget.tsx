"use client"

import { useState } from "react"
import { ProctoringRecorder } from "@/components/student/proctoring-recorder"
import type { ProctoringSource } from "@/lib/proctoring"

type AccessStatus = 0 | 1 | 2

type Props = {
  version: number
  submissionId: string | null
  uploadingEnabled: boolean
  compact?: boolean
  onAccess: (source: ProctoringSource, status: AccessStatus) => void
  onAiFaceCount?: (count: number) => void
  onScreenHint?: (message: string | null) => void
}

export function ProctoringWidget({
  version,
  submissionId,
  uploadingEnabled,
  compact = false,
  onAccess,
  onAiFaceCount,
  onScreenHint,
}: Props) {
  const [hideCamera, setHideCamera] = useState(false)
  const [hideScreen, setHideScreen] = useState(false)
  const ai = version === 3

  function handleAccess(source: ProctoringSource, status: AccessStatus) {
    if (source === "screen" && status === 2) setHideScreen(true)
    if (source === "web-camera" && status !== 1) setHideCamera(true)
    onAccess(source, status)
  }

  return (
    <div className={compact ? "flex flex-col items-center gap-3" : "flex flex-wrap items-start justify-center gap-4"}>
      {!hideCamera && (
        <div>
          <p className="mb-1 text-center text-xs text-muted-foreground">Камера</p>
          <ProctoringRecorder
            source="web-camera"
            aiEnabled={ai}
            uploadingEnabled={uploadingEnabled}
            submissionId={submissionId}
            onAccess={(s) => handleAccess("web-camera", s)}
            onAiFaceCount={onAiFaceCount}
          />
        </div>
      )}
      {!hideScreen && (
        <div>
          <p className="mb-1 text-center text-xs text-muted-foreground">Экран</p>
          <ProctoringRecorder
            source="screen"
            aiEnabled={false}
            uploadingEnabled={uploadingEnabled}
            submissionId={submissionId}
            onAccess={(s) => handleAccess("screen", s)}
            onHint={onScreenHint}
          />
        </div>
      )}
    </div>
  )
}
