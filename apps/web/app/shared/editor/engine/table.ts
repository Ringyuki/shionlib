import { Extension, type Attributes, type Extensions } from '@tiptap/core'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { constraints } from '~/shared/api/generated/constraints'
import type { EditorSession, EngineLabels } from '../session'
import { tableGrips } from './table-grips'
import { tableViewWith } from './table-view'

export const cellMinWidth = 96

function storedAttributes(all: Attributes | undefined): Attributes {
  const stored = constraints.RichTextNode.attrs.fields
  return Object.fromEntries(Object.entries(all ?? {}).filter(([name]) => name in stored))
}

export function tableNodes(session: EditorSession, labels: EngineLabels): Extensions {
  return [
    Table.extend({ content: 'table_row+' }).configure({
      resizable: true,
      lastColumnResizable: false,
      cellMinWidth,
      View: tableViewWith(labels),
    }),
    TableRow.extend({ name: 'table_row', content: '(table_cell | table_header)*' }),
    TableHeader.extend({
      name: 'table_header',
      content: 'paragraph+',
      addAttributes() {
        return storedAttributes(this.parent?.())
      },
    }),
    TableCell.extend({
      name: 'table_cell',
      content: 'paragraph+',
      addAttributes() {
        return storedAttributes(this.parent?.())
      },
    }),
    Extension.create({
      name: 'tableGrips',
      addProseMirrorPlugins() {
        return [tableGrips(this.editor, session, labels)]
      },
    }),
  ]
}
