/** Turn a FastAPI `detail` (string or validation error list) into a message. */
export function formatApiDetail(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (item && typeof item === 'object' && 'msg' in item) {
        return String((item as { msg: unknown }).msg)
      }
      return JSON.stringify(item)
    })
    const joined = parts.filter(Boolean).join(' ')
    return joined || fallback
  }
  return fallback
}
