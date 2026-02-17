import React from 'react'
import { ImageLightbox } from '@/components/shionui/ImageLightbox'

export interface MarkdownOptions {
  newlineToBr?: boolean
}

type ReactNode = React.ReactNode

export const markdownRender = (input: unknown, options: MarkdownOptions = {}): ReactNode => {
  const opts = {
    newlineToBr: true,
    ...options,
  }

  let text = String(input ?? '')
  if (!text.trim()) return null

  // store fenced code blocks (```lang\n...\n```)
  const codeStore: Array<{ lang: string | null; code: string }> = []
  text = text.replace(/```([a-z0-9_-]+)?\s*\n([\s\S]*?)```/gi, (_m, lang: string, body: string) => {
    const idx = codeStore.push({ lang: lang || null, code: body }) - 1
    return `__CODEBLOCK_${idx}__`
  })

  // normalize newlines
  text = text.replace(/\r\n?/g, '\n')

  // block-level parsing: headings, hr, blockquote, lists
  const lines = text.split('\n')
  const blocks: ReactNode[] = []

  const flushParagraph = (buffer: string[]) => {
    if (buffer.length === 0) return
    const content = buffer.join('\n')
    blocks.push(renderParagraph(content, opts.newlineToBr))
    buffer.length = 0
  }

  const renderParagraph = (raw: string, newlineToBr: boolean): ReactNode => {
    const id = Math.random().toString(36).slice(2, 8)
    const lines = raw.split('\n')
    const children: ReactNode[] = []
    lines.forEach((line, idx) => {
      const lineWithoutTrailingBackslash = line.endsWith('\\') ? line.slice(0, -1) : line
      const processed = processInline(lineWithoutTrailingBackslash)
      if (Array.isArray(processed)) {
        children.push(...processed)
      } else {
        children.push(processed)
      }
      if (newlineToBr && idx < lines.length - 1) {
        children.push(<br key={`pbr-${id}-${idx}`} />)
      }
    })
    return <p key={`p-${id}`}>{children}</p>
  }
  // helpers for lists and blockquotes
  const parseList = (startIndex: number) => {
    const items: { text: string }[] = []
    let i = startIndex
    const firstLine = lines[i]
    const ordered = /^\s*\d+\.\s+/.test(firstLine)
    const regex = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/
    for (; i < lines.length; i++) {
      const m = lines[i].match(regex)
      if (!m) break
      items.push({ text: m[1] })
    }
    const node = ordered ? (
      <ol key={`ol-${startIndex}`}>
        {items.map((it, idx) => (
          <li key={idx}>{processInline(it.text)}</li>
        ))}
      </ol>
    ) : (
      <ul key={`ul-${startIndex}`}>
        {items.map((it, idx) => (
          <li key={idx}>{processInline(it.text)}</li>
        ))}
      </ul>
    )
    return { nextIndex: i, node }
  }

  const parseBlockquote = (startIndex: number) => {
    const buf: string[] = []
    let i = startIndex
    for (; i < lines.length; i++) {
      const m = lines[i].match(/^\s*>\s?(.*)$/)
      if (!m) break
      buf.push(m[1])
    }
    const content = buf.join('\n')
    const node = (
      <blockquote
        key={`blockquote-${startIndex}`}
        className="my-3 border-l-4 border-muted-foreground/20 pl-4 text-muted-foreground"
      >
        {renderParagraph(content, true)}
      </blockquote>
    )
    return { nextIndex: i, node }
  }

  const paragraphBuffer: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // horizontal rule
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushParagraph(paragraphBuffer)
      blocks.push(<hr key={`hr-${i}`} />)
      i++
      continue
    }

    // heading
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/)
    if (h) {
      flushParagraph(paragraphBuffer)
      const level = Math.min(6, h[1].length)
      blocks.push(React.createElement(`h${level}`, { key: `h-${i}` }, processInline(h[2])))
      i++
      continue
    }

    // code block placeholder line (single line containing placeholder)
    const codeMatch = line.match(/^(__CODEBLOCK_(\d+)__)$/)
    if (codeMatch) {
      flushParagraph(paragraphBuffer)
      const info = codeStore[Number(codeMatch[2])]
      const code = info?.code ?? ''
      blocks.push(
        <pre key={`code-${i}`}>
          <code>{code}</code>
        </pre>,
      )
      i++
      continue
    }

    // blockquote group
    if (/^\s*>/.test(line)) {
      flushParagraph(paragraphBuffer)
      const { nextIndex, node } = parseBlockquote(i)
      blocks.push(node)
      i = nextIndex
      continue
    }

    // list group
    if (/^\s*(?:[-*+]\s+|\d+\.\s+)/.test(line)) {
      flushParagraph(paragraphBuffer)
      const { nextIndex, node } = parseList(i)
      blocks.push(node)
      i = nextIndex
      continue
    }

    // blank line: end paragraph
    if (/^\s*$/.test(line)) {
      flushParagraph(paragraphBuffer)
      i++
      continue
    }

    // normal paragraph line
    paragraphBuffer.push(line)
    i++
  }
  flushParagraph(paragraphBuffer)

  // Inline processor (recursive, earliest-match)
  function processInline(str: string, depth = 0): ReactNode {
    if (depth > 50 || !str) return str

    // restore inline code placeholders that may be inlined into text
    str = str.replace(/__CODEBLOCK_(\d+)__/g, (_m, idx: string) => `__CODE_${idx}__`)

    const patterns: Array<{
      regex: RegExp
      type: 'inlineCode' | 'image' | 'link' | 'bold' | 'italic' | 'strike'
    }> = [
      { regex: /`([^`]+?)`/, type: 'inlineCode' },
      { regex: /!\[([^\]]*)\]\(([^)]+?)\)/, type: 'image' },
      { regex: /\[([^\]]+?)\]\(([^)]+?)\)/, type: 'link' },
      { regex: /(\*\*|__)([\s\S]+?)\1/, type: 'bold' },
      { regex: /(\*|_)([\s\S]+?)\1/, type: 'italic' },
      { regex: /~~([\s\S]+?)~~/, type: 'strike' },
    ]

    // find earliest match
    let earliest: null | {
      index: number
      match: RegExpMatchArray
      type: (typeof patterns)[number]['type']
    } = null
    for (const p of patterns) {
      const m = str.match(p.regex)
      if (m && m.index !== undefined) {
        if (!earliest || m.index < earliest.index) {
          earliest = { index: m.index, match: m, type: p.type }
        }
      }
    }
    if (!earliest) {
      // handle restored code blocks placeholders inside inline text
      const parts: ReactNode[] = []
      const codeRegex = /__CODE_(\d+)__/g
      let last = 0
      let m: RegExpExecArray | null
      while ((m = codeRegex.exec(str)) !== null) {
        if (m.index > last) parts.push(str.slice(last, m.index))
        const info = codeStore[Number(m[1])]
        const code = info?.code ?? ''
        parts.push(<code key={`icode-${m.index}`}>{code}</code>)
        last = m.index + m[0].length
      }
      if (last < str.length) parts.push(str.slice(last))
      return parts.length === 1 ? parts[0] : parts
    }

    const { index, match, type } = earliest
    const before = str.slice(0, index)
    const after = str.slice(index + match[0].length)
    const randomId = Math.random().toString(36).substring(2, 10)
    const key = `md-${depth}-${index}-${randomId}`

    const out: ReactNode[] = []
    if (before) out.push(processInline(before, depth + 1))

    switch (type) {
      case 'inlineCode': {
        out.push(<code key={key}>{match[1]}</code>)
        break
      }
      case 'image': {
        const alt = match[1] ?? ''
        const src = sanitizeUrl(extractImageUrl(match[2]))
        if (src) {
          out.push(
            <span className="block py-2" key={key}>
              <ImageLightbox
                wrapElement="span"
                src={src}
                alt={alt}
                aspectRatio="16 / 9"
                autoAspectRatio={true}
                className="max-w-64 max-h-64 rounded-md overflow-hidden"
                imageClassName="max-w-64 max-h-64 rounded-md overflow-hidden"
              />
            </span>,
          )
        } else {
          out.push(`![${alt}](${match[2]})`)
        }
        break
      }
      case 'link': {
        const label = match[1]
        const href = sanitizeUrl(match[2])
        if (href) {
          out.push(
            <a key={key} className="bbcode-url" href={href} target="_blank" rel="nofollow noopener">
              {processInline(label, depth + 1)}
            </a>,
          )
        } else {
          out.push(processInline(label, depth + 1))
        }
        break
      }
      case 'bold': {
        out.push(
          <span key={key} className="font-bold">
            {processInline(match[2], depth + 1)}
          </span>,
        )
        break
      }
      case 'italic': {
        out.push(<em key={key}>{processInline(match[2], depth + 1)}</em>)
        break
      }
      case 'strike': {
        out.push(<s key={key}>{processInline(match[1], depth + 1)}</s>)
        break
      }
    }

    if (after) out.push(processInline(after, depth + 1))
    return out.length === 1 ? out[0] : out
  }

  return blocks.length === 1 ? blocks[0] : blocks
}

const decodeHtmlEntities = (s: string): string => {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

const extractImageUrl = (dest: string): string => {
  let d = decodeHtmlEntities(String(dest || '').trim())
  d = d.replace(/<[^>]*>/g, '')
  const m = d.match(/^<?([^\s>]+)>?(?:\s+(['"])[\s\S]*?\2)?\s*$/)
  const url = m ? m[1] : d
  return url.replace(/^['"]|['"]$/g, '')
}

const sanitizeUrl = (u: string): string | null => {
  const url = String(u).trim()
  if (/^(https?:|mailto:|tel:|\/)/i.test(url)) {
    try {
      return url.replace(/\s+/g, '')
    } catch {
      return null
    }
  }
  return null
}
