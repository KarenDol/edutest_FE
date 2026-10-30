"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { apiClientJson, ApiError } from "@/lib/client-api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Plus, Pencil, Trash2, Layers, GripVertical } from "lucide-react"
import { normalizeQuestionDifficulty } from "@/lib/question-difficulty"
import type { Question, Subject, Test, TestSection, TestSectionInput } from "@/lib/types"

interface TestWithRelations extends Test {
  subjects: Subject | null
  test_sections?: TestSection[]
  test_questions: {
    id: string
    section_id?: string | null
    question_order: number
    questions: { id: string; question_text: string; points: number } | null
  }[]
}

interface TestsManagerProps {
  initialTests: TestWithRelations[]
  subjects: Subject[]
}

type SubjectPickDraft = {
  clientId: string
  subject_id: string
  question_count: number
}

type SelectionMode = "random" | "manual"

type SectionDraft = {
  clientId: string
  name: string
  duration_minutes: number
  subject_picks: SubjectPickDraft[]
  question_ids: string[]
}

function newPick(): SubjectPickDraft {
  return { clientId: crypto.randomUUID(), subject_id: "", question_count: 5 }
}

function newSection(index: number): SectionDraft {
  return {
    clientId: crypto.randomUUID(),
    name: `Секция ${index + 1}`,
    duration_minutes: 30,
    subject_picks: [newPick()],
    question_ids: [],
  }
}

function isManualTest(test: TestWithRelations): boolean {
  const secs = test.test_sections
  if (secs && secs.length > 0) {
    return secs.every((s) => !(s.subject_picks && s.subject_picks.length > 0))
  }
  return (test.test_questions?.length ?? 0) > 0
}

function sectionsFromTest(test: TestWithRelations, manual: boolean): SectionDraft[] {
  const secs = test.test_sections
  const tqs = test.test_questions || []
  if (secs && secs.length > 0) {
    return secs.map((s) => ({
      clientId: s.id,
      name: s.name,
      duration_minutes: s.duration_minutes,
      subject_picks: manual
        ? []
        : (s.subject_picks || []).map((p) => ({
            clientId: crypto.randomUUID(),
            subject_id: p.subject_id,
            question_count: p.question_count,
          })),
      question_ids: manual
        ? tqs
            .filter((tq) => tq.section_id === s.id)
            .sort((a, b) => a.question_order - b.question_order)
            .map((tq) => tq.questions?.id)
            .filter((id): id is string => Boolean(id))
        : [],
    }))
  }
  if (manual && tqs.length > 0) {
    return [
      {
        ...newSection(0),
        question_ids: [...tqs]
          .sort((a, b) => a.question_order - b.question_order)
          .map((tq) => tq.questions?.id)
          .filter((id): id is string => Boolean(id)),
      },
    ]
  }
  return [newSection(0)]
}

function toApiSections(sections: SectionDraft[], mode: SelectionMode): TestSectionInput[] {
  if (mode === "manual") {
    return sections.map((s) => ({
      name: s.name.trim(),
      duration_minutes: s.duration_minutes,
      subject_picks: [],
      question_ids: s.question_ids,
    }))
  }
  return sections.map((s) => ({
    name: s.name.trim(),
    duration_minutes: s.duration_minutes,
    subject_picks: s.subject_picks
      .filter((p) => p.subject_id && p.question_count > 0)
      .map((p) => ({
        subject_id: p.subject_id,
        question_count: p.question_count,
      })),
  }))
}

