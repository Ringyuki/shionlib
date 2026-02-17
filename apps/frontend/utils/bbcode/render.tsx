import React from 'react'
import { SpoilerText } from '@/components/shionui/SpoilerText'

export interface BBCodeOptions {
  newlineToBr?: boolean
}

type ReactNode = React.ReactNode
type SupportedTags =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'quote'
  | 'spoiler'
  | 'mask'
  // | 'color'
  // | 'size'
  | 'url'
  | 'urlWithLabel'
// | 'img'
// | 'list'
export const supportedTags: SupportedTags[] = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'quote',
  'spoiler',
  'mask',
  // 'color',
  // 'size',
  'url',
  'urlWithLabel',
  // 'img',
  // 'list',
] as const

export const bbcodeRender = (input: unknown, options: BBCodeOptions = {}): ReactNode => {
  const opts = {
    newlineToBr: true,
    ...options,
  }

  let text = String(input ?? '')

  if (!text.trim()) return null

  // store code blocks
  const codeStore: string[] = []

  // temporary protect code blocks
  text = text.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_m, body: string) => {
    const idx = codeStore.push(body) - 1
    return `__CODEBLOCK_${idx}__`
  })

  // parse BBCode and generate React element tree
  const parseSegment = (str: string, depth = 0): ReactNode => {
    if (depth > 50) return str // prevent infinite recursion

    // split by tags and process
    const patterns: { regex: RegExp; handler: SupportedTags }[] = [
      { regex: /(\[b\])([\s\S]*?)(\[\/b\])/i, handler: 'bold' },
      { regex: /(\[i\])([\s\S]*?)(\[\/i\])/i, handler: 'italic' },
      { regex: /(\[u\])([\s\S]*?)(\[\/u\])/i, handler: 'underline' },
      { regex: /(\[s\])([\s\S]*?)(\[\/s\])/i, handler: 'strikethrough' },
      { regex: /(\[quote\])([\s\S]*?)(\[\/quote\])/i, handler: 'quote' },
      { regex: /(\[spoiler\])([\s\S]*?)(\[\/spoiler\])/i, handler: 'spoiler' },
      { regex: /(\[mask\])([\s\S]*?)(\[\/mask\])/i, handler: 'mask' },
      // { regex: /(\[color=([#a-z0-9]+)\])([\s\S]*?)(\[\/color\])/i, handler: 'color' },
      // { regex: /(\[size=(\d{1,3})\])([\s\S]*?)(\[\/size\])/i, handler: 'size' },
      { regex: /(\[url\])([\s\S]*?)(\[\/url\])/i, handler: 'url' },
      { regex: /(\[url=([^\]]+?)\])([\s\S]*?)(\[\/url\])/i, handler: 'urlWithLabel' },
      // { regex: /(\[img\])([\s\S]*?)(\[\/img\])/i, handler: 'img' },
      // { regex: /(\[list(?:=(1))?\])([\s\S]*?)(\[\/list\])/i, handler: 'list' },
    ]

    // find the earliest tag
    let earliestMatch: { index: number; match: RegExpMatchArray; handler: SupportedTags } | null =
      null

    for (const { regex, handler } of patterns) {
      const match = str.match(regex)
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          earliestMatch = { index: match.index, match, handler }
        }
      }
    }

    if (!earliestMatch) {
      // no tags found, process pure text
      return processText(str)
    }

    const { index, match, handler } = earliestMatch
    const before = str.slice(0, index)
    const after = str.slice(index + match[0].length)

    const result: ReactNode[] = []

    // process content before the tag
    if (before) {
      result.push(processText(before))
    }

    const randomId = Math.random().toString(36).substring(2, 15)
    const key = `tag-${depth}-${index}-${randomId}`

    switch (handler) {
      case 'bold':
        result.push(
          <span key={key} className="font-bold">
            {parseSegment(match[2], depth + 1)}
          </span>,
        )
        break
      case 'italic':
        result.push(<em key={key}>{parseSegment(match[2], depth + 1)}</em>)
        break
      case 'underline':
        result.push(<u key={key}>{parseSegment(match[2], depth + 1)}</u>)
        break
      case 'strikethrough':
        result.push(<s key={key}>{parseSegment(match[2], depth + 1)}</s>)
        break
      case 'quote':
        result.push(
          <span
            className="my-3 border-l-4 border-muted-foreground/20 pl-4 text-muted-foreground"
            key={key}
          >
            {parseSegment(match[2], depth + 1)}
          </span>,
        )
        break
      case 'spoiler':
        result.push(
          <SpoilerText key={key} revealOn="click">
            {parseSegment(match[2], depth + 1)}
          </SpoilerText>,
        )
        break
      case 'mask':
        result.push(
          <SpoilerText key={key} revealOn="click">
            {parseSegment(match[2], depth + 1)}
          </SpoilerText>,
        )
        break
      // case 'color': {
      //   const color = match[2]
      //   const content = match[3]
      //   const safe = sanitizeColor(color)
      //   if (safe) {
      //     result.push(
      //       <span key={key} style={{ color: safe }}>
      //         {parseSegment(content, depth + 1)}
      //       </span>,
      //     )
      //   } else {
      //     result.push(parseSegment(content, depth + 1))
      //   }
      //   break
      // }
      // case 'size': {
      //   const size = match[2]
      //   const content = match[3]
      //   const px = clamp(parseInt(size, 10), 8, 64)
      //   result.push(
      //     <span key={key} style={{ fontSize: `${px}px` }}>
      //       {parseSegment(content, depth + 1)}
      //     </span>,
      //   )
      //   break
      // }
      case 'url': {
        const href = match[2]
        const safe = sanitizeUrl(href)
        if (safe) {
          result.push(
            <a key={key} className="bbcode-url" href={safe} target="_blank" rel="nofollow noopener">
              {href}
            </a>,
          )
        } else {
          result.push(href)
        }
        break
      }
      case 'urlWithLabel': {
        const href = match[2]
        const label = match[3]
        const safe = sanitizeUrl(href)
        if (safe) {
          result.push(
            <a key={key} className="bbcode-url" href={safe} target="_blank" rel="nofollow noopener">
              {parseSegment(label, depth + 1)}
            </a>,
          )
        } else {
          result.push(parseSegment(label, depth + 1))
        }
        break
      }
      // case 'img': {
      //   const src = match[2]
      //   const safe = sanitizeImageUrl(src)
      //   if (safe) {
      //     result.push(<img key={key} src={safe} alt="" loading="lazy" />)
      //   } else {
      //     result.push(src)
      //   }
      //   break
      // }
      // case 'list': {
      //   const orderedFlag = match[2]
      //   const content = match[3]
      //   const parts = content.split(/\[\*\]/g)
      //   const startsWithItem = /^\s*\[\*\]/.test(content)
      //   const items = parts
      //     .map(s => s.trim())
      //     .filter((s, i) => (startsWithItem ? s.length : i > 0 && s.length))

      //   if (items.length) {
      //     const Tag = orderedFlag === '1' ? 'ol' : 'ul'
      //     result.push(
      //       <Tag key={key}>
      //         {items.map((item, i) => (
      //           <li key={i}>{parseSegment(item, depth + 1)}</li>
      //         ))}
      //       </Tag>,
      //     )
      //   }
      //   break
      // }
    }

    // process content after the tag
    if (after) {
      const afterNodes = parseSegment(after, depth)
      if (Array.isArray(afterNodes)) {
        result.push(...afterNodes)
      } else {
        result.push(afterNodes)
      }
    }

    return result.length === 1 ? result[0] : result
  }

  // process pure text (newlines, code blocks, etc.)
  const processText = (str: string): ReactNode => {
    // restore code blocks
    str = str.replace(/__CODEBLOCK_(\d+)__/g, (_m, i: string) => {
      return `__CODE_${i}__` // temporary mark
    })

    if (opts.newlineToBr) {
      const lines = str.split(/\r?\n/)
      const result: ReactNode[] = []
      lines.forEach((line, i) => {
        // check if it's a code block
        const codeMatch = line.match(/__CODE_(\d+)__/)
        if (codeMatch) {
          const raw = codeStore[Number(codeMatch[1])] ?? ''
          const beforeCode = line.slice(0, codeMatch.index)
          const afterCode = line.slice(codeMatch.index! + codeMatch[0].length)

          if (beforeCode) result.push(beforeCode)
          result.push(
            <pre key={`code-${i}`}>
              <code>{raw}</code>
            </pre>,
          )
          if (afterCode) result.push(afterCode)

          if (i < lines.length - 1) result.push(<br key={`br-${i}`} />)
        } else {
          result.push(line)
          if (i < lines.length - 1) {
            result.push(<br key={`br-${i}`} />)
          }
        }
      })
      return result
    }

    // restore code blocks
    const parts: ReactNode[] = []
    const codeRegex = /__CODE_(\d+)__/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = codeRegex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index))
      }
      const raw = codeStore[Number(match[1])] ?? ''
      parts.push(
        <pre key={`code-${match.index}`}>
          <code>{raw}</code>
        </pre>,
      )
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < str.length) {
      parts.push(str.slice(lastIndex))
    }

    return parts.length === 1 ? parts[0] : parts
  }

  return parseSegment(text)
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

const sanitizeImageUrl = (u: string): string | null => {
  return sanitizeUrl(u)
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const sanitizeColor = (c: string): string | null => {
  const s = String(c).trim()
  return /^#([0-9a-f]{3,8})$/i.test(s) ? s : null
}
