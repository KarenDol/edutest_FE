"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "@/i18n/navigation"
import { apiClientJson, apiClientUpload, ApiError } from "@/lib/client-api"
import { apiAssetUrl } from "@/lib/public-api"
import {
  clearDraftQuestions,
  draftValidationMessage,
  isDraftValid,
  loadDraftQuestions,
  normalizeParsedQuestion,
  sanitizeDraftOptions,
  saveDraftQuestions,
  uploadPdfForImport,
  type DraftImportQuestion,
  type ImportErrorEvent,
  type ImportProgressEvent,
  type ParsedPdfQuestion,
} from "@/lib/pdf-import"
import {
  QUESTION_DIFFICULTY_OPTIONS,
  normalizeQuestionDifficulty,
  type QuestionDifficulty,
} from "@/lib/question-difficulty"
import {
  QUESTION_LANGUAGE_OPTIONS,
  questionLanguageLabel,
  type QuestionLanguage,
} from "@/lib/question-languages"
import type { Subject } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MixedMathText } from "@/components/mixed-math-text"
import { QuestionStem } from "@/components/question-stem"
import { stemHasTable } from "@/lib/question-stem"
import { ArrowLeft, FileUp, ImagePlus, Loader2, Save, Trash2, X } from "lucide-react"

interface PdfImportManagerProps {
  subjects: Subject[]
}

