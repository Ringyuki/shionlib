import type { JSONContent } from '@tiptap/core'
import type { RichEditor } from './plugin'

const pictureTypes = 'image/jpeg,image/png,image/webp,image/avif'

export function insertBlocks(editor: RichEditor, blocks: JSONContent[]): void {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      editor.chain().focus().insertContentAt($from.after(depth), blocks).run()
      return
    }
  }
  editor.chain().focus().insertContent(blocks).run()
}

export function pickPictures(editor: RichEditor): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = pictureTypes
  input.multiple = true
  input.addEventListener('change', () => {
    editor
      .chain()
      .focus()
      .insertPictures([...(input.files ?? [])])
      .run()
  })
  input.click()
}

export function insertTable(editor: RichEditor): void {
  if (!editor.isActive('table')) {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }
}

export function insertRule(editor: RichEditor): void {
  insertBlocks(editor, [{ type: 'horizontal_rule' }, { type: 'paragraph' }])
}
