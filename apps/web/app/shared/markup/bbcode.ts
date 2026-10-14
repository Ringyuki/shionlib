import { vndbUrl } from '~/shared/catalog/vndb'

export type BBCodeStyle = 'bold' | 'italic' | 'underline' | 'strike' | 'quote' | 'spoiler'

export type BBCodeNode =
  | { kind: 'text'; text: string }
  | { kind: 'style'; style: BBCodeStyle; children: BBCodeNode[] }
  | { kind: 'link'; href: string; children: BBCodeNode[] }

type Frame = { tag: string; opening: string; value: string | undefined; children: BBCodeNode[] }

const styles: Partial<Record<string, BBCodeStyle>> = {
  b: 'bold',
  i: 'italic',
  u: 'underline',
  s: 'strike',
  quote: 'quote',
  spoiler: 'spoiler',
  mask: 'spoiler',
}
const unwrapped = new Set(['size', 'color'])
const valued = new Set(['url', 'size', 'color'])
const tagPattern = /\[(\/?)([a-z]+)(?:=([^\]\n]+))?\]/gi
const vndbEntry = /^\/[a-z]\d+(?:\.\d+)?(?:#\S*)?$/i
const webAddress = /^https?:\/\/\S+$/i

export function parseBBCode(source: string): BBCodeNode[] {
  const text = source.replace(/\r\n?/g, '\n')
  const root: Frame = { tag: '', opening: '', value: undefined, children: [] }
  const open: Frame[] = []
  const current = () => open.at(-1) ?? root
  let consumed = 0
  for (const match of text.matchAll(tagPattern)) {
    const [raw, slash, name = '', value] = match
    const tag = name.toLowerCase()
    const closing = slash === '/'
    if (!recognized(tag, closing, value)) {
      continue
    }
    appendText(current(), text.slice(consumed, match.index))
    consumed = match.index + raw.length
    const depth = closing ? open.findLastIndex(frame => frame.tag === tag) : -1
    if (!closing) {
      open.push({ tag, opening: raw, value, children: [] })
    } else if (depth === -1) {
      appendText(current(), raw)
    } else {
      const target = collapse(open.splice(depth))
      append(current(), target === undefined ? [] : close(target))
    }
  }
  appendText(current(), text.slice(consumed))
  const unclosed = collapse(open.splice(0))
  append(root, unclosed === undefined ? [] : unwound(unclosed))
  return root.children
}

export function bbcodePlainText(source: string): string {
  return plainText(parseBBCode(source))
}

function recognized(tag: string, closing: boolean, value: string | undefined): boolean {
  const known = styles[tag] !== undefined || tag === 'url' || unwrapped.has(tag)
  return known && (value === undefined || (!closing && valued.has(tag)))
}

function collapse(frames: readonly Frame[]): Frame | undefined {
  return frames.reduceRight<Frame | undefined>((inner, frame) => {
    if (inner !== undefined) {
      append(frame, unwound(inner))
    }
    return frame
  }, undefined)
}

function unwound(frame: Frame): BBCodeNode[] {
  return [{ kind: 'text', text: frame.opening }, ...frame.children]
}

function close(frame: Frame): BBCodeNode[] {
  const style = styles[frame.tag]
  if (style !== undefined) {
    const children = style === 'quote' ? trimmed(frame.children) : frame.children
    return [{ kind: 'style', style, children }]
  }
  const href =
    frame.tag === 'url' ? linkTarget(frame.value ?? plainText(frame.children)) : undefined
  return href === undefined ? frame.children : [{ kind: 'link', href, children: frame.children }]
}

function append(frame: Frame, nodes: readonly BBCodeNode[]) {
  for (const node of nodes) {
    if (node.kind === 'text') {
      appendText(frame, node.text)
    } else {
      frame.children.push(node)
    }
  }
}

function appendText(frame: Frame, text: string) {
  const last = frame.children.at(-1)
  const value = last?.kind === 'style' && last.style === 'quote' ? text.replace(/^\n/, '') : text
  if (value === '') {
    return
  }
  if (last?.kind === 'text') {
    last.text += value
  } else {
    frame.children.push({ kind: 'text', text: value })
  }
}

function trimmed(nodes: readonly BBCodeNode[]): BBCodeNode[] {
  const last = nodes.length - 1
  return nodes.flatMap<BBCodeNode>((node, index) => {
    if (node.kind !== 'text') {
      return [node]
    }
    const start = index === 0 ? node.text.replace(/^\n/, '') : node.text
    const text = index === last ? start.replace(/\n$/, '') : start
    return text === '' ? [] : [{ kind: 'text', text }]
  })
}

function isWebAddress(value: string): boolean {
  return webAddress.test(value.trim())
}

function linkTarget(raw: string): string | undefined {
  const target = raw.trim()
  if (vndbEntry.test(target)) {
    return vndbUrl(target)
  }
  return isWebAddress(target) ? target : undefined
}

function plainText(nodes: readonly BBCodeNode[]): string {
  return nodes
    .map(node => {
      if (node.kind === 'text') {
        return node.text
      }
      return node.kind === 'style' && node.style === 'spoiler' ? '' : plainText(node.children)
    })
    .join('')
}