export function PdfImportManager({ subjects }: PdfImportManagerProps) {
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "")
  const [file, setFile] = useState<File | null>(null)
  const [drafts, setDrafts] = useState<DraftImportQuestion[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)

  const [isFetching, setIsFetching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  const controllerRef = useRef<AbortController | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    setDrafts(loadDraftQuestions())
  }, [])

  useEffect(() => {
    saveDraftQuestions(drafts)
  }, [drafts])

  const updateDraft = useCallback((id: string, patch: Partial<DraftImportQuestion>) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }, [])

  const addDraftImage = async (file: File) => {
    if (!editingId) return
    setUploadingImage(true)
    setError(null)
    try {
      const data = await apiClientUpload<{ url: string }>("/questions/upload-image", file)
      if (data?.url) {
        const url = data.url
        setDrafts((prev) =>
          prev.map((d) =>
            d.id === editingId
              ? { ...d, image_urls: [...(d.image_urls ?? []), url].slice(0, 12) }
              : d,
          ),
        )
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not upload image")
    } finally {
      setUploadingImage(false)
    }
  }

  const pickFile = (f?: File | null) => {
    if (!f) {
      setFile(null)
      return
    }
    const ok =
      f.type === "application/pdf" ||
      f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      f.name.toLowerCase().endsWith(".pdf") ||
      f.name.toLowerCase().endsWith(".xlsx")
    if (!ok) {
      setError("Please upload a PDF or .xlsx file.")
      setFile(null)
      return
    }
    setError(null)
    setFile(f)
  }

  const startExtraction = async () => {
    if (!file) {
      setError("Select a PDF or Excel file first.")
      return
    }
    if (!subjectId) {
      setError("Select a subject for imported questions.")
      return
    }

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setIsFetching(true)
    setProgress(0)
    setProgressText("Starting…")
    setError(null)
    setImportResult(null)

    try {
      await uploadPdfForImport(file, controller.signal, (obj) => {
        const row = obj as ImportProgressEvent | ImportErrorEvent | ParsedPdfQuestion
        if ("type" in row && row.type === "progress") {
          setProgress(row.percent ?? 0)
          setProgressText(`${row.current}/${row.total} pages`)
          return
        }
        if ("type" in row && row.type === "error") {
          throw new Error(row.message)
        }
        if ("content" in row && "answers" in row) {
          const draft = normalizeParsedQuestion(row as ParsedPdfQuestion)
          if (draft) setDrafts((prev) => [...prev, draft])
        }
      })
      setProgress(100)
      setProgressText("Done")
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return
      setError((e as Error)?.message ?? "Failed to extract problems")
    } finally {
      setIsFetching(false)
    }
  }

  const cancelExtraction = () => {
    controllerRef.current?.abort()
    setIsFetching(false)
    setProgressText("Canceled")
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === drafts.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(drafts.map((d) => d.id)))
  }

  const approveSelected = () => {
    setDrafts((prev) =>
      prev.map((d) => (selectedIds.has(d.id) ? { ...d, approved: true } : d)),
    )
    setSelectedIds(new Set())
  }

  const removeSelected = () => {
    setDrafts((prev) => prev.filter((d) => !selectedIds.has(d.id)))
    setSelectedIds(new Set())
  }

  const importApproved = async () => {
    const approved = drafts.filter((d) => d.approved)
    const toSave = approved.filter(isDraftValid)
    const incomplete = approved.filter((d) => !isDraftValid(d))

    if (!approved.length) {
      setError("Approve at least one question before importing.")
      return
    }
    if (!toSave.length) {
      setError(
        incomplete.length
          ? `${incomplete.length} approved question(s) are incomplete (need question text, at least 2 options, and a correct answer). Edit or unapprove them.`
          : "No valid questions to import.",
      )
      return
    }
    if (!subjectId) {
      setError("Select a subject.")
      return
    }

    setIsImporting(true)
    setError(null)
    if (incomplete.length) {
      setImportResult(
        `Skipping ${incomplete.length} incomplete approved question(s). Importing ${toSave.length}…`,
      )
    }
    try {
      const res = await apiClientJson<{
        created_count: number
        errors: { index: number; detail: string }[]
      }>("/questions/import-batch", {
        method: "POST",
        body: JSON.stringify({
          subject_id: subjectId,
          questions: toSave.map((d) => ({
            question_text: d.question_text.trim(),
            options: sanitizeDraftOptions(d.options),
            correct_answers: d.correct_answers,
            question_type: d.question_type,
            points: d.points,
            language: d.language,
            difficulty: d.difficulty,
            use_math: d.use_math,
            image_urls: d.image_urls ?? [],
          })),
        }),
      })
      const failedIndices = new Set(res.errors.map((e) => e.index))
      const succeededIds = new Set(
        toSave.filter((_, i) => !failedIndices.has(i)).map((d) => d.id),
      )
      setDrafts((prev) => {
        const remaining = prev.filter((d) => !succeededIds.has(d.id))
        saveDraftQuestions(remaining)
        return remaining
      })
      const skippedNote = incomplete.length ? ` (${incomplete.length} incomplete skipped)` : ""
      setImportResult(`Imported ${res.created_count} question(s).${skippedNote}`)
      if (res.errors.length) {
        const details = res.errors
          .slice(0, 3)
          .map((e) => `#${e.index + 1}: ${typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail)}`)
          .join("; ")
        setError(
          `${res.errors.length} question(s) failed on the server${details ? `: ${details}` : ""}`,
        )
      }
    } catch (e) {
      setError((e as Error)?.message ?? "Import failed")
    } finally {
      setIsImporting(false)
    }
  }

  const approvedCount = drafts.filter((d) => d.approved).length
  const editing = drafts.find((d) => d.id === editingId)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/questions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to questions
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm("Clear all draft extracted questions?")) {
              clearDraftQuestions()
              setDrafts([])
            }
          }}
        >
          Clear drafts
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Upload document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Subject for imported questions</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            onDrop={(e) => {
              e.preventDefault()
              pickFile(e.dataTransfer.files?.[0])
            }}
            onDragOver={(e) => e.preventDefault()}
            className="rounded-lg border-2 border-dashed border-border p-8 text-center hover:border-primary transition-colors"
          >
            <input
              type="file"
              accept=".pdf,.xlsx"
              className="hidden"
              id="pdf-import-file"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <label htmlFor="pdf-import-file" className="cursor-pointer block">
              <FileUp className="mx-auto mb-2 h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Click or drop PDF / Excel (.xlsx)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDFs are processed one page at a time with vision AI so formulas become LaTeX ($...$).
              </p>
              {file && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Selected: <span className="font-medium text-foreground">{file.name}</span>
                </p>
              )}
            </label>
          </div>

          <Button onClick={startExtraction} disabled={!file || isFetching || !subjectId}>
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting…
              </>
            ) : (
              "Extract problems with AI"
            )}
          </Button>
        </CardContent>
      </Card>

      {isFetching && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Parsing file…</span>
              <span>
                {progressText} · {progress}%
              </span>
            </div>
            <Progress value={progress} />
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={cancelExtraction}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {(error || importResult) && (
        <Card className={error ? "border-destructive" : "border-green-600/40"}>
          <CardContent className="pt-6 text-sm">
            {importResult && <p className="text-green-700 dark:text-green-400">{importResult}</p>}
            {error && <p className="text-destructive">{error}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>2. Review extracted questions ({drafts.length})</CardTitle>
          <div className="text-sm text-muted-foreground">{approvedCount} approved</div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              {selectedIds.size === drafts.length && drafts.length > 0
                ? "Deselect all"
                : "Select all"}
            </Button>
            {selectedIds.size > 0 && (
              <>
                <Button size="sm" onClick={approveSelected}>
                  Approve selected ({selectedIds.size})
                </Button>
                <Button variant="destructive" size="sm" onClick={removeSelected}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Remove selected
                </Button>
              </>
            )}
            <Button
              className="ml-auto"
              disabled={approvedCount === 0 || isImporting}
              onClick={importApproved}
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save {approvedCount} to question bank
            </Button>
          </div>

          {drafts.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">
              No extracted questions yet. Upload a file and run extraction.
            </p>
          ) : (
            <div className="space-y-3">
              {drafts.map((d) => {
                const issue = draftValidationMessage(d)
                return (
                <Card key={d.id} className={issue ? "border-destructive/50" : "border-border"}>
                  <CardContent className="flex items-start gap-3 pt-4">
                    <Checkbox
                      checked={selectedIds.has(d.id)}
                      onCheckedChange={() => toggleSelect(d.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-medium ${d.approved ? "text-green-600" : "text-amber-600"}`}
                        >
                          {d.approved ? "Approved" : "Pending"}
                        </span>
                        {issue && (
                          <span className="text-xs text-destructive">Incomplete — {issue}</span>
                        )}
                      </div>
                      <div
                        className={
                          stemHasTable(d.question_text)
                            ? "text-sm font-medium"
                            : "line-clamp-6 text-sm font-medium"
                        }
                      >
                        <QuestionStem text={d.question_text} math={d.use_math} />
                      </div>
                      {d.image_urls?.length ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {d.image_urls.map((url) => (
                            <img
                              key={url}
                              src={apiAssetUrl(url)}
                              alt=""
                              className="h-24 max-w-full rounded-md border border-border object-contain"
                            />
                          ))}
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {questionLanguageLabel(d.language)} · level {normalizeQuestionDifficulty(d.difficulty)} ·{" "}
                        {d.options.length} options · correct:{" "}
                        {d.correct_answers.map((i) => String.fromCharCode(65 + i)).join(", ") ||
                          "?"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setEditingId(d.id)}>
                      Edit
                    </Button>
                  </CardContent>
                </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing != null} onOpenChange={(open) => { if (!open) setEditingId(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>Edit draft question</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={editing.language}
                      onValueChange={(value) =>
                        updateDraft(editing.id, { language: value as QuestionLanguage })
                      }
                    >
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
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <Select
                      value={editing.difficulty}
                      onValueChange={(value) =>
                        updateDraft(editing.id, { difficulty: value as QuestionDifficulty })
                      }
                    >
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
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Math (LaTeX)</p>
                    <p className="text-xs text-muted-foreground">Wrap formulas in $...$</p>
                  </div>
                  <Switch
                    checked={editing.use_math}
                    onCheckedChange={(checked) => updateDraft(editing.id, { use_math: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Question text</Label>
                  <Textarea
                    value={editing.question_text}
                    onChange={(e) => updateDraft(editing.id, { question_text: e.target.value })}
                    rows={4}
                  />
                  {(stemHasTable(editing.question_text) ||
                    (editing.use_math && /\$|\\\(|\\\[/.test(editing.question_text))) &&
                    editing.question_text.trim() && (
                    <div className="space-y-1.5 px-0.5">
                      <p className="text-xs font-medium text-muted-foreground">Preview</p>
                      <QuestionStem
                        text={editing.question_text}
                        math={editing.use_math}
                        className="text-base font-normal leading-relaxed"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium">Picture</p>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const picked = e.target.files?.[0]
                        e.target.value = ""
                        if (picked) void addDraftImage(picked)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingImage}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      {uploadingImage ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="mr-2 h-4 w-4" />
                      )}
                      Add picture
                    </Button>
                  </div>
                  {editing.image_urls?.length ? (
                    <div className="flex flex-wrap gap-3">
                      {editing.image_urls.map((url, index) => (
                        <div key={`${url}-${index}`} className="relative">
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
                            onClick={() =>
                              updateDraft(editing.id, {
                                image_urls: editing.image_urls.filter((_, j) => j !== index),
                              })
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No picture on this question yet.</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Correct answer</p>
                  <RadioGroup
                    value={
                      editing.correct_answers.length === 1 ? String(editing.correct_answers[0]) : ""
                    }
                    onValueChange={(value) =>
                      updateDraft(editing.id, {
                        correct_answers: [Number(value)],
                        question_type: "single_choice",
                      })
                    }
                    className="gap-2"
                  >
                    {editing.options.map((opt, i) => {
                      const selected = editing.correct_answers[0] === i
                      const optionId = `draft-correct-${editing.id}-${i}`
                      return (
                        <div
                          key={optionId}
                          className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 ${
                            selected
                              ? "border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/40"
                              : "border-border"
                          }`}
                        >
                          <RadioGroupItem value={String(i)} id={optionId} className="mt-2.5" />
                          <Label
                            htmlFor={optionId}
                            className="mt-1.5 w-4 cursor-pointer text-sm font-semibold"
                          >
                            {String.fromCharCode(65 + i)}
                          </Label>
                          <div className="min-w-0 flex-1 space-y-1">
                            <Input
                              value={opt}
                              onChange={(e) => {
                                const options = [...editing.options]
                                options[i] = e.target.value
                                updateDraft(editing.id, { options })
                              }}
                              className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                            />
                            {/\$|\\\(|\\\[/.test(opt) && (
                              <MixedMathText
                                text={opt}
                                className="px-1 text-base font-normal leading-snug"
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </RadioGroup>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingId(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    updateDraft(editing.id, { approved: true })
                    setEditingId(null)
                  }}
                >
                  Approve & close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
