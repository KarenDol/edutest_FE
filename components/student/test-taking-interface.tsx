"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "@/i18n/navigation"
import { apiClientJson } from "@/lib/client-api"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Clock, ChevronLeft, ChevronRight, Flag } from "lucide-react"
import type { Question, Test, Submission, TestSection } from "@/lib/types"
import { restoreLiteralNewlines } from "@/lib/text-breaks"
import { hasRenderedMath, MathOptionReadonly, MathQuestionStemView } from "@/components/math-question-view"
import { TestReferenceTools } from "@/components/student/test-reference-tools"
import { seededOptionIndices } from "@/lib/seeded-shuffle"
import {
  getMatchMaxPoints,
  isMatchAnswerComplete,
  isMatchQuestion,
  normalizeMatchAnswers,
  parseMatchCorrectAnswers,
  parseMatchOptions,
  scoreMatchAnswer,
} from "@/lib/match-question"
import { MatchQuestionFromOptions } from "@/components/student/match-question"
import { ProctoringWidget } from "@/components/student/proctoring-widget"
import { DraggableFloat } from "@/components/student/draggable-float"
import {
  formatTimecode,
  flushChunkQueue,
  PROCTORING_REPORT,
  sendProctoringReport,
  type ProctoringSource,
} from "@/lib/proctoring"

type QuestionWithSection = Question & { section_id?: string | null }

interface SectionRuntime {
  id: string
  name: string
  duration_minutes: number
  questionIndices: number[]
}

interface TestTakingInterfaceProps {
  test: Test & {
    questions: QuestionWithSection[]
    test_sections?: TestSection[]
    subjects: { name: string } | null
  }
  existingSubmission: Submission | null
}

function buildSectionRuntimes(
  questions: QuestionWithSection[],
  testSections: TestSection[] | undefined,
  durationMinutes: number | null,
): SectionRuntime[] {
  if (testSections && testSections.length > 0) {
    const sorted = [...testSections].sort((a, b) => a.section_order - b.section_order)
    return sorted.map((sec) => ({
      id: sec.id,
      name: sec.name,
      duration_minutes: sec.duration_minutes,
      questionIndices: questions
        .map((q, i) => ({ q, i }))
        .filter(({ q }) => q.section_id === sec.id)
        .map(({ i }) => i),
    }))
  }
  return [
    {
      id: "default",
      name: "Тест",
      duration_minutes: durationMinutes || 60,
      questionIndices: questions.map((_, i) => i),
    },
  ]
}

function normalizeAnswers(raw: Record<string, unknown> | undefined): Record<string, number[]> {
  if (!raw) return {}
  const out: Record<string, number[]> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v)) {
      out[k] = v.map((x) => (typeof x === "number" ? x : parseInt(String(x), 10))).filter((n) => !Number.isNaN(n))
    }
  }
  return out
}

