export type QuestionDifficulty = "A" | "B" | "C"

export const DEFAULT_QUESTION_DIFFICULTY: QuestionDifficulty = "B"

export const QUESTION_DIFFICULTY_OPTIONS: { value: QuestionDifficulty; label: string }[] = [
  { value: "A", label: "A" },
  { value: "B", label: "B" },
  { value: "C", label: "C" },
]

export function normalizeQuestionDifficulty(raw: unknown): QuestionDifficulty {
  const text = String(raw ?? "")
    .trim()
    .replace(/[Аа]/g, "A")
    .replace(/[Вв]/g, "B")
    .replace(/[Сс]/g, "C")
  const marks = [
    ...text.matchAll(/(^|[^0-9A-Za-z\u0400-\u04FF])([ABCabc])(?![0-9A-Za-z\u0400-\u04FF])/g),
  ]
  const last = marks.at(-1)?.[2]?.toUpperCase()
  if (last === "A" || last === "B" || last === "C") return last
  return DEFAULT_QUESTION_DIFFICULTY
}
