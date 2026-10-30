"use client"

import { useEffect, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { restoreLiteralNewlines } from "@/lib/text-breaks"
import "mathlive/static.css"

type Part = { kind: "text"; text: string } | { kind: "math"; latex: string; display: boolean }

const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([\s\S]+?)\$/g

/** Math mode drops the space that ends a command, so \beta P would draw as βP. */
function readableLatex(latex: string): string {
  return latex.replace(/(\\[A-Za-z]+) +(?=[A-Za-z0-9])/g, "$1\\ ")
}

function isSingleFormula(text: string): boolean {
  const trimmed = text.trim()
  return (
    /^\$\$[\s\S]+\$\$$/.test(trimmed) ||
    /^\$[\s\S]+\$$/.test(trimmed) ||
    /^\\\([\s\S]+\\\)$/.test(trimmed) ||
    /^\\\[[\s\S]+\\\]$/.test(trimmed)
  )
}

function splitMath(text: string): Part[] {
  const src = restoreLiteralNewlines(text)
  const parts: Part[] = []
  let last = 0
  for (const match of src.matchAll(MATH_PATTERN)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ kind: "text", text: src.slice(last, index) })
    const latex = match[1] ?? match[2] ?? match[3] ?? match[4] ?? ""
    const display = Boolean(match[1] || match[2])
    parts.push({ kind: "math", latex: readableLatex(latex), display })
    last = index + match[0].length
  }
  if (last < src.length) parts.push({ kind: "text", text: src.slice(last) })
  if (parts.length === 0) parts.push({ kind: "text", text: src })
  return parts
}

/**
 * Sentence with real typeset math. A formula that is the whole string is set
 * in display style; math inside a sentence stays on the line.
 */
export function MixedMathText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => splitMath(text), [text])
  const displayFormula = isSingleFormula(text)
  const hosts = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    let cancelled = false
    void import("mathlive").then((ml) => {
      if (cancelled) return
      parts.forEach((part, index) => {
        if (part.kind !== "math") return
        const host = hosts.current[index]
        if (!host) return
        try {
          host.innerHTML = ml.convertLatexToMarkup(part.latex, {
            defaultMode: part.display || displayFormula ? "math" : "inline-math",
          })
        } catch {
          host.textContent = part.latex
        }
      })
    })
    return () => {
      cancelled = true
    }
  }, [parts, displayFormula])

  return (
    <div className={cn("whitespace-pre-wrap leading-relaxed text-foreground", className)}>
      {parts.map((part, index) =>
        part.kind === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          <span
            key={index}
            ref={(node) => {
              hosts.current[index] = node
            }}
            className={cn(
              "mx-[0.05em] inline-block align-middle [&_.ML__latex]:align-middle",
              (part.display || displayFormula) && "my-1",
            )}
          />
        ),
      )}
    </div>
  )
}
