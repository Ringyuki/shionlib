import { Bold, EyeOff } from 'lucide-react'
import type { EditorPlugin } from '../plugin'

export const bold: EditorPlugin = {
  id: 'bold',
  tool: {
    icon: Bold,
    shortcut: 'Mod-b',
    isActive: editor => editor.isActive('bold'),
    run: editor => editor.chain().focus().toggleBold().run(),
  },
}

export const spoiler: EditorPlugin = {
  id: 'spoiler',
  tool: {
    icon: EyeOff,
    shortcut: 'Mod-Shift-h',
    isActive: editor => editor.isActive('spoiler'),
    run: editor => editor.chain().focus().toggleSpoiler().run(),
  },
}
