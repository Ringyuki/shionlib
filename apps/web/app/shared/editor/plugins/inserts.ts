import { Image, Link, Table } from 'lucide-react'
import { insertTable, pickPictures } from '../insert'
import type { EditorPlugin, RichEditor } from '../plugin'
import { linkAtSelection, selectionAnchor } from '../selection'
import type { EditorSession } from '../session'

export function openLink(editor: RichEditor, session: EditorSession): void {
  editor.chain().focus().extendMarkRange('link').run()
  session.link.set({ anchor: selectionAnchor(editor), href: linkAtSelection(editor), fresh: true })
}

export const link: EditorPlugin = {
  id: 'link',
  group: 'insert',
  order: 0,
  bubble: true,
  tool: {
    icon: Link,
    shortcut: 'Mod-k',
    isActive: editor => editor.isActive('link'),
    run: openLink,
  },
}

export const image: EditorPlugin = {
  id: 'image',
  group: 'insert',
  order: 1,
  tool: { icon: Image, run: editor => pickPictures(editor) },
  commands: [
    {
      id: 'image',
      icon: Image,
      keywords: ['image', 'picture', 'photo', 'img', '图片', '插图', '画像'],
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run()
        pickPictures(editor)
      },
    },
  ],
}

export const table: EditorPlugin = {
  id: 'table',
  group: 'insert',
  order: 2,
  tool: {
    icon: Table,
    isActive: editor => editor.isActive('table'),
    isDisabled: editor => editor.isActive('table'),
    run: editor => insertTable(editor),
  },
  commands: [
    {
      id: 'table',
      icon: Table,
      keywords: ['table', 'grid', '表格', '表'],
      run: (editor, range) => {
        editor.chain().focus().deleteRange(range).run()
        insertTable(editor)
      },
    },
  ],
}