export function TestTakingInterface({
  test,
  existingSubmission,
}: TestTakingInterfaceProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number[]>>(
    normalizeAnswers(existingSubmission?.answers as Record<string, unknown> | undefined),
  )
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set())
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionId, setSubmissionId] = useState<string | null>(existingSubmission?.id || null)
  const router = useRouter()
  const submittedRef = useRef(false)
  const startedAtRef = useRef(Date.now())
  const proctoringVersion = test.proctoring_version ?? 0
  const [cameraOk, setCameraOk] = useState(proctoringVersion === 0)
  const [screenOk, setScreenOk] = useState(proctoringVersion === 0)
  const [examUnlocked, setExamUnlocked] = useState(proctoringVersion === 0)
  const [aiStatus, setAiStatus] = useState<number | null>(null)
  const [lostFocus, setLostFocus] = useState(false)
  const [screenHint, setScreenHint] = useState<string | null>(null)

  const questions = test.questions
  const sections = useMemo(
    () => buildSectionRuntimes(questions, test.test_sections, test.duration_minutes),
    [questions, test.test_sections, test.duration_minutes],
  )

  const initialSectionIndex = useMemo(() => {
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].questionIndices.length > 0) return i
    }
    return 0
  }, [sections])

  const [currentSectionIndex, setCurrentSectionIndex] = useState(initialSectionIndex)
  const [sectionTimesRemaining, setSectionTimesRemaining] = useState(() =>
    sections.map((s) => s.duration_minutes * 60),
  )
  const [expiredSectionIndices, setExpiredSectionIndices] = useState<Set<number>>(new Set())

  const currentSection = sections[currentSectionIndex] ?? sections[0]
  const currentQuestion = questions[currentQuestionIndex]
  const sectionTimeRemaining = sectionTimesRemaining[currentSectionIndex] ?? 0
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100
  const hasMultipleSections = sections.length > 1

  const optionOrder = useMemo(() => {
    const q = currentQuestion
    if (isMatchQuestion(q)) {
      const { right } = parseMatchOptions(q.options)
      const n = right.length
      if (!(test.shuffle_answer_options ?? false)) {
        return Array.from({ length: n }, (_, i) => i)
      }
      return seededOptionIndices(`${test.id}:${q.id}:match-right`, n)
    }
    const flat = Array.isArray(q.options) ? q.options : []
    const n = flat.length
    if (!(test.shuffle_answer_options ?? false)) {
      return Array.from({ length: n }, (_, i) => i)
    }
    return seededOptionIndices(`${test.id}:${q.id}`, n)
  }, [test.id, currentQuestion, test.shuffle_answer_options])

  useEffect(() => {
    const initSubmission = async () => {
      if (!submissionId) {
        try {
          const data = await apiClientJson<Submission>("/submissions", {
            method: "POST",
            body: JSON.stringify({ test_id: test.id }),
          })
          if (data?.id) setSubmissionId(data.id)
        } catch (e) {
          console.error(e)
        }
      }
    }
    initSubmission()
  }, [submissionId, test.id])

  const saveAnswers = useCallback(async () => {
    if (!submissionId) return
    try {
      await apiClientJson(`/submissions/${submissionId}`, {
        method: "PATCH",
        body: JSON.stringify({ answers }),
      })
    } catch (e) {
      console.error(e)
    }
  }, [submissionId, answers])

  useEffect(() => {
    const interval = setInterval(saveAnswers, 30000)
    return () => clearInterval(interval)
  }, [saveAnswers])

  useEffect(() => {
    if (examUnlocked) startedAtRef.current = Date.now()
  }, [examUnlocked])

  useEffect(() => {
    if (proctoringVersion <= 0 || !examUnlocked) return
    let away = false
    let unfocusedSince = 0
    const unfocused = () => document.visibilityState === "hidden" || !document.hasFocus()
    const report = () => {
      if (away) return
      away = true
      setLostFocus(true)
      if (submissionId) {
        void sendProctoringReport(submissionId, {
          type: PROCTORING_REPORT.LOSE_FOCUS,
          timecode: formatTimecode(startedAtRef.current),
          description: document.visibilityState === "hidden" ? "tab_hidden" : "window_unfocused",
        })
      }
    }
    const tick = () => {
      if (unfocused()) {
        if (!unfocusedSince) unfocusedSince = Date.now()
        if (Date.now() - unfocusedSince >= 1500) report()
      } else {
        unfocusedSince = 0
        away = false
        setLostFocus(false)
      }
    }
    const interval = window.setInterval(tick, 400)
    document.addEventListener("visibilitychange", tick)
    window.addEventListener("blur", tick)
    window.addEventListener("focus", tick)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", tick)
      window.removeEventListener("blur", tick)
      window.removeEventListener("focus", tick)
    }
  }, [proctoringVersion, examUnlocked, submissionId])

  const onProctoringAccess = (source: ProctoringSource, status: 0 | 1 | 2) => {
    if (source === "web-camera") setCameraOk(status === 1)
    if (source === "screen") setScreenOk(status === 1)
  }

  const advanceAfterSectionExpired = useCallback(
    (sectionIdx: number) => {
      setExpiredSectionIndices((prev) => new Set(prev).add(sectionIdx))
      const nextIdx = sectionIdx + 1
      if (nextIdx < sections.length && sections[nextIdx].questionIndices.length > 0) {
        setCurrentSectionIndex(nextIdx)
        setCurrentQuestionIndex(sections[nextIdx].questionIndices[0])
        return
      }
      if (!submittedRef.current) {
        setShowSubmitDialog(true)
      }
    },
    [sections],
  )

  useEffect(() => {
    if (!examUnlocked) return
    if (expiredSectionIndices.has(currentSectionIndex)) return

    const timer = setInterval(() => {
      setSectionTimesRemaining((prev) => {
        const next = [...prev]
        const left = next[currentSectionIndex] ?? 0
        if (left <= 1) {
          next[currentSectionIndex] = 0
          advanceAfterSectionExpired(currentSectionIndex)
          return next
        }
        next[currentSectionIndex] = left - 1
        return next
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [currentSectionIndex, expiredSectionIndices, advanceAfterSectionExpired, examUnlocked])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleAnswerSelect = (optionIndex: number) => {
    const questionId = currentQuestion.id
    const currentAnswers = answers[questionId] || []

    if (currentQuestion.question_type === "single_choice") {
      setAnswers({ ...answers, [questionId]: [optionIndex] })
    } else {
      if (currentAnswers.includes(optionIndex)) {
        setAnswers({
          ...answers,
          [questionId]: currentAnswers.filter((i) => i !== optionIndex),
        })
      } else {
        setAnswers({
          ...answers,
          [questionId]: [...currentAnswers, optionIndex],
        })
      }
    }
  }

  const questionSectionIndex = useMemo(() => {
    const map = new Map<number, number>()
    sections.forEach((sec, secIdx) => {
      for (const qi of sec.questionIndices) {
        map.set(qi, secIdx)
      }
    })
    return map
  }, [sections])

  const goToQuestion = (index: number) => {
    const secIdx = questionSectionIndex.get(index) ?? 0
    if (expiredSectionIndices.has(secIdx)) return
    setCurrentSectionIndex(secIdx)
    setCurrentQuestionIndex(index)
  }

  const goNext = () => {
    const indices = currentSection.questionIndices
    const pos = indices.indexOf(currentQuestionIndex)
    if (pos >= 0 && pos < indices.length - 1) {
      setCurrentQuestionIndex(indices[pos + 1])
      return
    }
    const nextSec = currentSectionIndex + 1
    if (nextSec < sections.length && !expiredSectionIndices.has(nextSec)) {
      const first = sections[nextSec].questionIndices[0]
      if (first !== undefined) {
        setCurrentSectionIndex(nextSec)
        setCurrentQuestionIndex(first)
      }
    }
  }

  const goPrev = () => {
    const indices = currentSection.questionIndices
    const pos = indices.indexOf(currentQuestionIndex)
    if (pos > 0) {
      setCurrentQuestionIndex(indices[pos - 1])
      return
    }
    const prevSec = currentSectionIndex - 1
    if (prevSec >= 0 && !expiredSectionIndices.has(prevSec)) {
      const prevIndices = sections[prevSec].questionIndices
      const last = prevIndices[prevIndices.length - 1]
      if (last !== undefined) {
        setCurrentSectionIndex(prevSec)
        setCurrentQuestionIndex(last)
      }
    }
  }

  const canGoPrev =
    currentSection.questionIndices.indexOf(currentQuestionIndex) > 0 ||
    (currentSectionIndex > 0 &&
      !expiredSectionIndices.has(currentSectionIndex - 1))

  const canGoNext =
    (() => {
      const indices = currentSection.questionIndices
      const pos = indices.indexOf(currentQuestionIndex)
      if (pos >= 0 && pos < indices.length - 1) return true
      for (let s = currentSectionIndex + 1; s < sections.length; s++) {
        if (!expiredSectionIndices.has(s) && sections[s].questionIndices.length > 0) {
          return true
        }
      }
      return false
    })()

  const toggleFlag = () => {
    const newFlagged = new Set(flaggedQuestions)
    if (newFlagged.has(currentQuestion.id)) {
      newFlagged.delete(currentQuestion.id)
    } else {
      newFlagged.add(currentQuestion.id)
    }
    setFlaggedQuestions(newFlagged)
  }

  const handleSubmit = async () => {
    if (submittedRef.current || isSubmitting || !submissionId) return
    submittedRef.current = true
    setIsSubmitting(true)

    let totalScore = 0
    const maxScore = questions.reduce(
      (sum, q) => sum + (isMatchQuestion(q) ? getMatchMaxPoints(q) : q.points),
      0,
    )

    questions.forEach((question) => {
      if (isMatchQuestion(question)) {
        const { left } = parseMatchOptions(question.options)
        const correct = parseMatchCorrectAnswers(question.correct_answers, left.length)
        const user = normalizeMatchAnswers(answers[question.id], left.length)
        totalScore += scoreMatchAnswer(user, correct, question.points)
        return
      }

      const userAnswers = answers[question.id] || []
      const correctRaw = question.correct_answers as unknown[]
      const correctAnswers = correctRaw.map((a) =>
        typeof a === "number" ? a : parseInt(String(a), 10),
      )

      const isCorrect =
        userAnswers.length === correctAnswers.length &&
        userAnswers.every((a) => correctAnswers.includes(a))

      if (isCorrect) {
        totalScore += question.points
      }
    })

    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0

    await apiClientJson(`/submissions/${submissionId}`, {
      method: "PATCH",
      body: JSON.stringify({
        answers,
        total_score: totalScore,
        max_score: maxScore,
        percentage,
        submitted_at: new Date().toISOString(),
      }),
    })
    if (proctoringVersion > 0) {
      await flushChunkQueue(submissionId)
    }

    router.push(`/student/results/${submissionId}`)
  }

  const answeredCount = questions.filter((q) => {
    const raw = answers[q.id]
    if (isMatchQuestion(q)) {
      const { left } = parseMatchOptions(q.options)
      return isMatchAnswerComplete(normalizeMatchAnswers(raw, left.length), left.length)
    }
    return raw && raw.length > 0 && raw.some((n) => n >= 0)
  }).length

  const proctoringWidget = proctoringVersion > 0 && (
    <ProctoringWidget
      version={proctoringVersion}
      submissionId={submissionId}
      uploadingEnabled={Boolean(submissionId) && examUnlocked}
      compact={examUnlocked}
      onAccess={onProctoringAccess}
      onScreenHint={setScreenHint}
      onAiFaceCount={proctoringVersion === 3 ? setAiStatus : undefined}
    />
  )

  const canStartProctoring = cameraOk && screenOk

  return (
    <div className="flex flex-col h-screen">
      {proctoringVersion > 0 && (
        <DraggableFloat
          enabled={examUnlocked}
          className={
            examUnlocked
              ? "z-50 w-[220px] space-y-2"
              : "fixed left-1/2 top-[42%] z-50 w-max -translate-x-1/2"
          }
        >
          {proctoringWidget}
          {examUnlocked && (
            <div className="space-y-2">
              {lostFocus && (
                <p className="rounded-lg bg-red-600 px-2.5 py-2 text-xs font-medium leading-snug text-white shadow-lg">
                  Другая вкладка. Вернитесь к тесту.
                </p>
              )}
              {proctoringVersion === 3 && aiStatus === 0 && (
                <p className="rounded-lg bg-red-600 px-2.5 py-2 text-xs font-medium leading-snug text-white shadow-lg">
                  Лицо не видно. Смотрите в камеру.
                </p>
              )}
              {proctoringVersion === 3 && typeof aiStatus === "number" && aiStatus > 1 && aiStatus < 10 && (
                <p className="rounded-lg bg-red-600 px-2.5 py-2 text-xs font-medium leading-snug text-white shadow-lg">
                  Несколько лиц. Вы должны быть одни.
                </p>
              )}
              {proctoringVersion === 3 && aiStatus === 100 && (
                <p className="rounded-lg bg-red-600 px-2.5 py-2 text-xs font-medium leading-snug text-white shadow-lg">
                  Камера отключена. Включите доступ снова.
                </p>
              )}
              {proctoringVersion === 3 && aiStatus === 200 && (
                <p className="rounded-lg bg-red-600 px-2.5 py-2 text-xs font-medium leading-snug text-white shadow-lg">
                  Экран не транслируется. Поделитесь экраном снова.
                </p>
              )}
            </div>
          )}
        </DraggableFloat>
      )}
      {proctoringVersion > 0 && !examUnlocked && (
        <div className="fixed inset-0 z-40 flex flex-col items-center bg-background px-6 pt-16">
          <div className="max-w-xl space-y-4 text-center">
            <h1 className="text-2xl font-bold">{test.title}</h1>
            <p className="text-muted-foreground">
              Для этого теста включён прокторинг. Разрешите камеру и в диалоге демонстрации экрана
              выберите вкладку «Весь экран» (весь монитор), не окно Chrome и не вкладку. Затем
              нажмите «Начать тест». Не закрывайте панель «Этот экран демонстрируется» — иначе
              запись остановится.
            </p>
            <div className="space-y-1 text-sm">
              <p>
                Камера: <b>{cameraOk ? "разрешена" : "нужно разрешить"}</b>
              </p>
              <p>
                Экран:{" "}
                <b>{screenOk ? "весь экран" : "нужно выбрать «Весь экран»"}</b>
              </p>
            </div>
            {screenHint && (
              <p className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white">
                {screenHint}
              </p>
            )}
            <Button disabled={!canStartProctoring} onClick={() => setExamUnlocked(true)}>
              {canStartProctoring ? "Начать тест" : "Ожидание разрешений…"}
            </Button>
          </div>
        </div>
      )}
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">{test.title}</h1>
            {hasMultipleSections ? (
              <Badge variant="secondary" className="mt-1">
                {currentSection.name}
              </Badge>
            ) : (
              test.subjects?.name && (
                <Badge variant="secondary" className="mt-1">
                  {test.subjects.name}
                </Badge>
              )
            )}
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span
                  className={`font-mono text-lg ${sectionTimeRemaining < 300 ? "text-destructive" : ""}`}
                >
                  {formatTime(sectionTimeRemaining)}
                </span>
              </div>
              {hasMultipleSections && (
                <span className="text-xs text-muted-foreground">
                  Секция {currentSectionIndex + 1} из {sections.length}
                </span>
              )}
            </div>
            <Button onClick={() => setShowSubmitDialog(true)}>Submit Test</Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleFlag}
                  className={flaggedQuestions.has(currentQuestion.id) ? "text-warning" : ""}
                >
                  <Flag className="h-4 w-4 mr-1" />
                  {flaggedQuestions.has(currentQuestion.id) ? "Flagged" : "Flag for Review"}
                </Button>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="min-w-0 text-lg font-medium leading-relaxed">
                  <MathQuestionStemView
                    math={currentQuestion.math}
                    fallbackText={currentQuestion.question_text}
                    className="w-full"
                  />
                </CardTitle>
                <CardAction>
                  <Badge variant="outline">
                    {isMatchQuestion(currentQuestion)
                      ? `${getMatchMaxPoints(currentQuestion)} pts`
                      : `${currentQuestion.points} pts`}
                  </Badge>
                </CardAction>
                <p className="text-sm text-muted-foreground">
                  {currentQuestion.question_type === "single_choice"
                    ? "Select one answer"
                    : currentQuestion.question_type === "match"
                      ? "Drag each answer to the matching prompt"
                      : "Select all that apply"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentQuestion.question_type === "match" ? (
                  <MatchQuestionFromOptions
                    options={currentQuestion.options}
                    value={normalizeMatchAnswers(
                      answers[currentQuestion.id],
                      parseMatchOptions(currentQuestion.options).left.length,
                    )}
                    onChange={(mapping) =>
                      setAnswers({ ...answers, [currentQuestion.id]: mapping })
                    }
                    rightOrder={optionOrder}
                  />
                ) : currentQuestion.question_type === "single_choice" ? (
                  <RadioGroup
                    className="space-y-3"
                    value={
                      (answers[currentQuestion.id] || []).length > 0
                        ? String((answers[currentQuestion.id] || [])[0])
                        : ""
                    }
                    onValueChange={(v) =>
                      setAnswers({
                        ...answers,
                        [currentQuestion.id]: [parseInt(v, 10)],
                      })
                    }
                  >
                    {optionOrder.map((index) => {
                      const flatOpts = Array.isArray(currentQuestion.options)
                        ? currentQuestion.options
                        : []
                      const option = restoreLiteralNewlines(flatOpts[index] ?? "")
                      const selected = (answers[currentQuestion.id] || [])[0] === index
                      const optionId = `answer-${currentQuestion.id}-${index}`
                      return (
                        <div
                          key={index}
                          className={`flex w-full items-center gap-3 rounded-lg border p-4 transition-colors ${
                            selected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          }`}
                        >
                          <RadioGroupItem value={String(index)} id={optionId} />
                          <Label
                            htmlFor={optionId}
                            className="min-w-0 flex-1 cursor-pointer whitespace-pre-wrap text-base font-medium leading-relaxed"
                          >
                            {currentQuestion.math &&
                            hasRenderedMath(currentQuestion.math.options_latex[index] ?? option) ? (
                              <MathOptionReadonly
                                latex={currentQuestion.math.options_latex[index] ?? option}
                              />
                            ) : (
                              option
                            )}
                          </Label>
                        </div>
                      )
                    })}
                  </RadioGroup>
                ) : (
                  optionOrder.map((index) => {
                    const flatOpts = Array.isArray(currentQuestion.options)
                      ? currentQuestion.options
                      : []
                    const option = restoreLiteralNewlines(flatOpts[index] ?? "")
                    const isSelected = (answers[currentQuestion.id] || []).includes(index)
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleAnswerSelect(index)}
                        className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox checked={isSelected} />
                        <span className="min-w-0 flex-1 whitespace-pre-wrap text-base font-medium leading-relaxed">
                          {currentQuestion.math &&
                          hasRenderedMath(currentQuestion.math.options_latex[index] ?? option) ? (
                            <MathOptionReadonly
                              latex={currentQuestion.math.options_latex[index] ?? option}
                            />
                          ) : (
                            option
                          )}
                        </span>
                      </button>
                    )
                  })
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between mt-6">
              <Button variant="outline" onClick={goPrev} disabled={!canGoPrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Назад
              </Button>
              <Button onClick={goNext} disabled={!canGoNext}>
                Далее
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>

        <aside className="w-64 border-l bg-card p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Questions</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {answeredCount} of {questions.length} answered
          </p>
          <div className="space-y-4">
            {sections.map((sec, secIdx) => (
              <div key={sec.id}>
                {hasMultipleSections && (
                  <p
                    className={`text-xs font-medium mb-2 ${
                      expiredSectionIndices.has(secIdx)
                        ? "text-muted-foreground line-through"
                        : secIdx === currentSectionIndex
                          ? "text-primary"
                          : "text-muted-foreground"
                    }`}
                  >
                    {sec.name}
                    {expiredSectionIndices.has(secIdx) && " (время вышло)"}
                  </p>
                )}
                <div className="grid grid-cols-5 gap-2">
                  {sec.questionIndices.map((index) => {
                    const q = questions[index]
                    const isAnswered = isMatchQuestion(q)
                      ? isMatchAnswerComplete(
                          normalizeMatchAnswers(
                            answers[q.id],
                            parseMatchOptions(q.options).left.length,
                          ),
                          parseMatchOptions(q.options).left.length,
                        )
                      : answers[q.id] && answers[q.id].length > 0
                    const isFlagged = flaggedQuestions.has(q.id)
                    const isCurrent = index === currentQuestionIndex
                    const isExpired = expiredSectionIndices.has(secIdx)

                    return (
                      <button
                        key={q.id}
                        type="button"
                        disabled={isExpired}
                        onClick={() => goToQuestion(index)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors relative ${
                          isExpired
                            ? "bg-muted/40 text-muted-foreground cursor-not-allowed opacity-50"
                            : isCurrent
                              ? "bg-primary text-primary-foreground"
                              : isAnswered
                                ? "bg-accent text-accent-foreground"
                                : "bg-muted hover:bg-muted/80"
                        }`}
                      >
                        {index + 1}
                        {isFlagged && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-warning rounded-full" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Test?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} of {questions.length} questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-warning">
                  Warning: You have {questions.length - answeredCount} unanswered questions.
                </span>
              )}
              {flaggedQuestions.size > 0 && (
                <span className="block mt-2 text-warning">
                  You have {flaggedQuestions.size} flagged questions for review.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Test</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Test"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TestReferenceTools
        showCalculator={Boolean(test.show_calculator)}
        showPeriodicTable={Boolean(test.show_periodic_table)}
      />
    </div>
  )
}
