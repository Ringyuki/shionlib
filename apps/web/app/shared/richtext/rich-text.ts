import type { Schema } from '~/shared/api/types'

export type RichDocument = Schema<'RichTextDocument'>

export type RichNode = Schema<'RichTextNode'>

export type RichMark = Schema<'RichTextMark'>

export type MarkKind = RichMark['type']

export const blankDocument: RichDocument = { type: 'doc', content: [{ type: 'paragraph' }] }

const lineEnd = '\n'

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
  return (node.content ?? []).map(child => nodeText(child, visible)).join('') + lineEnd
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

export function isBlank(document: RichDocument): boolean {
  return plainText(document).trim() === ''
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