export function TestsManager({ initialTests, subjects }: TestsManagerProps) {
  const [tests, setTests] = useState(initialTests)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTest, setEditingTest] = useState<TestWithRelations | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [sections, setSections] = useState<SectionDraft[]>([newSection(0)])
  const [isActive, setIsActive] = useState(false)
  const [shuffleAnswerOptions, setShuffleAnswerOptions] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showPeriodicTable, setShowPeriodicTable] = useState(false)
  const [proctoringVersion, setProctoringVersion] = useState(0)
  const [regenerateQuestions, setRegenerateQuestions] = useState(true)
  const [testCount, setTestCount] = useState(1)
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("random")
  const [bankQuestions, setBankQuestions] = useState<Question[]>([])
  const [bankLoading, setBankLoading] = useState(false)

  const router = useRouter()

  useEffect(() => {
    apiClientJson<Record<string, number>>("/questions/count-by-subject")
      .then(setQuestionCounts)
      .catch(() => setQuestionCounts({}))
  }, [])

  useEffect(() => {
    if (!isDialogOpen || selectionMode !== "manual") return
    let cancelled = false
    setBankLoading(true)
    apiClientJson<Question[]>("/questions")
      .then((rows) => {
        if (!cancelled) setBankQuestions(rows)
      })
      .catch(() => {
        if (!cancelled) setBankQuestions([])
      })
      .finally(() => {
        if (!cancelled) setBankLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isDialogOpen, selectionMode])

  const totals = useMemo(() => {
    let questions = 0
    let minutes = 0
    for (const s of sections) {
      minutes += s.duration_minutes || 0
      if (selectionMode === "manual") {
        questions += s.question_ids.length
      } else {
        for (const p of s.subject_picks) {
          if (p.subject_id && p.question_count > 0) {
            questions += p.question_count
          }
        }
      }
    }
    return { questions, minutes }
  }, [sections, selectionMode])

  const requiredPerSubject = useMemo(() => {
    const req: Record<string, number> = {}
    for (const s of sections) {
      for (const p of s.subject_picks) {
        if (p.subject_id && p.question_count > 0) {
          req[p.subject_id] = (req[p.subject_id] ?? 0) + p.question_count
        }
      }
    }
    return req
  }, [sections])

  const batchCount = editingTest ? 1 : testCount

  const validationError = useMemo(() => {
    if (!title.trim()) return "Укажите название теста"
    if (sections.length === 0) return "Добавьте хотя бы одну секцию"
    if (!editingTest && selectionMode === "manual" && testCount > 1) {
      return "Ручной выбор вопросов доступен только для одного теста за раз"
    }
    if (!editingTest && selectionMode === "random" && (testCount < 1 || testCount > 50)) {
      return "Количество тестов: от 1 до 50"
    }
    for (const s of sections) {
      if (!s.name.trim()) return "У каждой секции должно быть название"
      if (s.duration_minutes < 1) return "Время секции должно быть не меньше 1 минуты"
      if (selectionMode === "manual") {
        if (s.question_ids.length === 0) {
          return `В секции «${s.name || "без названия"}» выберите хотя бы один вопрос`
        }
      } else {
        const picks = s.subject_picks.filter((p) => p.subject_id && p.question_count > 0)
        if (picks.length === 0) {
          return `В секции «${s.name || "без названия"}» добавьте предмет и количество вопросов`
        }
      }
    }
    if (selectionMode === "random") {
      for (const [subjectId, perTest] of Object.entries(requiredPerSubject)) {
        const needed = perTest * batchCount
        const available = questionCounts[subjectId] ?? 0
        if (needed > available) {
          const sub = subjects.find((x) => x.id === subjectId)
          return (
            `Недостаточно уникальных вопросов по предмету «${sub?.name ?? subjectId}»: ` +
            `нужно ${needed} для ${batchCount} тест(ов) (${perTest} в каждом), в базе ${available}`
          )
        }
      }
    }
    if (totals.questions < 1) return "Тест должен содержать хотя бы один вопрос"
    return null
  }, [
    title,
    sections,
    questionCounts,
    subjects,
    totals.questions,
    requiredPerSubject,
    batchCount,
    editingTest,
    testCount,
    selectionMode,
  ])

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setSections([newSection(0)])
    setIsActive(false)
    setShuffleAnswerOptions(false)
    setShowCalculator(false)
    setShowPeriodicTable(false)
    setProctoringVersion(0)
    setRegenerateQuestions(true)
    setTestCount(1)
    setSelectionMode("random")
    setEditingTest(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        subject_id: null,
        is_active: isActive,
        shuffle_answer_options: shuffleAnswerOptions,
        show_calculator: showCalculator,
        show_periodic_table: showPeriodicTable,
        proctoring_version: proctoringVersion,
        sections: toApiSections(sections, selectionMode),
        regenerate_questions:
          selectionMode === "random" ? (editingTest ? regenerateQuestions : true) : true,
        test_count: editingTest || selectionMode === "manual" ? 1 : testCount,
      }
      if (editingTest) {
        await apiClientJson(`/tests/${editingTest.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
      } else {
        await apiClientJson("/tests", {
          method: "POST",
          body: JSON.stringify(body),
        })
      }
      router.refresh()
      window.location.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить тест")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (test: TestWithRelations) => {
    const manual = isManualTest(test)
    setEditingTest(test)
    setTitle(test.title)
    setDescription(test.description || "")
    setSelectionMode(manual ? "manual" : "random")
    setSections(sectionsFromTest(test, manual))
    setIsActive(test.is_active)
    setShuffleAnswerOptions(Boolean(test.shuffle_answer_options))
    setShowCalculator(Boolean(test.show_calculator))
    setShowPeriodicTable(Boolean(test.show_periodic_table))
    setProctoringVersion(Number(test.proctoring_version ?? 0))
    setRegenerateQuestions(false)
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить этот тест?")) return
    await apiClientJson(`/tests/${id}`, { method: "DELETE" })
    setTests(tests.filter((t) => t.id !== id))
  }

  const handleToggleActive = async (test: TestWithRelations) => {
    const res = await apiClientJson<{ is_active: boolean }>(`/tests/${test.id}/toggle-active`, {
      method: "POST",
    })
    setTests(tests.map((t) => (t.id === test.id ? { ...t, is_active: res.is_active } : t)))
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    resetForm()
  }

  const updateSection = (clientId: string, patch: Partial<SectionDraft>) => {
    setSections((prev) => prev.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s)))
  }

  const addSection = () => {
    setSections((prev) => [...prev, newSection(prev.length)])
  }

  const removeSection = (clientId: string) => {
    setSections((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.clientId !== clientId)))
  }

  const addPick = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.clientId === sectionId
          ? { ...s, subject_picks: [...s.subject_picks, newPick()] }
          : s,
      ),
    )
  }

  const updatePick = (
    sectionId: string,
    pickId: string,
    patch: Partial<SubjectPickDraft>,
  ) => {
    setSections((prev) =>
      prev.map((s) =>
        s.clientId === sectionId
          ? {
              ...s,
              subject_picks: s.subject_picks.map((p) =>
                p.clientId === pickId ? { ...p, ...patch } : p,
              ),
            }
          : s,
      ),
    )
  }

  const toggleSectionQuestion = (sectionId: string, questionId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.clientId !== sectionId) return s
        const has = s.question_ids.includes(questionId)
        return {
          ...s,
          question_ids: has
            ? s.question_ids.filter((id) => id !== questionId)
            : [...s.question_ids, questionId],
        }
      }),
    )
  }

  const usedQuestionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of sections) {
      for (const qid of s.question_ids) {
        ids.add(qid)
      }
    }
    return ids
  }, [sections])

  const removePick = (sectionId: string, pickId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.clientId !== sectionId) return s
        if (s.subject_picks.length <= 1) return s
        return { ...s, subject_picks: s.subject_picks.filter((p) => p.clientId !== pickId) }
      }),
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Все тесты</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleDialogClose()}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm()
                setIsDialogOpen(true)
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Собрать тест
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[min(96vw,72rem)] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTest ? "Редактировать тест" : "Сборщик теста"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Название теста</label>
                <Input
                  placeholder="Например: Пробный ЕНТ"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                {!editingTest && testCount > 1 && title.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Будут созданы: «{title.trim()} 1» … «{title.trim()} {testCount}»
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {!editingTest && selectionMode === "random" && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Количество тестов</label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={testCount}
                      onChange={(e) =>
                        setTestCount(Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Одинаковая структура; у каждого теста свой случайный набор вопросов без повторов
                    </p>
                  </div>
                )}
                <div className={`space-y-2 ${editingTest ? "sm:col-span-2" : ""}`}>
                  <label className="text-sm font-medium">Описание (необязательно)</label>
                  <Textarea
                    placeholder="Краткое описание для студентов"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Способ подбора вопросов</p>
                  <p className="text-xs text-muted-foreground">
                    {selectionMode === "random"
                      ? "Случайная выборка из банка по предметам"
                      : "Вы сами отмечаете вопросы для каждой секции"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`text-xs ${selectionMode === "random" ? "font-medium text-foreground" : "text-muted-foreground"}`}
                  >
                    Случайно
                  </span>
                  <Switch
                    checked={selectionMode === "manual"}
                    onCheckedChange={(checked) => {
                      const next: SelectionMode = checked ? "manual" : "random"
                      setSelectionMode(next)
                      if (checked) {
                        setTestCount(1)
                        setSections((prev) =>
                          prev.map((s) => ({
                            ...s,
                            subject_picks: [],
                            question_ids: s.question_ids,
                          })),
                        )
                      } else {
                        setSections((prev) =>
                          prev.map((s) => ({
                            ...s,
                            subject_picks: s.subject_picks.length ? s.subject_picks : [newPick()],
                            question_ids: [],
                          })),
                        )
                      }
                    }}
                  />
                  <span
                    className={`text-xs ${selectionMode === "manual" ? "font-medium text-foreground" : "text-muted-foreground"}`}
                  >
                    Вручную
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
                <span>
                  <strong>{totals.questions}</strong> вопросов в каждом тесте
                </span>
                {!editingTest && selectionMode === "random" && testCount > 1 && (
                  <span>
                    <strong>{testCount}</strong> тест(ов)
                  </span>
                )}
                <span>
                  <strong>{totals.minutes}</strong> мин всего
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Секции теста
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={addSection}>
                    <Plus className="h-3 w-3 mr-1" />
                    Секция
                  </Button>
                </div>

                <div className="space-y-4">
                  {sections.map((section, secIndex) => (
                    <div
                      key={section.clientId}
                      className="rounded-lg border border-border/80 bg-card p-4 space-y-3"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
                        <div className="flex-1 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">
                              Название секции
                            </label>
                            <Input
                              value={section.name}
                              onChange={(e) =>
                                updateSection(section.clientId, { name: e.target.value })
                              }
                              placeholder={`Секция ${secIndex + 1}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">
                              Время (мин)
                            </label>
                            <Input
                              type="number"
                              min={1}
                              value={section.duration_minutes}
                              onChange={(e) =>
                                updateSection(section.clientId, {
                                  duration_minutes: parseInt(e.target.value, 10) || 1,
                                })
                              }
                            />
                          </div>
                        </div>
                        {sections.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeSection(section.clientId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="space-y-2 pl-7">
                        {selectionMode === "manual" ? (
                          <>
                            <p className="text-xs font-medium text-muted-foreground">
                              Выберите вопросы для секции ({section.question_ids.length} выбрано)
                            </p>
                            {bankLoading ? (
                              <p className="text-sm text-muted-foreground">Загрузка банка вопросов…</p>
                            ) : bankQuestions.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                В банке пока нет вопросов. Сначала создайте их в разделе «Вопросы».
                              </p>
                            ) : (
                              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border/80 bg-muted/20 p-2">
                                {bankQuestions.map((q) => {
                                  const checked = section.question_ids.includes(q.id)
                                  const usedInOther =
                                    usedQuestionIds.has(q.id) && !checked
                                  const subName =
                                    (q as Question & { subjects?: { name: string } | null }).subjects
                                      ?.name ??
                                    subjects.find((s) => s.id === q.subject_id)?.name ??
                                    "—"
                                  return (
                                    <label
                                      key={q.id}
                                      className={`flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm ${
                                        usedInOther
                                          ? "cursor-not-allowed opacity-50"
                                          : "hover:bg-muted/60"
                                      }`}
                                    >
                                      <Checkbox
                                        checked={checked}
                                        disabled={usedInOther}
                                        onCheckedChange={() =>
                                          toggleSectionQuestion(section.clientId, q.id)
                                        }
                                        className="mt-0.5"
                                      />
                                      <span className="min-w-0 flex-1">
                                        <span className="line-clamp-2 text-foreground">
                                          {q.question_text}
                                        </span>
                                        <span className="mt-0.5 block text-xs text-muted-foreground">
                                          {subName} · {normalizeQuestionDifficulty(q.difficulty)} · {q.points} б. ·{" "}
                                          {q.question_type}
                                        </span>
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                        <p className="text-xs font-medium text-muted-foreground">
                          Предметы и количество случайных вопросов
                        </p>
                        {section.subject_picks.map((pick) => {
                          const available = pick.subject_id
                            ? (questionCounts[pick.subject_id] ?? 0)
                            : 0
                          return (
                            <div
                              key={pick.clientId}
                              className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_7rem_auto_auto] md:items-end"
                            >
                              <div className="min-w-0 space-y-1 md:col-span-1">
                                <Select
                                  value={pick.subject_id || "__none__"}
                                  onValueChange={(v) =>
                                    updatePick(section.clientId, pick.clientId, {
                                      subject_id: v === "__none__" ? "" : v,
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-full min-w-0 max-w-full">
                                    <SelectValue
                                      placeholder="Предмет"
                                      className="truncate"
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Выберите предмет</SelectItem>
                                    {subjects.map((sub) => (
                                      <SelectItem key={sub.id} value={sub.id}>
                                        {sub.name} ({questionCounts[sub.id] ?? 0})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="shrink-0 space-y-1">
                                <label className="text-xs text-muted-foreground md:sr-only">
                                  Кол-во
                                </label>
                                <Input
                                  type="number"
                                  min={1}
                                  className="w-full md:w-[7rem]"
                                  value={pick.question_count}
                                  onChange={(e) =>
                                    updatePick(section.clientId, pick.clientId, {
                                      question_count: parseInt(e.target.value, 10) || 1,
                                    })
                                  }
                                />
                              </div>
                              <span className="shrink-0 self-center text-xs text-muted-foreground whitespace-nowrap md:pb-2">
                                из {available}
                              </span>
                              {section.subject_picks.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="shrink-0 justify-self-end md:justify-self-auto"
                                  onClick={() => removePick(section.clientId, pick.clientId)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )
                        })}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addPick(section.clientId)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Ещё предмет
                        </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {editingTest && (
                <div className="flex items-center gap-2 rounded-lg border p-3">
                  <Checkbox
                    id="regenerate"
                    checked={regenerateQuestions}
                    onCheckedChange={(c) => setRegenerateQuestions(Boolean(c))}
                  />
                  <label htmlFor="regenerate" className="text-sm cursor-pointer">
                    {selectionMode === "random"
                      ? "Пересобрать вопросы заново (новая случайная выборка из банка)"
                      : "Применить новый набор выбранных вопросов"}
                  </label>
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
                <p className="text-sm font-medium">Параметры теста</p>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium">Активен для студентов</p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium">Перемешивать варианты ответов</p>
                  </div>
                  <Switch
                    checked={shuffleAnswerOptions}
                    onCheckedChange={setShuffleAnswerOptions}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium">Калькулятор</p>
                  </div>
                  <Switch checked={showCalculator} onCheckedChange={setShowCalculator} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium">Таблица Менделеева</p>
                  </div>
                  <Switch
                    checked={showPeriodicTable}
                    onCheckedChange={setShowPeriodicTable}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-medium">Прокторинг</p>
                    <p className="text-xs text-muted-foreground">
                      Камера и экран во время теста. ИИ следит за лицом.
                    </p>
                  </div>
                  <select
                    className="h-9 max-w-[200px] rounded-md border border-input bg-background px-2 text-sm"
                    value={proctoringVersion}
                    onChange={(e) => setProctoringVersion(Number(e.target.value))}
                  >
                    <option value={0}>Выкл</option>
                    <option value={1}>Камера + экран</option>
                    <option value={3}>Камера + экран + ИИ</option>
                  </select>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive rounded-md bg-destructive/10 px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Отмена
                </Button>
                <Button type="submit" disabled={isLoading || !!validationError}>
                  {isLoading
                    ? "Сохранение..."
                    : editingTest
                      ? "Обновить"
                      : testCount > 1
                        ? `Создать ${testCount} тестов`
                        : "Создать тест"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {tests.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Секции</TableHead>
                <TableHead>Вопросов</TableHead>
                <TableHead>Время</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((test) => (
                <TableRow key={test.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{test.title}</p>
                      {test.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {test.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(test.test_sections?.length ?? 0) > 0 ? (
                      <Badge variant="secondary">
                        {test.test_sections!.length} сек.
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{test.test_questions.length}</TableCell>
                  <TableCell>{test.duration_minutes ?? "—"} мин</TableCell>
                  <TableCell>
                    <Switch
                      checked={test.is_active}
                      onCheckedChange={() => handleToggleActive(test)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(test)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(test.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Тестов пока нет. Создайте первый через сборщик.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
