"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { apiClientJson, apiClientUpload, ApiError } from "@/lib/client-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ImagePlus, Plus, X } from "lucide-react"
import { apiAssetUrl } from "@/lib/public-api"
import {
  DEFAULT_QUESTION_DIFFICULTY,
  QUESTION_DIFFICULTY_OPTIONS,
  normalizeQuestionDifficulty,
  type QuestionDifficulty,
} from "@/lib/question-difficulty"
import {
  DEFAULT_QUESTION_LANGUAGE,
  QUESTION_LANGUAGE_OPTIONS,
  normalizeQuestionLanguage,
  type QuestionLanguage,
} from "@/lib/question-languages"
import type { Question, Subject } from "@/lib/types"
import { restoreLiteralNewlines } from "@/lib/text-breaks"
import { FormulaScratchpad } from "@/components/formula-scratchpad"
import {
  assignMatchMapping,
  dedupeMatchMapping,
  isRightIndexAvailableForSlot,
  parseMatchCorrectAnswers,
  parseMatchOptions,
} from "@/lib/match-question"

function FormSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
      <div className="min-w-0 pr-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function emptyDefaults() {
  return {
    useMathMode: false,
    questionText: "",
    questionType: "single_choice" as const,
    subjectId: "",
    options: ["", "", "", ""] as string[],
    correctAnswers: [] as number[],
    points: 1,
    imageUrls: [] as string[],
    language: DEFAULT_QUESTION_LANGUAGE as QuestionLanguage,
    difficulty: DEFAULT_QUESTION_DIFFICULTY as QuestionDifficulty,
  }
}

function storedQuestionUsesMath(q: { question_text?: string; math?: { stem_latex?: string; options_latex?: string[] } | null }) {
  const chunks = [q.question_text, q.math?.stem_latex, ...(q.math?.options_latex ?? [])]
  return chunks.some(
    (part) => typeof part === "string" && (part.includes("$") || part.includes("\\(") || part.includes("\\[")),
  )
}

function stateFromQuestion(q: Question & { subjects: Subject | null }) {
  const ca = q.correct_answers as unknown[]
  if (q.question_type === "match") {
    const { left, right } = parseMatchOptions(q.options)
    return {
      useMathMode: false,
      questionText: restoreLiteralNewlines(q.question_text),
      questionType: "match" as const,
      subjectId: q.subject_id || "",
      options: ["", "", "", ""] as string[],
      correctAnswers: [] as number[],
      matchLeft: left.length > 0 ? left : ["", ""],
      matchRight: right.length > 0 ? right : ["", "", "", ""],
      matchCorrect: dedupeMatchMapping(parseMatchCorrectAnswers(ca, left.length || 2)),
      points: q.points,
      imageUrls: [] as string[],
      language: normalizeQuestionLanguage(q.language),
      difficulty: normalizeQuestionDifficulty(q.difficulty),
    }
  }
  const flatOpts = Array.isArray(q.options) ? q.options : []
  const opts = [...flatOpts, ...Array(4 - flatOpts.length).fill("")]
  const sliced = opts.slice(0, Math.max(4, flatOpts.length)) as string[]
  return {
    useMathMode: storedQuestionUsesMath(q),
    questionText: restoreLiteralNewlines(q.question_text),
    questionType: q.question_type,
    subjectId: q.subject_id || "",
    options: sliced,
    correctAnswers: ca.map((x) => (typeof x === "number" ? x : parseInt(String(x), 10))),
    matchLeft: ["", ""] as string[],
    matchRight: ["", "", "", ""] as string[],
    matchCorrect: [-1, -1] as number[],
    points: q.points,
    imageUrls: q.math?.image_urls ? [...q.math.image_urls] : [],
    language: normalizeQuestionLanguage(q.language),
    difficulty: normalizeQuestionDifficulty(q.difficulty),
  }
}

export type QuestionEditorFormProps = {
  subjects: Subject[]
  /** When set, PATCH existing question; otherwise POST create */
  initialQuestion?: (Question & { subjects: Subject | null }) | null
  onCancel: () => void
  onSuccess: () => void
  /** `split`: main column + right sidebar for type/subject/points (e.g. full new-question page) */
  layout?: "stacked" | "split"
}

