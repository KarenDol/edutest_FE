"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Flag, XCircle, Trophy } from "lucide-react"
import { hasRenderedMath, MathOptionReadonly, MathQuestionStemView } from "@/components/math-question-view"
import { MixedMathText } from "@/components/mixed-math-text"
import { Spinner } from "@/components/ui/spinner"
import { apiClientJson } from "@/lib/client-api"
import { QuestionReportDialog } from "@/components/question-report-dialog"
import type { Question, QuestionReport, Submission, Test, TestQuestion } from "@/lib/types"
import { restoreLiteralNewlines } from "@/lib/text-breaks"
import {
  getMatchMaxPoints,
  isMatchQuestion,
  normalizeMatchAnswers,
  parseMatchCorrectAnswers,
  parseMatchOptions,
  scoreMatchAnswer,
} from "@/lib/match-question"

function DoubleSparkIcon({ className }: { className?: string }) {
  const spark =
    "M12 0C12 6.627 6.627 12 0 12 6.627 12 12 17.373 12 24 12 17.373 17.373 12 24 12 17.373 12 12 6.627 12 0Z"
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" transform="translate(0 4.2) scale(0.72)" d={spark} />
      <path fill="currentColor" transform="translate(14.2 0.2) scale(0.36)" d={spark} />
    </svg>
  )
}

export interface TestWithQuestions extends Test {
  test_questions: (TestQuestion & { questions: Question })[]
}

export type SubmissionDetail = Submission & {
  profiles?: { name: string | null; email: string | null; phone?: string | null } | null
  tests: TestWithQuestions | null
}

type NavStatus = "blank" | "correct" | "wrong"

function gradeQuestion(question: Question, rawAnswer: unknown) {
  let isCorrect = false
  let isPartial = false
  let maxPts = Number(question.points) || 0
  let earnedPts = 0
  let userIndices = toIndices(rawAnswer)
  let correctIndices = toIndices(question.correct_answers)
  let answered = userIndices.length > 0

  if (isMatchQuestion(question)) {
    const { left } = parseMatchOptions(question.options)
    const correct = parseMatchCorrectAnswers(question.correct_answers, left.length)
    const user = normalizeMatchAnswers(rawAnswer, left.length)
    maxPts = getMatchMaxPoints(question)
    earnedPts = scoreMatchAnswer(user, correct, question.points)
    isCorrect = earnedPts >= maxPts && maxPts > 0
    isPartial = earnedPts > 0 && !isCorrect
    userIndices = user
    correctIndices = correct
    answered = user.some((n) => n >= 0)
  } else {
    isCorrect =
      userIndices.length === correctIndices.length &&
      userIndices.length > 0 &&
      userIndices.every((a) => correctIndices.includes(a))
    earnedPts = isCorrect ? maxPts : 0
  }

  const status: NavStatus = !answered ? "blank" : isCorrect ? "correct" : "wrong"
  return { isCorrect, isPartial, maxPts, earnedPts, userIndices, correctIndices, answered, status }
}

export function toIndices(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((a) => (typeof a === "number" ? a : parseInt(String(a), 10)))
    .filter((n) => !Number.isNaN(n))
}

