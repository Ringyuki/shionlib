import { Link } from 'lucide-react'
import type { EditorPlugin, RichEditor } from '../plugin'
import { linkAtSelection, selectionAnchor } from '../selection'
import type { EditorSession } from '../session'

export function openLink(editor: RichEditor, session: EditorSession): void {
  editor.chain().focus().extendMarkRange('link').run()
  session.link.set({ anchor: selectionAnchor(editor), href: linkAtSelection(editor), fresh: true })
}

export const link: EditorPlugin = {
  id: 'link',
  tool: {
    icon: Link,
    shortcut: 'Mod-k',
    isActive: editor => editor.isActive('link'),
    run: openLink,
  },
}
