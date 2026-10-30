/** Real line breaks, and one backslash per LaTeX command. */
export function restoreLiteralNewlines(text: string): string {
  if (!text.includes("\\") && !text.includes("$")) return text
  let s = text.replace(/\\{2,}(?=[A-Za-z])/g, "\\")
  // Drop the empty {} that was inserted only to end a command name.
  s = s.replace(/(\\[A-Za-z]+)\{\}(?=\s)/g, "$1")
  if (s.includes("\\n") || s.includes("\\r")) {
    s = s.replace(/\\r(?![a-z])/g, "").replace(/\\n(?![a-z])/g, "\n")
  }
  return s
}
