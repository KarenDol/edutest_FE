export type QuestionLanguage = "kazakh" | "russian" | "english"

export const DEFAULT_QUESTION_LANGUAGE: QuestionLanguage = "russian"

export const QUESTION_LANGUAGE_OPTIONS: { value: QuestionLanguage; label: string }[] = [
  { value: "kazakh", label: "Kazakh" },
  { value: "russian", label: "Russian" },
  { value: "english", label: "English" },
]

export function normalizeQuestionLanguage(raw: unknown): QuestionLanguage {
  const key = String(raw ?? "")
    .trim()
    .toLowerCase()
  if (key === "kazakh" || key === "kk" || key === "kaz" || key === "қазақ") return "kazakh"
  if (key === "english" || key === "en" || key === "eng") return "english"
  if (key === "russian" || key === "ru" || key === "rus" || key === "русский" || key === "рус")
    return "russian"
  return DEFAULT_QUESTION_LANGUAGE
}

export function questionLanguageLabel(lang: QuestionLanguage): string {
  return QUESTION_LANGUAGE_OPTIONS.find((o) => o.value === lang)?.label ?? "Russian"
}
