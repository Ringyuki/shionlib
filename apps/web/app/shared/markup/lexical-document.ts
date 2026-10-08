import { parseBBCode, type BBCodeNode } from './bbcode'
import { formatBits } from './lexical'

type Written =
  | { type: 'text'; version: 1; text: string; format: number; detail: 0; mode: 'normal'; style: '' }
  | { type: 'linebreak'; version: 1 }
  | WrittenElement

type WrittenElement = {
  type: 'root' | 'paragraph' | 'quote' | 'heading' | 'list' | 'listitem' | 'spoiler' | 'link'
  version: 1
  children: Written[]
  direction: null
  format: ''
  indent: 0
  url?: string
  rel?: null
  target?: null
  title?: null
  tag?: 'h2' | 'h3' | 'ul' | 'ol'
  listType?: 'bullet' | 'number'
  start?: 1
  value?: number
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

const plain: Omit<Run, 'text'> = { format: 0, spoiler: false, href: undefined, quoted: false }

const lineBreak: Written = { type: 'linebreak', version: 1 }

export function lexicalDocument(source: string): LexicalDocument {
  const blocks: Written[] = []
  let flowing: BBCodeNode[] = []
  const flush = (beforeBlock: boolean) => {
    const last = flowing.at(-1)
    if (beforeBlock && last?.kind === 'text') {
      const text = last.text.replace(/\n$/, '')
      flowing = [...flowing.slice(0, -1), ...(text === '' ? [] : [{ kind: 'text' as const, text }])]
    }
    blocks.push(...blocksOf(linesOf(runsOf(flowing, plain))))
    flowing = []
  }
  for (const node of parseBBCode(source.trim())) {
    if (node.kind === 'heading') {
      flush(true)
      blocks.push({ ...element('heading', brokenOf(node.children)), tag: `h${node.level}` })
    } else if (node.kind === 'list') {
      flush(true)
      blocks.push(listOf(node.items, node.ordered))
    } else {
      flowing.push(node)
    }
  }
  flush(false)
  return { root: element('root', blocks.length === 0 ? [element('paragraph', [])] : blocks) }
}

function listOf(items: readonly BBCodeNode[][], ordered: boolean): WrittenElement {
  return {
    ...element(
      'list',
      items.map((item, at) => ({ ...element('listitem', brokenOf(item)), value: at + 1 })),
    ),
    listType: ordered ? 'number' : 'bullet',
    tag: ordered ? 'ol' : 'ul',
    start: 1,
  }
}

function runsOf(nodes: readonly BBCodeNode[], context: Omit<Run, 'text'>): Run[] {
  return nodes.flatMap(node => {
    if (node.kind === 'text') {
      return [{ ...context, text: node.text }]
    }
    if (node.kind === 'link') {
      return runsOf(node.children, { ...context, href: node.href })
    }
    if (node.kind === 'heading') {
      return runsOf(node.children, context)
    }
    if (node.kind === 'list') {
      return node.items.flatMap((item, at) => [
        ...(at === 0 ? [] : [{ ...context, text: '\n' }]),
        ...runsOf(item, context),
      ])
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
      quote.push(lineBreak, ...inlineOf(line.runs))
    }
  }
  return blocks
}

function brokenOf(nodes: readonly BBCodeNode[]): Written[] {
  return linesOf(runsOf(nodes, plain)).flatMap((line, at) => [
    ...(at === 0 ? [] : [lineBreak]),
    ...inlineOf(line.runs),
  ])
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
