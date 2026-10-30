import type { Question } from "@/lib/types"

export type MatchOptions = {
  left: string[]
  right: string[]
}

export function isMatchQuestion(question: Pick<Question, "question_type">): boolean {
  return question.question_type === "match"
}

export function parseMatchOptions(options: unknown): MatchOptions {
  if (options && typeof options === "object" && !Array.isArray(options)) {
    const o = options as Record<string, unknown>
    const left = Array.isArray(o.left) ? o.left.map(String) : []
    const right = Array.isArray(o.right) ? o.right.map(String) : []
    return { left, right }
  }
  return { left: [], right: [] }
}

export function parseMatchCorrectAnswers(raw: unknown, leftCount: number): number[] {
  if (!Array.isArray(raw)) return []
  const out = raw
    .slice(0, leftCount)
    .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
    .filter((n) => Number.isInteger(n) && n >= 0)
  while (out.length < leftCount) out.push(-1)
  return out.slice(0, leftCount)
}

/** Points earned for one match question (partial credit per correct pair). */
export function scoreMatchAnswer(
  userMapping: number[],
  correctMapping: number[],
  pointsPerMatch: number,
): number {
  const n = correctMapping.length
  if (n === 0) return 0
  let correct = 0
  for (let i = 0; i < n; i++) {
    const expected = correctMapping[i]
    const got = userMapping[i]
    if (Number.isInteger(got) && got >= 0 && got === expected) {
      correct++
    }
  }
  return correct * pointsPerMatch
}

export function getMatchMaxPoints(question: Pick<Question, "options" | "correct_answers" | "points">): number {
  const { left } = parseMatchOptions(question.options)
  const sectionCount = left.length || parseMatchCorrectAnswers(question.correct_answers, 0).length
  return sectionCount * (Number(question.points) || 0)
}

export function isMatchAnswerComplete(userMapping: number[], sectionCount: number): boolean {
  if (sectionCount <= 0) return false
  if (userMapping.length < sectionCount) return false
  for (let i = 0; i < sectionCount; i++) {
    const v = userMapping[i]
    if (!Number.isInteger(v) || v < 0) return false
  }
  return true
}

export function normalizeMatchAnswers(raw: unknown, sectionCount: number): number[] {
  if (!Array.isArray(raw)) return Array(sectionCount).fill(-1)
  const out: number[] = []
  for (let i = 0; i < sectionCount; i++) {
    const v = raw[i]
    const n = typeof v === "number" ? v : parseInt(String(v), 10)
    out.push(Number.isInteger(n) && n >= 0 ? n : -1)
  }
  return out
}

/** Remove duplicate right indices (first slot wins). */
export function dedupeMatchMapping(mapping: number[]): number[] {
  const seen = new Set<number>()
  return mapping.map((val) => {
    if (!Number.isInteger(val) || val < 0) return -1
    if (seen.has(val)) return -1
    seen.add(val)
    return val
  })
}

/** Assign one right index to a slot and clear it from any other slot. */
export function assignMatchMapping(
  mapping: number[],
  slotIndex: number,
  rightIndex: number,
): number[] {
  return mapping.map((val, idx) => {
    if (idx === slotIndex) return rightIndex
    if (val === rightIndex) return -1
    return val
  })
}

export function isRightIndexAvailableForSlot(
  mapping: number[],
  rightIndex: number,
  slotIndex: number,
): boolean {
  return !mapping.some((val, idx) => idx !== slotIndex && val === rightIndex)
}
