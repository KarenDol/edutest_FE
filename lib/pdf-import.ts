import { getAccessToken } from "@/lib/auth-token"
import { normalizeQuestionDifficulty, type QuestionDifficulty } from "@/lib/question-difficulty"
import { restoreLiteralNewlines } from "@/lib/text-breaks"
import { normalizeQuestionLanguage, type QuestionLanguage } from "@/lib/question-languages"
import { getPublicApiBase } from "@/lib/public-api"

export interface ParsedPdfAnswer {
  content: string
  isTrue: boolean
}

export interface ParsedPdfQuestion {
  content: string
  answers: ParsedPdfAnswer[]
  language?: string
  difficulty?: string
  image_urls?: string[]
}

export interface DraftImportQuestion {
  id: string
  question_text: string
  options: string[]
  correct_answers: number[]
  question_type: "single_choice" | "multiple_choice"
  points: number
  approved: boolean
  use_math: boolean
  language: QuestionLanguage
  difficulty: QuestionDifficulty
  image_urls: string[]
}

export interface ImportProgressEvent {
  type: "progress"
  current: number
  total: number
  percent: number
}

export interface ImportErrorEvent {
  type: "error"
  message: string
}

const STORAGE_KEY = "tb_pdf_import_drafts"

export function loadDraftQuestions(): DraftImportQuestion[] {
  if (typeof window === "undefined") return []
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]") as DraftImportQuestion[]
    return raw.map((d) => ({
      ...d,
      question_text: restoreLiteralNewlines(d.question_text ?? ""),
      options: (d.options ?? []).map((option) => restoreLiteralNewlines(option)),
      use_math: d.use_math ?? (hasLatex(d.question_text) || d.options.some(hasLatex)),
      language: normalizeQuestionLanguage(d.language),
      difficulty: normalizeQuestionDifficulty(d.difficulty),
      image_urls: cleanImageUrls(d.image_urls),
    }))
  } catch {
    return []
  }
}

export function saveDraftQuestions(questions: DraftImportQuestion[]) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(questions))
}

export function clearDraftQuestions() {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(STORAGE_KEY)
}

export function hasLatex(text: string): boolean {
  return /\$[^$]+\$/.test(text)
}

export function cleanImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item !== "string") continue
    const url = item.trim()
    if (!url.startsWith("/uploads/") || url.includes("..") || url.length > 2048) continue
    if (!out.includes(url)) out.push(url)
  }
  return out.slice(0, 12)
}

/** Strip HTML wrappers but keep $...$ LaTeX segments from the model. */
export function parseQuestionContent(raw: string): string {
  const s = restoreLiteralNewlines(raw).trim()
  if (!s) return ""
  if (hasLatex(s) && !/<[a-z][\s>]/i.test(s)) return s
  return htmlToPlain(s)
}

/** Strip simple HTML from legacy GPT output; does not remove $...$ math. */
export function htmlToPlain(html: string): string {
  if (!html) return ""
  let s = html
    .replace(/<\/(p|li|tr|div|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
  const lines = s.split("\n").map((ln) => ln.trim())
  return lines.filter(Boolean).join("\n").trim()
}

export function sanitizeDraftOptions(options: string[]): string[] {
  return options.map((o) => o.trim()).filter(Boolean)
}

export function isDraftValid(d: DraftImportQuestion): boolean {
  const options = sanitizeDraftOptions(d.options)
  if (options.length < 2) return false
  if (!d.question_text.trim()) return false
  if (d.correct_answers.length === 0) return false
  if (d.question_type === "single_choice" && d.correct_answers.length !== 1) return false
  return d.correct_answers.every((i) => Number.isInteger(i) && i >= 0 && i < options.length)
}

export function draftValidationMessage(d: DraftImportQuestion): string | null {
  const options = sanitizeDraftOptions(d.options)
  if (!d.question_text.trim()) return "Missing question text"
  if (options.length < 2) return `Only ${options.length} option(s) — need at least 2`
  if (d.correct_answers.length === 0) return "No correct answer selected"
  if (!isDraftValid(d)) return "Invalid correct answer index"
  return null
}

export function normalizeParsedQuestion(raw: ParsedPdfQuestion): DraftImportQuestion | null {
  const question_text = parseQuestionContent(raw.content ?? "").replace(/\[\[FIGURE_\d+\]\]/gi, "").trim()
  if (!question_text) return null

  const kept = (raw.answers ?? [])
    .map((a) => ({
      content: parseQuestionContent(a.content ?? ""),
      isTrue: a.isTrue === true,
    }))
    .filter((a) => a.content)

  if (kept.length < 2) return null

  const options = kept.map((a) => a.content)
  const correctIndex = kept.findIndex((a) => a.isTrue)
  const correct_answers = correctIndex >= 0 ? [correctIndex] : []

  const use_math = hasLatex(question_text) || options.some(hasLatex)
  return {
    id: crypto.randomUUID(),
    question_text,
    options,
    correct_answers,
    question_type: "single_choice",
    points: 1,
    approved: false,
    use_math,
    language: normalizeQuestionLanguage(raw.language),
    difficulty: normalizeQuestionDifficulty(raw.difficulty),
    image_urls: cleanImageUrls(raw.image_urls),
  }
}

export async function streamJsonl(
  res: Response,
  onLine: (obj: unknown) => void,
): Promise<void> {
  if (!res.body) throw new Error("No response body")
  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line) continue
      onLine(JSON.parse(line))
    }
  }
  if (buffer.trim()) onLine(JSON.parse(buffer.trim()))
}

export async function uploadPdfForImport(
  file: File,
  signal?: AbortSignal,
  onLine?: (obj: unknown) => void,
): Promise<void> {
  const token = getAccessToken()
  if (!token) throw new Error("Unauthorized")

  const body = new FormData()
  body.append("file", file)
  const res = await fetch(`${getPublicApiBase()}/questions/import-pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try {
      const j = JSON.parse(text) as { detail?: string }
      if (j.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail)
    } catch {
      /* use text */
    }
    throw new Error(msg)
  }

  await streamJsonl(res, (obj) => onLine?.(obj))
}
