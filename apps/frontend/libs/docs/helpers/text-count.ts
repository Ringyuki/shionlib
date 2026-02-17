import { markdownToText } from '@/utils/markdown-to-text'

export const calcTextCount = (text: string, frontmatter?: { [key: string]: any }) => {
  let count = markdownToText(text).length
  if (frontmatter) count -= calcFrontmatterTextCount(frontmatter)
  return count < 0 ? 0 : count
}

const calcFrontmatterTextCount = (frontmatter: { [key: string]: any } | undefined) => {
  try {
    if (!frontmatter || typeof frontmatter !== 'object') return 0

    const lines = Object.entries(frontmatter)
      .map(([key, value]) => {
        if (value === undefined || value === null) return ''

        let valueString = ''
        if (value instanceof Date) {
          valueString =
            typeof value.toISOString === 'function' ? value.toISOString() : String(value)
        } else if (Array.isArray(value)) {
          valueString = value.map(v => String(v)).join(', ')
        } else if (typeof value === 'object') {
          valueString = Object.values(value as Record<string, unknown>)
            .map(v => String(v))
            .join(', ')
        } else {
          valueString = String(value)
        }

        const processedValue = markdownToText(valueString)
        return `${key}: ${processedValue}`
      })
      .filter(Boolean)

    const text = lines.join('\n').trim()
    return text.length
  } catch {
    return 0
  }
}
