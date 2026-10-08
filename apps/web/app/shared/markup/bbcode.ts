import { vndbUrl } from '~/shared/catalog/vndb'

export type BBCodeStyle = 'bold' | 'italic' | 'underline' | 'strike' | 'quote' | 'spoiler'

export type BBCodeHeadingLevel = 2 | 3

export type BBCodeNode =
  | { kind: 'text'; text: string }
  | { kind: 'style'; style: BBCodeStyle; children: BBCodeNode[] }
  | { kind: 'link'; href: string; children: BBCodeNode[] }
  | { kind: 'heading'; level: BBCodeHeadingLevel; children: BBCodeNode[] }
  | { kind: 'list'; ordered: boolean; items: BBCodeNode[][] }

export type BBCodeSection = { id: string; level: BBCodeHeadingLevel; title: string }

type Frame = {
  tag: string
  opening: string
  value: string | undefined
  children: BBCodeNode[]
  items: BBCodeNode[][]
}

const styles: Partial<Record<string, BBCodeStyle>> = {
  b: 'bold',
  i: 'italic',
  u: 'underline',
  s: 'strike',
  quote: 'quote',
  spoiler: 'spoiler',
  mask: 'spoiler',
}
const headings: Partial<Record<string, BBCodeHeadingLevel>> = { h2: 2, h3: 3 }
const listTag = 'list'
const itemTag = '*'
const unwrapped = new Set(['size', 'color'])
const valued = new Set(['url', 'size', 'color', listTag])
const tagPattern = /\[(\/?)([a-z][a-z0-9]*|\*)(?:=([^\]\n]+))?\]/gi
const vndbEntry = /^\/[a-z]\d+(?:\.\d+)?(?:#\S*)?$/i
const webAddress = /^https?:\/\/\S+$/i

export function parseBBCode(source: string): BBCodeNode[] {
  const text = source.replace(/\r\n?/g, '\n')
  const root = frameOf('', '', undefined)
  const open: Frame[] = []
  const current = () => open.at(-1) ?? root
  let consumed = 0
  for (const match of text.matchAll(tagPattern)) {
    const [raw, slash, name = '', value] = match
    const tag = name.toLowerCase()
    const closing = slash === '/'
    const listed = open.findLastIndex(frame => frame.tag === listTag)
    if (!recognized(tag, closing, value) || (tag === itemTag && listed === -1)) {
      continue
    }
    appendText(current(), text.slice(consumed, match.index))
    consumed = match.index + raw.length
    if (tag === itemTag) {
      const list = open[listed]
      const unclosed = collapse(open.splice(listed + 1))
      if (list !== undefined) {
        append(list, unclosed === undefined ? [] : unwound(unclosed))
        list.items.push(list.children)
        list.children = []
      }
      continue
    }
    const depth = closing ? open.findLastIndex(frame => frame.tag === tag) : -1
    if (!closing) {
      open.push(frameOf(tag, raw, value))
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

export function bbcodeSections(nodes: readonly BBCodeNode[]): BBCodeSection[] {
  return nodes
    .flatMap(node => (node.kind === 'heading' ? [node] : []))
    .map((node, index) => ({
      id: `section-${index + 1}`,
      level: node.level,
      title: plainText(node.children).trim(),
    }))
}

function frameOf(tag: string, opening: string, value: string | undefined): Frame {
  return { tag, opening, value, children: [], items: [] }
}

function recognized(tag: string, closing: boolean, value: string | undefined): boolean {
  if (tag === itemTag) {
    return !closing && value === undefined
  }
  const known =
    styles[tag] !== undefined ||
    headings[tag] !== undefined ||
    tag === 'url' ||
    tag === listTag ||
    unwrapped.has(tag)
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
  const level = headings[frame.tag]
  if (level !== undefined) {
    return [{ kind: 'heading', level, children: trimmed(frame.children) }]
  }
  if (frame.tag === listTag) {
    const items = [...frame.items, frame.children]
      .map(trimmed)
      .filter(item => plainText(item).trim() !== '')
    return items.length === 0 ? [] : [{ kind: 'list', ordered: frame.value !== undefined, items }]
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
  const value = last !== undefined && isBlock(last) ? text.replace(/^\n/, '') : text
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

export function isWebAddress(value: string): boolean {
  return webAddress.test(value.trim())
}

function linkTarget(raw: string): string | undefined {
  const target = raw.trim()
  if (vndbEntry.test(target)) {
    return vndbUrl(target)
  }
  return isWebAddress(target) ? target : undefined
}

function isBlock(node: BBCodeNode): boolean {
  return (
    node.kind === 'heading' ||
    node.kind === 'list' ||
    (node.kind === 'style' && node.style === 'quote')
  )
}

function plainText(nodes: readonly BBCodeNode[]): string {
  return nodes
    .map(node => {
      if (node.kind === 'text') {
        return node.text
      }
      if (node.kind === 'list') {
        return `${node.items.map(plainText).join('\n')}\n`
      }
      if (node.kind === 'heading') {
        return `${plainText(node.children)}\n`
      }
      return node.kind === 'style' && node.style === 'spoiler' ? '' : plainText(node.children)
    })
    .join('')
}
