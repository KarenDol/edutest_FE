"use client"

import { useCallback, useMemo, useState } from "react"
import { assignMatchMapping, parseMatchOptions } from "@/lib/match-question"
import { cn } from "@/lib/utils"

type MatchQuestionProps = {
  leftItems: string[]
  rightItems: string[]
  /** Per left slot: index into rightItems, or -1 if empty */
  value: number[]
  onChange: (mapping: number[]) => void
  /** Display order for pool cards (indices into rightItems) */
  rightOrder?: number[]
  disabled?: boolean
}

export function MatchQuestion({
  leftItems,
  rightItems,
  value,
  onChange,
  rightOrder,
  disabled = false,
}: MatchQuestionProps) {
  const sectionCount = leftItems.length
  const mapping = useMemo(() => {
    const m = [...value]
    while (m.length < sectionCount) m.push(-1)
    return m.slice(0, sectionCount)
  }, [value, sectionCount])

  const poolOrder = rightOrder ?? rightItems.map((_, i) => i)

  const usedRightIndices = useMemo(
    () => new Set(mapping.filter((v) => v >= 0)),
    [mapping],
  )

  const cardsInPool = useMemo(
    () => poolOrder.filter((idx) => !usedRightIndices.has(idx)),
    [poolOrder, usedRightIndices],
  )

  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const setSlot = useCallback(
    (leftIndex: number, rightIndex: number | null) => {
      if (rightIndex === null || rightIndex < 0) {
        const next = [...mapping]
        next[leftIndex] = -1
        onChange(next)
        return
      }
      onChange(assignMatchMapping(mapping, leftIndex, rightIndex))
    },
    [mapping, onChange],
  )

  const handleDragStart = (e: React.DragEvent, rightIndex: number) => {
    if (disabled) return
    const id = `right-${rightIndex}`
    setDraggingId(id)
    e.dataTransfer.setData("text/plain", id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverKey(null)
  }

  const handleDropOnSlot = (e: React.DragEvent, leftIndex: number) => {
    e.preventDefault()
    if (disabled) return
    setDragOverKey(null)
    const id = e.dataTransfer.getData("text/plain")
    const match = /^right-(\d+)$/.exec(id)
    if (!match) return
    setSlot(leftIndex, parseInt(match[1], 10))
  }

  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault()
    if (disabled) return
    setDragOverKey(null)
    const id = e.dataTransfer.getData("text/plain")
    const fromSlot = /^slot-(\d+)$/.exec(id)
    if (fromSlot) {
      setSlot(parseInt(fromSlot[1], 10), null)
      return
    }
    const fromRight = /^right-(\d+)$/.exec(id)
    if (!fromRight) return
    const rightIndex = parseInt(fromRight[1], 10)
    const slotIndex = mapping.findIndex((v) => v === rightIndex)
    if (slotIndex >= 0) setSlot(slotIndex, null)
  }

  const allowDrop = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="flex flex-col gap-4">
        {leftItems.map((leftText, leftIndex) => {
          const assigned = mapping[leftIndex]
          const assignedLabel = assigned >= 0 ? rightItems[assigned] : null
          const slotKey = `slot-${leftIndex}`

          return (
            <div
              key={leftIndex}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
            >
              <p className="text-sm font-medium leading-relaxed text-foreground">{leftText}</p>
              <div
                className={cn(
                  "flex min-h-[3.25rem] items-center justify-center rounded-md border-2 border-dashed px-3 py-2 text-sm transition-colors",
                  dragOverKey === slotKey
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground",
                  assignedLabel && "justify-start border-solid border-border bg-background text-foreground",
                )}
                onDragOver={allowDrop}
                onDragEnter={() => !disabled && setDragOverKey(slotKey)}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return
                  setDragOverKey((k) => (k === slotKey ? null : k))
                }}
                onDrop={(e) => handleDropOnSlot(e, leftIndex)}
              >
                {assignedLabel ? (
                  <div
                    draggable={!disabled}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", slotKey)
                      setDraggingId(slotKey)
                    }}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "w-full cursor-grab rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm active:cursor-grabbing",
                      draggingId === slotKey && "opacity-50",
                    )}
                  >
                    {assignedLabel}
                  </div>
                ) : (
                  <span>Drag an answer here</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 self-start rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Answer choices
        </p>
        <div
          className="flex min-h-[12rem] flex-col gap-2"
          onDragOver={allowDrop}
          onDragEnter={() => !disabled && setDragOverKey("pool")}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
            setDragOverKey((k) => (k === "pool" ? null : k))
          }}
          onDrop={handleDropOnPool}
        >
          {cardsInPool.map((rightIndex) => {
            const id = `right-${rightIndex}`
            const label = rightItems[rightIndex] ?? ""
            return (
              <div
                key={rightIndex}
                draggable={!disabled}
                onDragStart={(e) => handleDragStart(e, rightIndex)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "cursor-grab rounded-md border border-border bg-card px-4 py-3 text-sm shadow-sm transition-opacity active:cursor-grabbing",
                  draggingId === id && "opacity-40",
                )}
              >
                {label}
              </div>
            )
          })}
          {cardsInPool.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">All answers placed</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function MatchQuestionFromOptions({
  options,
  value,
  onChange,
  rightOrder,
  disabled,
}: {
  options: unknown
  value: number[]
  onChange: (mapping: number[]) => void
  rightOrder?: number[]
  disabled?: boolean
}) {
  const { left, right } = parseMatchOptions(options)
  if (left.length === 0) {
    return <p className="text-sm text-muted-foreground">This match question has no prompts.</p>
  }
  return (
    <MatchQuestion
      leftItems={left}
      rightItems={right}
      value={value}
      onChange={onChange}
      rightOrder={rightOrder}
      disabled={disabled}
    />
  )
}
