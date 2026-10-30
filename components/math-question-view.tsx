"use client"

import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"
import { apiAssetUrl } from "@/lib/public-api"
import type { QuestionMathPayload } from "@/lib/types"
import { QuestionStem } from "@/components/question-stem"

const MathLiveField = dynamic(
  () => import("@/components/math-live-field").then((m) => m.MathLiveField),
  { ssr: false, loading: () => <span className="inline-block h-6 min-w-[4rem] animate-pulse rounded bg-muted" /> },
)

const MixedMathText = dynamic(
  () => import("@/components/mixed-math-text").then((m) => m.MixedMathText),
  {
    ssr: false,
    loading: () => <span className="inline-block h-6 min-w-[8rem] animate-pulse rounded bg-muted" />,
  },
)

export function hasRenderedMath(s: string | null | undefined): boolean {
  if (!s) return false
  return s.includes("$") || s.includes("\\(") || s.includes("\\[")
}

export function MathQuestionStemView({
  math,
  fallbackText,
  className,
}: {
  math?: QuestionMathPayload | null
  fallbackText: string
  className?: string
}) {
  if (!math) {
    return <QuestionStem text={fallbackText} className={className} />
  }
  const formula = (math.stem_latex || "").trim()
  const wording = (fallbackText || "").trim()
  const showLegacyStem =
    Boolean(formula) && (!wording || !hasRenderedMath(fallbackText))
  return (
    <div className={`space-y-4 ${className ?? ""}`}>
      {wording ? (
        <QuestionStem
          text={fallbackText}
          math
          className="text-lg font-medium leading-relaxed text-foreground"
        />
      ) : null}
      {math.image_urls && math.image_urls.length > 0 ? (
        <div className="flex w-full flex-wrap justify-center gap-4">
          {math.image_urls.map((u) => (
            <img
              key={u}
              src={apiAssetUrl(u)}
              alt=""
              className="mx-auto max-h-80 max-w-full rounded-lg border border-border object-contain shadow-sm sm:max-h-96 md:max-h-[min(32rem,72vh)] md:max-w-[min(100%,48rem)]"
            />
          ))}
        </div>
      ) : null}
      {showLegacyStem ? (
        <MathLiveField
          value={math.stem_latex}
          onChange={() => {}}
          readOnly
          className="rounded-md border border-border/60 bg-muted/20 px-2 py-2 shadow-none [--_text-font-size:1.125rem]"
        />
      ) : null}
    </div>
  )
}

export function MathOptionReadonly({ latex, className }: { latex: string; className?: string }) {
  if (hasRenderedMath(latex)) {
    return (
      <MixedMathText
        text={latex}
        className={cn(
          "min-h-0 flex-1 text-base font-normal leading-snug text-foreground [&_.ML__is-inline]:text-base",
          className,
        )}
      />
    )
  }
  return (
    <MathLiveField
      value={latex}
      onChange={() => {}}
      readOnly
      className={
        className ??
        "min-h-0 flex-1 border-0 bg-transparent px-0 py-0 shadow-none [--_text-font-size:1rem]"
      }
    />
  )
}
