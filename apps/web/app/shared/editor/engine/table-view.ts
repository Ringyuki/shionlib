import { TableView } from '@tiptap/extension-table'
import type { Node as DocumentNode } from '@tiptap/pm/model'
import { addColumn, addRow, TableMap } from '@tiptap/pm/tables'
import type { EditorView, ViewMutationRecord } from '@tiptap/pm/view'
import type { EngineLabels, TableAxis } from '../session'

export function tableViewWith(labels: EngineLabels) {
  return class GripTableView extends TableView {
    private readonly editorView: EditorView

    constructor(node: DocumentNode, cellMinWidth: number, view: EditorView) {
      super(node, cellMinWidth, view)
      this.editorView = view
      const scroller = document.createElement('div')
      scroller.className = 'table-scroll'
      scroller.appendChild(this.table)
      this.dom.appendChild(scroller)
      this.dom.appendChild(this.plus('column', labels.appendColumn))
      this.dom.appendChild(this.plus('row', labels.appendRow))
    }

    private plus(axis: TableAxis, label: string): HTMLElement {
      const element = document.createElement('div')
      element.className = `table-plus is-${axis}`
      element.setAttribute('role', 'button')
      element.setAttribute('aria-label', label)
      element.contentEditable = 'false'
      element.addEventListener('mousedown', event => {
        event.preventDefault()
        event.stopPropagation()
        this.append(axis)
      })
      return element
    }

    private append(axis: TableAxis): void {
      const view = this.editorView
      const position = view.posAtDOM(this.table, 0)
      if (position < 0) {
        return
      }
      const inside = view.state.doc.resolve(position)
      const map = TableMap.get(this.node)
      const rect = {
        map,
        table: this.node,
        tableStart: inside.start(inside.depth),
        left: 0,
        top: 0,
        right: map.width,
        bottom: map.height,
      }
      const transaction = view.state.tr
      if (axis === 'column') {
        addColumn(transaction, rect, map.width)
      } else {
        addRow(transaction, rect, map.height)
      }
      view.dispatch(transaction)
    }

    override ignoreMutation(record: ViewMutationRecord): boolean {
      return !this.contentDOM.contains(record.target)
    }
  }
}
