import { parseBBCode, type BBCodeNode } from './bbcode'

export type LexicalNode = {
  type: string
  text?: string | null
  format?: number | string | null
  url?: string | null
  children?: LexicalNode[] | null
}

type Written =
  | { type: 'text'; version: 1; text: string; format: number; detail: 0; mode: 'normal'; style: '' }
  | { type: 'linebreak'; version: 1 }
  | WrittenElement

type WrittenElement = {
  type: 'root' | 'paragraph' | 'quote' | 'spoiler' | 'link'
  version: 1
  children: Written[]
  direction: null
  format: ''
  indent: 0
  url?: string
  rel?: null
  target?: null
  title?: null
}

export type LexicalDocument = { root: WrittenElement }

type Run = {
  text: string
  format: number
  spoiler: boolean
  href: string | undefined
  quoted: boolean
}

type Line = { quoted: boolean; runs: Run[] }

const formatBits = { bold: 1, italic: 2, strike: 4, underline: 8 } as const

const formatTags = [
  ['b', formatBits.bold],
  ['i', formatBits.italic],
  ['s', formatBits.strike],
  ['u', formatBits.underline],
] as const

const plain: Omit<Run, 'text'> = { format: 0, spoiler: false, href: undefined, quoted: false }

export function lexicalDocument(source: string): LexicalDocument {
  return { root: element('root', blocksOf(linesOf(runsOf(parseBBCode(source.trim()), plain)))) }
}

export function bbcodeSource(root: LexicalNode): string {
  return (root.children ?? []).map(blockSource).join('\n').trim()
}

function runsOf(nodes: readonly BBCodeNode[], context: Omit<Run, 'text'>): Run[] {
  return nodes.flatMap(node => {
    if (node.kind === 'text') {
      return [{ ...context, text: node.text }]
    }
    if (node.kind === 'link') {
      return runsOf(node.children, { ...context, href: node.href })
    }
    if (node.style === 'quote') {
      return runsOf(node.children, { ...context, quoted: true })
    }
    if (node.style === 'spoiler') {
      return runsOf(node.children, { ...context, spoiler: true })
    }
    return runsOf(node.children, { ...context, format: context.format | formatBits[node.style] })
  })
}

function linesOf(runs: readonly Run[]): Line[] {
  const lines: Line[] = []
  let line: Line | undefined
  for (const run of runs) {
    const [first = '', ...rest] = run.text.split('\n')
    if (line === undefined) {
      line = { quoted: run.quoted, runs: [] }
      lines.push(line)
    } else if (line.quoted !== run.quoted) {
      if (line.runs.length === 0) {
        line.quoted = run.quoted
      } else {
        line = { quoted: run.quoted, runs: [] }
        lines.push(line)
      }
    }
    if (first !== '') {
      line.runs.push({ ...run, text: first })
    }
    for (const text of rest) {
      line = { quoted: run.quoted, runs: text === '' ? [] : [{ ...run, text }] }
      lines.push(line)
    }
  }
  return lines
}

function blocksOf(lines: readonly Line[]): Written[] {
  const blocks: Written[] = []
  let quote: Written[] | undefined
  for (const line of lines) {
    if (!line.quoted) {
      quote = undefined
      blocks.push(element('paragraph', inlineOf(line.runs)))
    } else if (quote === undefined) {
      quote = inlineOf(line.runs)
      blocks.push(element('quote', quote))
    } else {
      quote.push({ type: 'linebreak', version: 1 }, ...inlineOf(line.runs))
    }
  }
  return blocks.length === 0 ? [element('paragraph', [])] : blocks
}

function inlineOf(runs: readonly Run[]): Written[] {
  return chunked(runs, run => run.spoiler).flatMap(([hidden, group]) =>
    hidden ? [element('spoiler', linkedOf(group))] : linkedOf(group),
  )
}

function linkedOf(runs: readonly Run[]): Written[] {
  return chunked(runs, run => run.href).flatMap(([href, group]) => {
    const texts = group.map(textOf)
    return href === undefined
      ? texts
      : [{ ...element('link', texts), url: href, rel: null, target: null, title: null }]
  })
}

function textOf(run: Run): Written {
  return {
    type: 'text',
    version: 1,
    text: run.text,
    format: run.format,
    detail: 0,
    mode: 'normal',
    style: '',
  }
}

function element(type: WrittenElement['type'], children: Written[]): WrittenElement {
  return { type, version: 1, children, direction: null, format: '', indent: 0 }
}

function chunked<Item, Key>(items: readonly Item[], keyOf: (item: Item) => Key): [Key, Item[]][] {
  const chunks: [Key, Item[]][] = []
  for (const item of items) {
    const key = keyOf(item)
    const last = chunks.at(-1)
    if (last !== undefined && last[0] === key) {
      last[1].push(item)
    } else {
      chunks.push([key, [item]])
    }
  }
  return chunks
}

function blockSource(node: LexicalNode): string {
  if (node.type === 'quote') {
    return `[quote]${inlineSource(node)}[/quote]`
  }
  if (node.type === 'heading') {
    const title = inlineSource(node)
    return title === '' ? '' : `[b]${title}[/b]`
  }
  if (node.type === 'list' || node.type === 'table' || node.type === 'tablerow') {
    return (node.children ?? []).map(blockSource).join('\n')
  }
  return inlineSource(node)
}

function inlineSource(node: LexicalNode): string {
  return (node.children ?? [])
    .map(child => {
      if (child.type === 'linebreak') {
        return '\n'
      }
      if (child.type === 'text' || child.children == null) {
        return styledSource(child.text ?? '', child.format)
      }
      if (child.type === 'spoiler') {
        return `[spoiler]${inlineSource(child)}[/spoiler]`
      }
      if (child.type === 'link' || child.type === 'autolink') {
        return linkSource(inlineSource(child), (child.url ?? '').trim())
      }
      return blockSource(child)
    })
    .join('')
}

function styledSource(text: string, format: LexicalNode['format']): string {
  const bits = typeof format === 'number' ? format : 0
  return formatTags.reduce(
    (source, [tag, bit]) =>
      (bits & bit) === 0 || text === '' ? source : `[${tag}]${source}[/${tag}]`,
    text,
  )
}

function linkSource(label: string, url: string): string {
  if (url === '') {
    return label
  }
  return label === url ? `[url]${url}[/url]` : `[url=${url}]${label}[/url]`
}
