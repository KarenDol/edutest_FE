export type StemBlock =
  | { type: "text"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] }

const NUMBER_CELL = /^-?\d+(?:[.,]\d+)?%?$/

function cellsOf(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean)
}

function isMarkdownRow(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 2
}

function isMarkdownSeparator(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.includes("-") && /^[|\s:-]+$/.test(trimmed)
}

function markdownCells(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1)
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1)
  return trimmed.split("|").map((cell) => cell.trim())
}

/** A run of equal-width lines whose body is mostly numbers, e.g. a bill table flattened to text. */
function plainTable(lines: string[]): { headers: string[]; rows: string[][] } | null {
  if (lines.length < 3) return null
  const parsed = lines.map(cellsOf)
  const width = parsed[0].length
  if (width < 3 || width > 8) return null
  if (parsed.some((row) => row.length !== width)) return null
  if (parsed.some((row) => row.some((cell) => cell.length > 32))) return null
  const headerNumbers = parsed[0].filter((cell) => NUMBER_CELL.test(cell)).length
  if (headerNumbers > width / 2) return null
  const data = parsed.slice(1)
  const dataCells = data.flat()
  const numeric = dataCells.filter((cell) => NUMBER_CELL.test(cell)).length
  if (numeric < dataCells.length * 0.5) return null
  if (!data.every((row) => row.some((cell) => NUMBER_CELL.test(cell)))) return null
  return { headers: parsed[0], rows: data }
}

function plainTableAt(lines: string[], start: number): { table: StemBlock; next: number } | null {
  if (!lines[start]?.trim()) return null
  const width = cellsOf(lines[start]).length
  if (width < 3 || width > 8) return null
  const run = [lines[start]]
  let next = start + 1
  while (next < lines.length && lines[next].trim() && cellsOf(lines[next]).length === width) {
    run.push(lines[next])
    next += 1
  }
  const table = plainTable(run)
  if (!table) return null
  return { table: { type: "table", ...table }, next }
}

export function splitStemBlocks(raw: string): StemBlock[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n")
  const blocks: StemBlock[] = []
  const buffer: string[] = []

  const flush = () => {
    const joined = buffer.join("\n").trim()
    buffer.length = 0
    if (joined) blocks.push({ type: "text", text: joined })
  }

  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (isMarkdownRow(line) && index + 1 < lines.length && isMarkdownSeparator(lines[index + 1])) {
      const headers = markdownCells(line)
      const rows: string[][] = []
      let next = index + 2
      while (next < lines.length && isMarkdownRow(lines[next])) {
        const cells = markdownCells(lines[next])
        if (cells.length === headers.length) rows.push(cells)
        next += 1
      }
      if (headers.length >= 2 && rows.length >= 1) {
        flush()
        blocks.push({ type: "table", headers, rows })
        index = next
        continue
      }
    }

    const plain = plainTableAt(lines, index)
    if (plain) {
      flush()
      blocks.push(plain.table)
      index = plain.next
      continue
    }

    buffer.push(line)
    index += 1
  }
  flush()
  return blocks
}

export function stemHasTable(text: string): boolean {
  return splitStemBlocks(text).some((block) => block.type === "table")
}
