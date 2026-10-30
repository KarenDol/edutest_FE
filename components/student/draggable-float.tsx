"use client"

import { useEffect, useRef, type ReactNode } from "react"

const MARGIN = 12

type Props = {
  enabled: boolean
  children: ReactNode
  className?: string
}

export function DraggableFloat({ enabled, children, className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ offsetX: number; offsetY: number; pointerId: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    el.style.left = `${MARGIN}px`
    el.style.top = `${MARGIN}px`
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const onResize = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.max(MARGIN, Math.min(window.innerWidth - rect.width - MARGIN, rect.left))
      const y = Math.max(MARGIN, Math.min(window.innerHeight - rect.height - MARGIN, rect.top))
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [enabled])

  if (!enabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        position: "fixed",
        left: MARGIN,
        top: MARGIN,
        zIndex: 50,
        width: 220,
        cursor: "grab",
        touchAction: "none",
        userSelect: "none",
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return
        const el = ref.current
        if (!el) return
        e.preventDefault()
        const rect = el.getBoundingClientRect()
        drag.current = {
          offsetX: e.clientX - rect.left,
          offsetY: e.clientY - rect.top,
          pointerId: e.pointerId,
        }
        el.setPointerCapture(e.pointerId)
        el.style.transition = "none"
        el.style.cursor = "grabbing"
      }}
      onPointerMove={(e) => {
        const d = drag.current
        const el = ref.current
        if (!d || d.pointerId !== e.pointerId || !el) return
        const w = el.offsetWidth
        const h = el.offsetHeight
        const x = Math.max(0, Math.min(window.innerWidth - w, e.clientX - d.offsetX))
        const y = Math.max(0, Math.min(window.innerHeight - h, e.clientY - d.offsetY))
        el.style.left = `${x}px`
        el.style.top = `${y}px`
      }}
      onPointerUp={(e) => {
        const d = drag.current
        const el = ref.current
        if (!d || d.pointerId !== e.pointerId || !el) return
        drag.current = null
        try {
          el.releasePointerCapture(e.pointerId)
        } catch {
          /* already released */
        }
        el.style.cursor = "grab"
        const rect = el.getBoundingClientRect()
        const snapLeft =
          rect.left + rect.width / 2 < window.innerWidth / 2
            ? MARGIN
            : window.innerWidth - rect.width - MARGIN
        const snapTop =
          rect.top + rect.height / 2 < window.innerHeight / 2
            ? MARGIN
            : window.innerHeight - rect.height - MARGIN
        el.style.transition = "left 0.25s ease, top 0.25s ease"
        el.style.left = `${snapLeft}px`
        el.style.top = `${snapTop}px`
      }}
      onPointerCancel={() => {
        const el = ref.current
        drag.current = null
        if (el) el.style.cursor = "grab"
      }}
    >
      {children}
    </div>
  )
}
