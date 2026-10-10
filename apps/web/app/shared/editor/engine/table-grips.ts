import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state'
import { cellAround, CellSelection, TableMap } from '@tiptap/pm/tables'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import type { EditorSession, EngineLabels, TableAxis } from '../session'
import { alignOf, isHeaderLine, selectLine, tableAt } from './table-commands'

type HotCell = { table: number; row: number; column: number }

type Press = { axis: TableAxis; index: number; position: number; element: HTMLElement }

const gripsKey = new PluginKey<HotCell | null>('tableGrips')

function hotCellAt(view: EditorView, target: EventTarget | null): HotCell | null {
  const cell = target instanceof Element ? target.closest('td, th') : null
  if (cell === null || !view.dom.contains(cell)) {
    return null
  }
  const position = view.posAtDOM(cell, 0)
  const found = position < 0 ? null : cellAround(view.state.doc.resolve(position))
  if (found == null) {
    return null
  }
  const start = found.start(-1)
  const place = TableMap.get(found.node(-1)).findCell(found.pos - start)
  return { table: start, row: place.top, column: place.left }
}

function cellOfSelection(state: EditorState): HotCell | null {
  const found = cellAround(state.selection.$head)
  if (found == null) {
    return null
  }
  const start = found.start(-1)
  const place = TableMap.get(found.node(-1)).findCell(found.pos - start)
  return { table: start, row: place.top, column: place.left }
}

function sameCell(left: HotCell | null, right: HotCell | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  return left.table === right.table && left.row === right.row && left.column === right.column
}

function selectedAxis(state: EditorState, start: number): string | null {
  const { selection } = state
  if (!(selection instanceof CellSelection) || selection.$anchorCell.start(-1) !== start) {
    return null
  }
  if (selection.isColSelection()) {
    return 'is-column-selected'
  }
  return selection.isRowSelection() ? 'is-row-selected' : null
}

export function tableGrips(editor: Editor, session: EditorSession, labels: EngineLabels) {
  const press = ({ axis, index, position, element }: Press) => {
    const table = tableAt(editor, position)
    if (table === null || !selectLine(editor, table, axis, index)) {
      return
    }
    session.tableMenu.set({
      anchor: element,
      axis,
      index,
      header: isHeaderLine(table, axis, index),
      align: alignOf(table, axis, index),
    })
  }
  const grip = (axis: TableAxis, index: number, position: number) => () => {
    const element = document.createElement('div')
    element.className = `table-grip is-${axis}`
    element.setAttribute('role', 'button')
    element.setAttribute('aria-label', axis === 'column' ? labels.selectColumn : labels.selectRow)
    element.contentEditable = 'false'
    element.addEventListener('mousedown', event => {
      event.preventDefault()
      event.stopPropagation()
      press({ axis, index, position, element })
    })
    return element
  }
  const decorate = (state: EditorState, hot: HotCell | null) => {
    const decorations: Decoration[] = []
    state.doc.descendants((node, position) => {
      if (node.type.name !== 'table') {
        return true
      }
      const map = TableMap.get(node)
      const start = position + 1
      const live = hot !== null && hot.table === start ? hot : null
      const axis = selectedAxis(state, start)
      if (axis !== null) {
        decorations.push(Decoration.node(position, position + node.nodeSize, { class: axis }))
      }
      for (let column = 0; column < map.width; column += 1) {
        const offset = map.map[column]
        const cell = offset === undefined ? null : node.nodeAt(offset)
        if (offset === undefined || cell === null || map.findCell(offset).left !== column) {
          continue
        }
        if (live?.column === column) {
          const end = start + offset + cell.nodeSize
          decorations.push(Decoration.node(start + offset, end, { class: 'is-hot-column' }))
        }
        decorations.push(
          Decoration.widget(start + offset + 1, grip('column', column, position), {
            key: `column-${column}`,
            side: -1,
            marks: [],
          }),
        )
      }
      for (let row = 0; row < map.height; row += 1) {
        const offset = map.map[row * map.width]
        const cell = offset === undefined ? null : node.nodeAt(offset)
        if (offset === undefined || cell === null || map.findCell(offset).top !== row) {
          continue
        }
        if (live?.row === row) {
          const end = start + offset + cell.nodeSize
          decorations.push(Decoration.node(start + offset, end, { class: 'is-hot-row' }))
        }
        decorations.push(
          Decoration.widget(start + offset + 1, grip('row', row, position), {
            key: `row-${row}`,
            side: -1,
            marks: [],
          }),
        )
      }
      return false
    })
    return DecorationSet.create(state.doc, decorations)
  }
  return new Plugin<HotCell | null>({
    key: gripsKey,
    state: {
      init: () => null,
      apply(transaction, hot) {
        const next: HotCell | null | undefined = transaction.getMeta(gripsKey)
        return next === undefined ? hot : next
      },
    },
    props: {
      decorations: state => decorate(state, gripsKey.getState(state) ?? cellOfSelection(state)),
      handleDOMEvents: {
        mousemove(view, event) {
          const next = hotCellAt(view, event.target)
          if (!sameCell(next, gripsKey.getState(view.state) ?? null)) {
            view.dispatch(view.state.tr.setMeta(gripsKey, next))
          }
          return false
        },
        mouseleave(view) {
          if (gripsKey.getState(view.state) != null) {
            view.dispatch(view.state.tr.setMeta(gripsKey, null))
          }
          return false
        },
      },
    },
  })
}