export function SubmissionResultReview({
  submission,
  allowReport = false,
  onReportSubmitted,
}: {
  submission: SubmissionDetail
  allowReport?: boolean
  onReportSubmitted?: () => void
}) {
  const t = useTranslations("SubmissionReview")
  const tReport = useTranslations("QuestionReport")
  const locale = useLocale()
  const [reportTarget, setReportTarget] = useState<{ questionId: string; index: number } | null>(
    null,
  )
  const [explanations, setExplanations] = useState<Record<string, string>>({})
  const [explainErrors, setExplainErrors] = useState<Record<string, string>>({})
  const [explainingId, setExplainingId] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  async function explainQuestion(questionId: string) {
    if (explanations[questionId] || explainingId) return
    setExplainingId(questionId)
    setExplainErrors((prev) => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
    try {
      const res = await apiClientJson<{ explanation: string }>(
        `/submissions/${submission.id}/questions/${questionId}/explain`,
        {
          method: "POST",
          body: JSON.stringify({ locale }),
        },
      )
      setExplanations((prev) => ({ ...prev, [questionId]: res.explanation }))
    } catch {
      setExplainErrors((prev) => ({ ...prev, [questionId]: t("explainFailed") }))
    } finally {
      setExplainingId(null)
    }
  }

  const reportsByQuestion = useMemo(() => {
    const map = new Map<string, QuestionReport>()
    for (const r of submission.question_reports ?? []) {
      map.set(r.question_id, r)
    }
    return map
  }, [submission.question_reports])

  if (!submission.tests) return null

  const answersRaw = submission.answers as Record<string, unknown>
  const ordered = submission.tests.test_questions
    .slice()
    .sort((a, b) => a.question_order - b.question_order)
  const questions = ordered.map((tq) => tq.questions)
  const graded = questions.map((question) => gradeQuestion(question, answersRaw[question.id]))
  const safeIndex = Math.min(currentIndex, Math.max(questions.length - 1, 0))
  const sectionGroups = (() => {
    const sections = submission.tests.test_sections ?? []
    if (sections.length === 0) {
      return [{ id: "all", name: "", indices: questions.map((_, i) => i) }]
    }
    const groups = sections
      .slice()
      .sort((a, b) => a.section_order - b.section_order)
      .map((sec) => ({
        id: sec.id,
        name: sec.name,
        indices: ordered
          .map((tq, i) => (tq.section_id === sec.id ? i : -1))
          .filter((i) => i >= 0),
      }))
      .filter((g) => g.indices.length > 0)
    const placed = new Set(groups.flatMap((g) => g.indices))
    const rest = questions.map((_, i) => i).filter((i) => !placed.has(i))
    if (rest.length) groups.push({ id: "rest", name: "", indices: rest })
    return groups
  })()

  const percentage = Number(submission.percentage)

  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-6 md:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <div className="text-3xl font-bold text-foreground">{percentage.toFixed(1)}%</div>
              <p className="text-sm text-muted-foreground">{t("finalScore")}</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">
                {submission.total_score}/{submission.max_score}
              </div>
              <p className="text-sm text-muted-foreground">{t("pointsEarned")}</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">{questions.length}</div>
              <p className="text-sm text-muted-foreground">{t("totalQuestions")}</p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">
                {submission.submitted_at && submission.started_at
                  ? Math.round(
                      (new Date(submission.submitted_at).getTime() -
                        new Date(submission.started_at).getTime()) /
                        60000,
                    )
                  : 0}{" "}
                {t("timeUnitMin")}
              </div>
              <p className="text-sm text-muted-foreground">{t("timeTaken")}</p>
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("performance")}</span>
              <Badge
                variant={
                  percentage >= 70 ? "default" : percentage >= 50 ? "secondary" : "destructive"
                }
              >
                {percentage >= 70 ? t("bandPassed") : percentage >= 50 ? t("bandAverage") : t("bandNeedsWork")}
              </Badge>
            </div>
            <Progress value={percentage} className="h-3" />
          </div>
        </CardContent>
      </Card>

      <div className="flex min-h-[32rem] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-md">
        <div className="min-w-0 flex-1 overflow-y-auto p-6">
          {(() => {
            const index = safeIndex
            const question = questions[index]
            if (!question) return null
            const existingReport = reportsByQuestion.get(question.id)
            let isCorrect = false
            let isPartial = false
            let maxPts = Number(question.points) || 0
            let earnedPts = 0
            let userIndices = toIndices(answersRaw[question.id])
            let correctIndices = toIndices(question.correct_answers)

            if (isMatchQuestion(question)) {
              const { left, right } = parseMatchOptions(question.options)
              const correct = parseMatchCorrectAnswers(question.correct_answers, left.length)
              const user = normalizeMatchAnswers(answersRaw[question.id], left.length)
              maxPts = getMatchMaxPoints(question)
              earnedPts = scoreMatchAnswer(user, correct, question.points)
              isCorrect = earnedPts >= maxPts && maxPts > 0
              isPartial = earnedPts > 0 && !isCorrect
              userIndices = user
              correctIndices = correct
            } else {
              userIndices = toIndices(answersRaw[question.id])
              correctIndices = toIndices(question.correct_answers)
              isCorrect =
                userIndices.length === correctIndices.length &&
                userIndices.every((a) => correctIndices.includes(a))
              earnedPts = isCorrect ? maxPts : 0
            }

            const borderClass = isCorrect
              ? "border-emerald-500/35 bg-emerald-50/90 dark:border-emerald-500/30 dark:bg-emerald-950/25"
              : isPartial
                ? "border-amber-500/40 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/25"
                : "border-destructive/50 bg-destructive/5 dark:bg-destructive/10"

            return (
              <div key={question.id} className={`rounded-lg border p-4 ${borderClass}`}>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      isCorrect
                        ? "bg-emerald-600 text-white dark:bg-emerald-500"
                        : isPartial
                          ? "bg-amber-500 text-white"
                          : "bg-destructive text-destructive-foreground"
                    }`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isPartial ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        {t("questionN", { n: index + 1 })}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs font-semibold tabular-nums ${
                          isCorrect
                            ? "border-emerald-600/50 bg-emerald-100/80 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100"
                            : "border-destructive/40 bg-destructive/10 text-destructive dark:text-destructive"
                        }`}
                      >
                        {t("questionPoints", { earned: earnedPts, max: maxPts })}
                      </Badge>
                      {existingReport && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Flag className="h-3 w-3" />
                          {t("reported")}
                        </Badge>
                      )}
                    </div>
                    <div className="mb-3 font-medium text-foreground">
                      <MathQuestionStemView math={question.math} fallbackText={question.question_text} />
                    </div>

                    <div className="space-y-2">
                      {isMatchQuestion(question) ? (
                        (() => {
                          const { left, right } = parseMatchOptions(question.options)
                          return left.map((prompt, leftIndex) => {
                            const expected = correctIndices[leftIndex]
                            const got = userIndices[leftIndex]
                            const pairCorrect =
                              Number.isInteger(got) && got >= 0 && got === expected
                            return (
                              <div
                                key={leftIndex}
                                className={`rounded-md border p-3 text-sm ${
                                  pairCorrect
                                    ? "border-emerald-500 bg-emerald-100/90 dark:border-emerald-600 dark:bg-emerald-950/50"
                                    : "border-destructive/50 bg-destructive/10 dark:bg-destructive/15"
                                }`}
                              >
                                <p className="mb-2 font-medium text-foreground">{prompt}</p>
                                <div className="flex flex-wrap gap-2 text-sm">
                                  <Badge variant="secondary">
                                    {t("yourAnswer")}:{" "}
                                    {got >= 0 ? right[got] ?? "—" : "—"}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="border-emerald-600/50 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                                  >
                                    {t("correctAnswer")}: {right[expected] ?? "—"}
                                  </Badge>
                                </div>
                              </div>
                            )
                          })
                        })()
                      ) : (
                        (Array.isArray(question.options) ? question.options : []).map(
                          (option, optIndex) => {
                            const isSelected = userIndices.includes(optIndex)
                            const isCorrectOption = correctIndices.includes(optIndex)
                            const optLatex = question.math?.options_latex?.[optIndex]

                            return (
                              <div
                                key={optIndex}
                                className={`rounded-md p-3 text-sm ${
                                  isCorrectOption
                                    ? "border border-emerald-500 bg-emerald-100/90 text-foreground dark:border-emerald-600 dark:bg-emerald-950/50"
                                    : isSelected
                                      ? "border border-destructive bg-destructive/20 text-foreground dark:bg-destructive/25"
                                      : "bg-muted/50 text-muted-foreground"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isCorrectOption && (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                                  )}
                                  {isSelected && !isCorrectOption && (
                                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                                  )}
                                  {question.math && hasRenderedMath(optLatex ?? option) ? (
                                    <MathOptionReadonly latex={optLatex ?? option} />
                                  ) : (
                                    <span className="whitespace-pre-wrap">{restoreLiteralNewlines(option)}</span>
                                  )}
                                  {isSelected && (
                                    <Badge variant="secondary" className="ml-auto text-xs">
                                      {t("yourAnswer")}
                                    </Badge>
                                  )}
                                  {isCorrectOption && !isSelected && (
                                    <Badge
                                      variant="outline"
                                      className="ml-auto border-emerald-600/50 bg-emerald-50 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100"
                                    >
                                      {t("correctAnswer")}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )
                          },
                        )
                      )}
                    </div>

                    {existingReport && !allowReport && (
                      <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-50/80 px-3 py-2 text-sm dark:bg-amber-950/30">
                        <div className="flex gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
                          <div>
                            <p className="font-medium text-amber-900 dark:text-amber-100">
                              {tReport(`reasons.${existingReport.reason}`)}
                            </p>
                            {existingReport.comment && (
                              <p className="mt-1 text-muted-foreground">{existingReport.comment}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {submission.submitted_at && (
                      <div className="mt-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={Boolean(explanations[question.id]) || explainingId === question.id}
                            onClick={() => void explainQuestion(question.id)}
                          >
                            {explainingId === question.id ? (
                              <Spinner className="size-4" />
                            ) : (
                              <DoubleSparkIcon className="size-5" />
                            )}
                            {explainingId === question.id ? t("explaining") : t("explainProblem")}
                          </Button>
                          {allowReport &&
                            (existingReport ? (
                              <p className="text-sm text-muted-foreground">{t("reportAlreadySent")}</p>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() =>
                                  setReportTarget({ questionId: question.id, index: index + 1 })
                                }
                              >
                                <Flag className="h-4 w-4" />
                                {t("reportProblem")}
                              </Button>
                            ))}
                        </div>
                        {explainErrors[question.id] && (
                          <p className="text-sm text-destructive">{explainErrors[question.id]}</p>
                        )}
                        {explanations[question.id] && (
                          <div className="rounded-md border border-amber-500/40 bg-amber-50/80 px-3 py-2 text-sm dark:bg-amber-950/30">
                            <p className="mb-1 font-medium text-amber-950 dark:text-amber-100">
                              {t("explanationTitle")}
                            </p>
                            <MixedMathText
                              text={explanations[question.id]}
                              className="whitespace-pre-wrap leading-relaxed text-foreground"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="mt-6 flex items-center justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentIndex(Math.max(0, safeIndex - 1))}
                        disabled={safeIndex <= 0}
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        {t("prev")}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setCurrentIndex(Math.min(questions.length - 1, safeIndex + 1))}
                        disabled={safeIndex >= questions.length - 1}
                      >
                        {t("next")}
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
        <aside className="w-72 shrink-0 overflow-y-auto border-l bg-card p-4">
          <h3 className="mb-3 font-semibold">{t("navTitle")}</h3>
          <div className="mb-4 space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-muted" />
              {t("navBlank")}
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-emerald-600" />
              {t("navCorrect")}
            </p>
            <p className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-destructive" />
              {t("navWrong")}
            </p>
          </div>
          <div className="space-y-4">
            {sectionGroups.map((group) => (
              <div key={group.id}>
                {group.name && (
                  <p className="mb-2 text-xs font-medium text-muted-foreground">{group.name}</p>
                )}
                <div className="grid grid-cols-5 gap-2">
                  {group.indices.map((index) => {
                    const status = graded[index]?.status ?? "blank"
                    const isCurrent = index === safeIndex
                    return (
                      <button
                        key={questions[index].id}
                        type="button"
                        onClick={() => setCurrentIndex(index)}
                        className={`relative h-10 w-10 rounded-lg text-sm font-medium transition-colors ${
                          status === "correct"
                            ? "bg-emerald-600 text-white"
                            : status === "wrong"
                              ? "bg-destructive text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                        } ${isCurrent ? "ring-2 ring-foreground ring-offset-2" : ""}`}
                      >
                        {index + 1}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {reportTarget && (
        <QuestionReportDialog
          open={Boolean(reportTarget)}
          onOpenChange={(open) => !open && setReportTarget(null)}
          submissionId={submission.id}
          questionId={reportTarget.questionId}
          questionNumber={reportTarget.index}
          onSuccess={() => onReportSubmitted?.()}
        />
      )}
    </div>
  )
}
