import type { Editor } from '@tiptap/core'
import type { Node as DocumentNode } from '@tiptap/pm/model'
import { CellSelection, columnIsHeader, rowIsHeader, TableMap } from '@tiptap/pm/tables'
import { alignmentFrom } from '~/shared/richtext/rich-text.schema'
import type { CellAlign, TableAxis } from '../session'

export type TableRef = { position: number; node: DocumentNode }

export function tableAt(editor: Editor, position: number): TableRef | null {
  const node = editor.state.doc.nodeAt(position)
  return node?.type.name === 'table' ? { position, node } : null
}

function cellOffset(table: TableRef, row: number, column: number): number | null {
  const map = TableMap.get(table.node)
  if (row < 0 || column < 0 || row >= map.height || column >= map.width) {
    return null
  }
  return map.positionAt(row, column, table.node)
}

function lineEnds(table: TableRef, axis: TableAxis, index: number) {
  const map = TableMap.get(table.node)
  const column = axis === 'column'
  const from = column ? cellOffset(table, 0, index) : cellOffset(table, index, 0)
  const to = column
    ? cellOffset(table, map.height - 1, index)
    : cellOffset(table, index, map.width - 1)
  return from === null || to === null ? null : { from, to }
}

export function selectLine(
  editor: Editor,
  table: TableRef,
  axis: TableAxis,
  index: number,
): boolean {
  const ends = lineEnds(table, axis, index)
  if (ends === null) {
    return false
  }
  const start = table.position + 1
  const { doc } = editor.state
  const from = doc.resolve(start + ends.from)
  const to = doc.resolve(start + ends.to)
  const selection =
    axis === 'column' ? CellSelection.colSelection(from, to) : CellSelection.rowSelection(from, to)
  editor.view.dispatch(editor.state.tr.setSelection(selection))
  return true
}

export function isHeaderLine(table: TableRef, axis: TableAxis, index: number): boolean {
  const map = TableMap.get(table.node)
  return axis === 'column'
    ? columnIsHeader(map, table.node, index)
    : rowIsHeader(map, table.node, index)
}

export function alignOf(table: TableRef, axis: TableAxis, index: number): CellAlign | null {
  const offset = axis === 'column' ? cellOffset(table, 0, index) : cellOffset(table, index, 0)
  return offset === null ? null : alignmentFrom(table.node.nodeAt(offset)?.attrs.align)
}
