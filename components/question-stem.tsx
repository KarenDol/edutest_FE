"use client"

import { MixedMathText } from "@/components/mixed-math-text"
import { splitStemBlocks } from "@/lib/question-stem"
import { restoreLiteralNewlines } from "@/lib/text-breaks"
import { cn } from "@/lib/utils"

function hasMath(text: string): boolean {
  return text.includes("$") || text.includes("\\(") || text.includes("\\[")
}

function StemTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="my-1 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[0.95em]">
        <thead>
          <tr>
            {headers.map((cell, index) => (
              <th
                key={index}
                className="border border-border bg-muted/60 px-3 py-1.5 font-semibold whitespace-nowrap"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border border-border px-3 py-1.5 whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Question wording, with a real table when the stem contains one. */
export function QuestionStem({
  text,
  className,
  math = false,
}: {
  text: string
  className?: string
  math?: boolean
}) {
  const blocks = splitStemBlocks(restoreLiteralNewlines(text))
  if (blocks.length === 1 && blocks[0].type === "text") {
    if (math || hasMath(blocks[0].text)) {
      return <MixedMathText text={blocks[0].text} className={className} />
    }
    return <span className={cn("whitespace-pre-wrap", className)}>{blocks[0].text}</span>
  }

  return (
    <div className={cn("space-y-3", className)}>
      {blocks.map((block, index) =>
        block.type === "table" ? (
          <StemTable key={index} headers={block.headers} rows={block.rows} />
        ) : math || hasMath(block.text) ? (
          <MixedMathText key={index} text={block.text} />
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            {block.text}
          </p>
        ),
      )}
    </div>
  )
}
