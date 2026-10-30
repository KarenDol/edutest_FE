"use client"

import { useCallback, useMemo, useState } from "react"
import { Parser } from "expr-eval"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function formatResult(n: number): string {
  if (!Number.isFinite(n)) return "Undefined"
  if (Math.abs(n) < 1e-15) return "0"
  const s = n.toPrecision(14)
  return s.includes("e") ? n.toExponential(10) : parseFloat(s).toString()
}

function makeParser(): Parser {
  const p = new Parser()
  p.functions.deg = (x: number) => (x * Math.PI) / 180
  return p
}

type PadKey =
  | string
  | { label: string; insert: string }
  | { label: string; action: "clear" | "del" | "eval" }

const SCI_ROWS: PadKey[][] = [
  ["sin(", "cos(", "tan(", "asin(", "acos(", "atan("],
  ["log(", "ln(", "log10(", "sqrt(", "cbrt(", "exp("],
  ["abs(", "sign(", "floor(", "ceil(", "min(", "max("],
  ["PI", "E", "(", ")", "^", "deg("],
]

const MAIN_ROWS: PadKey[][] = [
  ["7", "8", "9", "/", { label: "AC", action: "clear" }],
  ["4", "5", "6", "*", { label: "⌫", action: "del" }],
  ["1", "2", "3", "-", { label: "=", action: "eval" }],
]

const ZERO_ROW: PadKey[] = [".", ",", "+"]

function keyInsert(k: PadKey): string | null {
  if (typeof k === "string") return k
  if ("insert" in k) return k.insert
  return null
}

export function EngineeringCalculator() {
  const [expr, setExpr] = useState("")
  const [error, setError] = useState<string | null>(null)
  const parser = useMemo(() => makeParser(), [])

  const append = useCallback((s: string) => {
    setError(null)
    setExpr((e) => e + s)
  }, [])

  const clear = useCallback(() => {
    setError(null)
    setExpr("")
  }, [])

  const del = useCallback(() => {
    setError(null)
    setExpr((e) => e.slice(0, -1))
  }, [])

  const evalExpr = useCallback(() => {
    const raw = expr.trim()
    if (!raw) return
    try {
      const v = parser.evaluate(raw) as number
      setError(null)
      setExpr(formatResult(v))
    } catch {
      setError("Invalid expression")
    }
  }, [expr, parser])

  const onKey = (k: PadKey) => {
    if (typeof k === "object" && "action" in k) {
      if (k.action === "clear") clear()
      else if (k.action === "del") del()
      else if (k.action === "eval") evalExpr()
      return
    }
    const ins = keyInsert(k)
    if (ins) append(ins)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-md border border-input bg-muted/30 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Type or tap (radians; use deg(·) for degrees, e.g. sin(deg(90)))
        </p>
        <Input
          value={expr}
          onChange={(e) => {
            setError(null)
            setExpr(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              evalExpr()
            }
          }}
          className="font-mono text-right text-base"
          placeholder="e.g. 2*sin(deg(30))"
          autoComplete="off"
          spellCheck={false}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {SCI_ROWS.flat().map((k, i) => (
          <CalcButton key={`s-${i}-${typeof k === "string" ? k : k.label}`} k={k} onKey={onKey} />
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {MAIN_ROWS.flat().map((k, i) => (
          <CalcButton key={`m-${i}-${typeof k === "string" ? k : k.label}`} k={k} onKey={onKey} />
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="col-span-2 h-9 min-w-0 text-xs font-medium"
          onClick={() => append("0")}
        >
          0
        </Button>
        {ZERO_ROW.map((k, i) => (
          <CalcButton key={`z-${i}-${typeof k === "string" ? k : k.label}`} k={k} onKey={onKey} />
        ))}
      </div>
    </div>
  )
}

function CalcButton({ k, onKey }: { k: PadKey; onKey: (k: PadKey) => void }) {
  const label = typeof k === "string" ? k : k.label
  const isEval = typeof k === "object" && "action" in k && k.action === "eval"
  const isClear = typeof k === "object" && "action" in k && k.action === "clear"
  return (
    <Button
      type="button"
      variant={isEval ? "default" : isClear ? "secondary" : "outline"}
      size="sm"
      className="h-9 min-w-0 px-0 text-[11px] font-medium leading-tight sm:text-xs"
      onClick={() => onKey(k)}
    >
      {label}
    </Button>
  )
}