export function QuestionEditorForm({
  subjects,
  initialQuestion,
  onCancel,
  onSuccess,
  layout = "stacked",
}: QuestionEditorFormProps) {
  const [questionText, setQuestionText] = useState("")
  const [questionType, setQuestionType] = useState<"single_choice" | "multiple_choice" | "match">(
    "single_choice",
  )
  const [subjectId, setSubjectId] = useState("")
  const [options, setOptions] = useState<string[]>(["", "", "", ""])
  const [correctAnswers, setCorrectAnswers] = useState<number[]>([])
  const [matchLeft, setMatchLeft] = useState<string[]>(["", ""])
  const [matchRight, setMatchRight] = useState<string[]>(["", "", "", ""])
  const [matchCorrect, setMatchCorrect] = useState<number[]>([-1, -1])
  const [points, setPoints] = useState(1)
  const [useMathMode, setUseMathMode] = useState(false)
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [language, setLanguage] = useState<QuestionLanguage>(DEFAULT_QUESTION_LANGUAGE)
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(DEFAULT_QUESTION_DIFFICULTY)
  const [isLoading, setIsLoading] = useState(false)
  const [formError, setFormError] = useState("")
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialQuestion) {
      const s = stateFromQuestion(initialQuestion)
      setUseMathMode(s.useMathMode)
      setQuestionText(s.questionText)
      setQuestionType(s.questionType)
      setSubjectId(s.subjectId)
      setOptions(s.options)
      setCorrectAnswers(s.correctAnswers)
      setMatchLeft(s.matchLeft)
      setMatchRight(s.matchRight)
      setMatchCorrect(s.matchCorrect)
      setPoints(s.points)
      setImageUrls(s.imageUrls)
      setLanguage(s.language)
      setDifficulty(s.difficulty)
    } else {
      const d = emptyDefaults()
      setUseMathMode(d.useMathMode)
      setQuestionText(d.questionText)
      setQuestionType(d.questionType)
      setSubjectId(d.subjectId)
      setOptions(d.options)
      setCorrectAnswers(d.correctAnswers)
      setMatchLeft(["", ""])
      setMatchRight(["", "", "", ""])
      setMatchCorrect([-1, -1])
      setPoints(d.points)
      setImageUrls(d.imageUrls)
      setLanguage(d.language)
      setDifficulty(d.difficulty)
    }
    setFormError("")
  }, [initialQuestion?.id])

  const formValid = useMemo(() => {
    const hasStem = questionText.trim().length > 0
    if (!hasStem || !subjectId.trim()) return false
    if (!Number.isFinite(points) || points < 1) return false

    if (questionType === "match") {
      if (matchLeft.length < 1 || !matchLeft.every((o) => o.trim())) return false
      if (matchRight.length < 2 || !matchRight.every((o) => o.trim())) return false
      if (matchCorrect.length !== matchLeft.length) return false
      if (
        !matchCorrect.every(
          (i) => Number.isInteger(i) && i >= 0 && i < matchRight.length,
        )
      ) {
        return false
      }
      if (new Set(matchCorrect).size !== matchCorrect.length) return false
      return true
    }

    if (options.length < 2 || !options.every((o) => o.trim())) return false
    if (correctAnswers.length === 0) return false
    if (!correctAnswers.every((i) => Number.isInteger(i) && i >= 0 && i < options.length)) return false
    if (questionType === "single_choice" && correctAnswers.length !== 1) return false
    if (questionType === "multiple_choice" && new Set(correctAnswers).size !== correctAnswers.length)
      return false
    return true
  }, [
    questionText,
    subjectId,
    points,
    options,
    correctAnswers,
    questionType,
    matchLeft,
    matchRight,
    matchCorrect,
  ])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formValid) return

    setIsLoading(true)
    setFormError("")
    const optsNormalized = options.map((o) => o.trim())

    try {
      const payload =
        questionType === "match"
          ? {
              question_text: questionText.trim(),
              question_type: "match" as const,
              subject_id: subjectId.trim(),
              options: {
                left: matchLeft.map((o) => o.trim()),
                right: matchRight.map((o) => o.trim()),
              },
              correct_answers: matchCorrect,
              points,
              language,
              difficulty,
              math: null,
            }
          : {
              question_text: questionText.trim(),
              question_type: questionType,
              subject_id: subjectId.trim(),
              options: optsNormalized,
              correct_answers: correctAnswers,
              points,
              language,
              difficulty,
              math: useMathMode || imageUrls.length > 0
                ? {
                    stem_latex: "",
                    options_latex: optsNormalized,
                    image_urls: imageUrls,
                  }
                : null,
            }
      if (initialQuestion) {
        await apiClientJson(`/questions/${initialQuestion.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      } else {
        await apiClientJson("/questions", {
          method: "POST",
          body: JSON.stringify(payload),
        })
      }
      onSuccess()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not save question")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleCorrectAnswer = (index: number) => {
    if (questionType === "single_choice") {
      setCorrectAnswers([index])
    } else {
      setCorrectAnswers((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
      )
    }
  }

  const addOption = () => {
    setOptions([...options, ""])
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    setOptions(options.filter((_, i) => i !== index))
    setCorrectAnswers(
      correctAnswers
        .filter((i) => i !== index)
        .map((i) => (i > index ? i - 1 : i)),
    )
  }

  const setOptionAt = (index: number, value: string) => {
    setOptions((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const onMathModeChecked = (checked: boolean) => {
    setUseMathMode(checked)
  }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setFormError("")
    try {
      const data = await apiClientUpload<{ url: string }>("/questions/upload-image", file)
      if (data?.url) setImageUrls((p) => [...p, data.url])
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not upload image")
    }
  }

  const mathModeToggle = (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
      <div className="min-w-0 pr-2">
        <p className="text-sm font-medium">Math (LaTeX)</p>
        <p className="text-xs text-muted-foreground">
          Use the shared formula scratchpad below the stem, then paste into the wording or into each option (plain
          text fields).
        </p>
      </div>
      <Switch checked={useMathMode} onCheckedChange={onMathModeChecked} />
    </div>
  )

  const figuresBlock = (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium">Picture</label>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImagePick}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" />
            Add picture
          </Button>
        </div>
        {imageUrls.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {imageUrls.map((url, i) => (
              <div key={`${url}-${i}`} className="relative">
                <img
                  src={apiAssetUrl(url)}
                  alt=""
                  className="h-28 max-w-full rounded-md border border-border object-contain"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute -right-2 -top-2 h-7 w-7 shadow-sm"
                  onClick={() => setImageUrls((prev) => prev.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )

  const stemBlock = (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">
          {useMathMode ? "Question wording" : "Question text"} <span className="text-destructive">*</span>
        </label>
        <Textarea
          placeholder={
            useMathMode
              ? "Plain text with optional inline math, e.g. Solve $\\frac{1}{2}+x$ …"
              : "Enter your question…"
          }
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          rows={useMathMode ? (layout === "split" ? 4 : 3) : layout === "split" ? 5 : 4}
          required
        />
      </div>
      {useMathMode ? <FormulaScratchpad /> : null}
      {figuresBlock}
    </div>
  )

  const typeField = (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Question type <span className="text-destructive">*</span>
      </label>
      <Select
        value={questionType}
        onValueChange={(v: "single_choice" | "multiple_choice" | "match") => {
          setQuestionType(v)
          if (v === "single_choice" && correctAnswers.length > 1) {
            setCorrectAnswers([correctAnswers[0]])
          }
          if (v === "match") {
            setUseMathMode(false)
            setImageUrls([])
            if (matchLeft.length < 1) setMatchLeft(["", ""])
            if (matchRight.length < 2) setMatchRight(["", "", "", ""])
            setMatchCorrect(matchLeft.map(() => -1))
          }
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="single_choice">Single Choice</SelectItem>
          <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
          <SelectItem value="match">Match (drag and drop)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  const difficultyField = (
    <div className="space-y-2">
      <label className="text-sm font-medium">Difficulty</label>
      <Select value={difficulty} onValueChange={(v) => setDifficulty(v as QuestionDifficulty)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUESTION_DIFFICULTY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const languageField = (
    <div className="space-y-2">
      <label className="text-sm font-medium">Language</label>
      <Select value={language} onValueChange={(v) => setLanguage(v as QuestionLanguage)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUESTION_LANGUAGE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const subjectField = (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Subject <span className="text-destructive">*</span>
      </label>
      <Select value={subjectId} onValueChange={setSubjectId}>
        <SelectTrigger>
          <SelectValue placeholder="Select subject" />
        </SelectTrigger>
        <SelectContent>
          {subjects.map((subject) => (
            <SelectItem key={subject.id} value={subject.id}>
              {subject.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const pointsField = (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {questionType === "match" ? "Points per correct match" : "Points"}{" "}
        <span className="text-destructive">*</span>
      </label>
      <Input
        type="number"
        min={1}
        value={points}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          setPoints(Number.isFinite(n) && n >= 1 ? n : 1)
        }}
        className={layout === "split" ? "w-full" : "w-24"}
        required
      />
      {questionType === "match" && matchLeft.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Max score for this question: {matchLeft.length * points} pts ({matchLeft.length} sections ×{" "}
          {points})
        </p>
      )}
    </div>
  )

  const setMatchLeftCount = (count: number) => {
    const n = Math.max(1, Math.min(12, count))
    setMatchLeft((prev) => {
      const next = [...prev]
      while (next.length < n) next.push("")
      return next.slice(0, n)
    })
    setMatchCorrect((prev) => {
      const next = [...prev]
      while (next.length < n) next.push(-1)
      return dedupeMatchMapping(next.slice(0, n))
    })
  }

  const setMatchRightCount = (count: number) => {
    const n = Math.max(2, Math.min(16, count))
    setMatchRight((prev) => {
      const next = [...prev]
      while (next.length < n) next.push("")
      return next.slice(0, n)
    })
    setMatchCorrect((prev) => dedupeMatchMapping(prev.map((i) => (i >= n ? -1 : i))))
  }

  useEffect(() => {
    if (questionType !== "match") return
    setMatchCorrect((prev) => {
      const next = dedupeMatchMapping(prev)
      return next.every((v, i) => v === prev[i]) ? prev : next
    })
  }, [questionType, matchLeft.length, matchRight.length])

  const matchBlock = (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Number of prompts</label>
          <Input
            type="number"
            min={1}
            max={12}
            value={matchLeft.length}
            onChange={(e) => setMatchLeftCount(parseInt(e.target.value, 10) || 1)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Number of answer choices</label>
          <Input
            type="number"
            min={2}
            max={16}
            value={matchRight.length}
            onChange={(e) => setMatchRightCount(parseInt(e.target.value, 10) || 2)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">
          Prompts (left column) <span className="text-destructive">*</span>
        </label>
        {matchLeft.map((text, i) => (
          <Textarea
            key={`left-${i}`}
            placeholder={`Prompt ${String.fromCharCode(65 + i)}`}
            value={text}
            onChange={(e) => {
              const next = [...matchLeft]
              next[i] = e.target.value
              setMatchLeft(next)
            }}
            rows={2}
          />
        ))}
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">
          Answer choices (draggable pool) <span className="text-destructive">*</span>
        </label>
        {matchRight.map((text, i) => (
          <Input
            key={`right-${i}`}
            placeholder={`Choice ${i + 1}`}
            value={text}
            onChange={(e) => {
              const next = [...matchRight]
              next[i] = e.target.value
              setMatchRight(next)
            }}
          />
        ))}
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium">
          Correct mapping <span className="text-destructive">*</span>
        </label>
        <p className="text-xs text-muted-foreground">
          For each prompt, choose one answer. Each choice can only be used once.
        </p>
        {matchLeft.map((leftText, i) => {
          const availableChoices = matchRight
            .map((opt, j) => ({ opt, j }))
            .filter(
              ({ j }) =>
                matchCorrect[i] === j ||
                isRightIndexAvailableForSlot(matchCorrect, j, i),
            )

          return (
            <div
              key={`map-${i}`}
              className="flex flex-col gap-2 rounded-lg border border-border/80 p-3 sm:flex-row sm:items-center"
            >
              <span
                className="min-w-0 flex-1 truncate text-sm font-medium"
                title={leftText || `Prompt ${i + 1}`}
              >
                {leftText.trim() ? leftText : `Prompt ${String.fromCharCode(65 + i)}`}
              </span>
              <Select
                value={matchCorrect[i] >= 0 ? String(matchCorrect[i]) : ""}
                onValueChange={(v) => {
                  const picked = parseInt(v, 10)
                  if (!Number.isInteger(picked) || picked < 0) return
                  if (!isRightIndexAvailableForSlot(matchCorrect, picked, i)) return
                  setMatchCorrect((prev) => assignMatchMapping(prev, i, picked))
                }}
              >
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue
                    placeholder={
                      availableChoices.length === 0
                        ? "No choices left"
                        : "Select correct choice"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableChoices.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      All choices are already assigned to other prompts.
                    </p>
                  ) : (
                    availableChoices.map(({ opt, j }) => (
                      <SelectItem key={j} value={String(j)} disabled={!opt.trim()}>
                        {opt.trim() || `Choice ${j + 1}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
    </div>
  )


  const attributesSidebar = (
    <div className="space-y-4">
      {questionType !== "match" && mathModeToggle}
      {typeField}
      {languageField}
      {difficultyField}
      {subjectField}
      {pointsField}
    </div>
  )

  const optionsBlock =
    questionType === "match" ? (
      matchBlock
    ) : (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {useMathMode
          ? "Options (paste from scratchpad — same as wording)"
          : questionType === "single_choice"
            ? "Options (select the correct answer)"
            : "Options (check all correct answers)"}{" "}
        <span className="text-destructive">*</span>
      </label>
      <div className="space-y-2">
        {questionType === "single_choice" ? (
          <RadioGroup
            className="space-y-2"
            value={correctAnswers.length === 1 ? String(correctAnswers[0]) : ""}
            onValueChange={(v) => setCorrectAnswers([parseInt(v, 10)])}
          >
            {options.map((option, index) => (
              <div key={index} className="flex items-start gap-2">
                <RadioGroupItem value={String(index)} id={`correct-opt-${index}`} className="mt-2.5" />
                {useMathMode ? (
                  <Textarea
                    placeholder={"Option " + (index + 1) + " — e.g. $\\frac{1}{2}$ or plain text"}
                    value={option}
                    onChange={(e) => setOptionAt(index, e.target.value)}
                    rows={2}
                    className="min-h-0 min-w-0 flex-1 resize-y font-mono text-sm"
                  />
                ) : (
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...options]
                      newOptions[index] = e.target.value
                      setOptions(newOptions)
                    }}
                    className="flex-1"
                  />
                )}
                {options.length > 2 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </RadioGroup>
        ) : (
          options.map((option, index) => (
            <div key={index} className="flex items-start gap-2">
              <Checkbox
                checked={correctAnswers.includes(index)}
                onCheckedChange={() => toggleCorrectAnswer(index)}
                className="mt-2.5"
              />
              {useMathMode ? (
                <Textarea
                  placeholder={"Option " + (index + 1) + " — e.g. $\\frac{1}{2}$ or plain text"}
                  value={option}
                  onChange={(e) => setOptionAt(index, e.target.value)}
                  rows={2}
                  className="min-h-0 min-w-0 flex-1 resize-y font-mono text-sm"
                />
              ) : (
                <Input
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) => {
                    const newOptions = [...options]
                    newOptions[index] = e.target.value
                    setOptions(newOptions)
                  }}
                  className="flex-1"
                />
              )}
              {options.length > 2 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addOption}>
        <Plus className="mr-2 h-4 w-4" />
        Add Option
      </Button>
    </div>
    )

  const footerBlock = (
    <>
      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2 border-t pt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !formValid}>
          {isLoading ? "Saving..." : initialQuestion ? "Update" : "Create"}
        </Button>
      </div>
    </>
  )

  if (layout === "split") {
    return (
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(18rem,22rem)] lg:items-start">
          <div className="min-w-0 space-y-6">
            {stemBlock}
            {optionsBlock}
          </div>

          <aside className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm lg:sticky lg:top-6">
            {attributesSidebar}
          </aside>
        </div>
        {footerBlock}
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {questionType !== "match" && mathModeToggle}

      {stemBlock}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {typeField}
        {languageField}
        {difficultyField}
        {subjectField}
      </div>

      {pointsField}

      {optionsBlock}

      {footerBlock}
    </form>
  )
}
