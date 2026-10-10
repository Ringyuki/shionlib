import type { Schema } from '~/shared/api/types'

export type RichDocument = Schema<'RichTextDocument'>

export type RichNode = Schema<'RichTextNode'>

export type RichMark = Schema<'RichTextMark'>

export type NodeKind = RichNode['type']

export type MarkKind = RichMark['type']

export type HeadingLevel = NonNullable<NonNullable<RichNode['attrs']>['level']>

export type RichSection = { id: string; level: HeadingLevel; title: string }

export const blankDocument: RichDocument = { type: 'doc', content: [{ type: 'paragraph' }] }

const firstHeadingLevel: HeadingLevel = 2

const lineEnd = '\n'

const textBlocks: ReadonlySet<NodeKind> = new Set(['paragraph', 'heading'])

export function headingLevel(node: RichNode): HeadingLevel {
  return node.attrs?.level ?? firstHeadingLevel
}

export type Picture = {
  src: string
  alt: string
  caption: string
  width: number
  height: number
  widthPercent: number
}

export type CellAlign = NonNullable<NonNullable<RichNode['attrs']>['align']>

const wholeColumn = 100

export function pictureOf(node: RichNode): Picture {
  const { src = '', alt = '', caption = '', width = 0, height = 0 } = node.attrs ?? {}
  return {
    src,
    alt,
    caption,
    width,
    height,
    widthPercent: node.attrs?.width_percent ?? wholeColumn,
  }
}

export function alignOf(node: RichNode): CellAlign | undefined {
  return node.attrs?.align ?? undefined
}

export function columnWidths(table: RichNode): number[] {
  const cells = table.content?.[0]?.content ?? []
  const widths = cells.flatMap(cell => {
    const span = cell.attrs?.colspan ?? 1
    const known = cell.attrs?.colwidth ?? []
    return Array.from({ length: span }, (_, index) => known[index] ?? 0)
  })
  return widths.every(width => width > 0) ? widths : []
}

export function linkOf(marks: readonly RichMark[] | undefined): string | undefined {
  return marks?.find(mark => mark.type === 'link')?.attrs?.href
}

export function hasMark(marks: readonly RichMark[] | undefined, kind: MarkKind): boolean {
  return marks?.some(mark => mark.type === kind) === true
}

function nodeText(node: RichNode, visible: (node: RichNode) => boolean): string {
  if (node.type === 'text') {
    return visible(node) ? (node.text ?? '') : ''
  }
  if (node.type === 'hard_break') {
    return lineEnd
  }
  if (node.type === 'image_block') {
    const caption = node.attrs?.caption ?? ''
    return caption === '' ? '' : caption + lineEnd
  }
  const inner = (node.content ?? []).map(child => nodeText(child, visible)).join('')
  return textBlocks.has(node.type) ? inner + lineEnd : inner
}

function documentText(document: RichDocument, visible: (node: RichNode) => boolean): string {
  return document.content
    .map(node => nodeText(node, visible))
    .join('')
    .replace(/\n+$/, '')
}

export function plainText(document: RichDocument): string {
  return documentText(document, () => true)
}

export function publicText(document: RichDocument): string {
  return documentText(document, node => !hasMark(node.marks, 'spoiler'))
}

function nodeLength(node: RichNode): number {
  const own = node.text?.length ?? 0
  return (node.content ?? []).reduce((total, child) => total + nodeLength(child), own)
}

export function textLength(document: RichDocument): number {
  return document.content.reduce((total, node) => total + nodeLength(node), 0)
}

export function isBlank(document: RichDocument): boolean {
  return plainText(document).trim() === ''
}

export function sectionId(index: number): string {
  return `section-${index + 1}`
}

export function sectionsOf(document: RichDocument): RichSection[] {
  return document.content
    .filter(node => node.type === 'heading')
    .map((node, index) => ({
      id: sectionId(index),
      level: headingLevel(node),
      title: nodeText(node, () => true).trim(),
    }))
}

export type InlineRun = { key: string | undefined; nodes: RichNode[] }

export function inlineRuns(
  nodes: readonly RichNode[],
  keyOf: (node: RichNode) => string | undefined,
): InlineRun[] {
  const runs: InlineRun[] = []
  for (const node of nodes) {
    const key = keyOf(node)
    const last = runs.at(-1)
    if (last !== undefined && last.key === key) {
      last.nodes.push(node)
    } else {
      runs.push({ key, nodes: [node] })
    }
  }
  return runs
}

export function sameDocument(left: RichDocument, right: RichDocument): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right)
}
