"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Calculator, GripVertical, Grid3x3, X } from "lucide-react"
import { EngineeringCalculator } from "@/components/student/engineering-calculator"
import { PeriodicTableViewer } from "@/components/student/periodic-table-viewer"
type Props = {
  showCalculator: boolean
  showPeriodicTable: boolean
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function TestReferenceTools({ showCalculator, showPeriodicTable }: Props) {
  const [calcOpen, setCalcOpen] = useState(false)
  const [tableOpen, setTableOpen] = useState(false)
  const [pos, setPos] = useState({ x: 24, y: 120 })
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1200
    const h = typeof window !== "undefined" ? window.innerHeight : 800
    setPos({ x: Math.max(16, w - 360), y: Math.max(80, h - 520) })
  }, [])

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button[data-close]")) return
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
      }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    },
    [pos.x, pos.y],
  )

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const panelW = panelRef.current?.offsetWidth ?? 320
    const panelH = panelRef.current?.offsetHeight ?? 420
    const maxX = (typeof window !== "undefined" ? window.innerWidth : 1200) - panelW - 8
    const maxY = (typeof window !== "undefined" ? window.innerHeight : 800) - panelH - 8
    setPos({
      x: clamp(d.originX + (e.clientX - d.startX), 8, maxX),
      y: clamp(d.originY + (e.clientY - d.startY), 8, maxY),
    })
  }, [])

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }, [])

  if (!showCalculator && !showPeriodicTable) return null

  return (
    <>
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {showCalculator && !calcOpen ? (
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-95"
            onClick={() => setCalcOpen(true)}
          >
            <Calculator className="h-4 w-4" />
            Calculator
          </button>
        ) : null}
        {showPeriodicTable ? (
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-md transition hover:bg-muted/80"
            onClick={() => setTableOpen(true)}
          >
            <Grid3x3 className="h-4 w-4 text-primary" />
            Periodic table
          </button>
        ) : null}
      </div>

      {showCalculator && calcOpen ? (
        <div
          ref={panelRef}
          className="fixed z-[60] flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          style={{ left: pos.x, top: pos.y }}
        >
          <div
            className="flex cursor-grab items-center gap-2 bg-primary px-3 py-2 text-primary-foreground active:cursor-grabbing"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            <GripVertical className="h-4 w-4 shrink-0 opacity-80" />
            <Calculator className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-sm font-semibold">Calculator</span>
            <button
              type="button"
              data-close
              className="rounded-md p-1 hover:bg-primary-foreground/15"
              aria-label="Close calculator"
              onClick={() => setCalcOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-3">
            <EngineeringCalculator />
          </div>
        </div>
      ) : null}

      <PeriodicTableViewer open={tableOpen} onOpenChange={setTableOpen} />
    </>
  )
}
