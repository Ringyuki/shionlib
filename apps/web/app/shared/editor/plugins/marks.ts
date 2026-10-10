import { Bold, EyeOff, Italic, Strikethrough } from 'lucide-react'
import type { EditorPlugin } from '../plugin'

export const bold: EditorPlugin = {
  id: 'bold',
  group: 'inline',
  order: 0,
  bubble: true,
  tool: {
    icon: Bold,
    shortcut: 'Mod-b',
    isActive: editor => editor.isActive('bold'),
    run: editor => editor.chain().focus().toggleBold().run(),
  },
}

export const italic: EditorPlugin = {
  id: 'italic',
  group: 'inline',
  order: 1,
  bubble: true,
  tool: {
    icon: Italic,
    shortcut: 'Mod-i',
    isActive: editor => editor.isActive('italic'),
    run: editor => editor.chain().focus().toggleItalic().run(),
  },
}

export const strike: EditorPlugin = {
  id: 'strike',
  group: 'inline',
  order: 2,
  bubble: true,
  tool: {
    icon: Strikethrough,
    shortcut: 'Mod-Shift-s',
    isActive: editor => editor.isActive('strike'),
    run: editor => editor.chain().focus().toggleStrike().run(),
  },
}

export const spoiler: EditorPlugin = {
  id: 'spoiler',
  group: 'inline',
  order: 3,
  bubble: true,
  tool: {
    icon: EyeOff,
    shortcut: 'Mod-Shift-h',
    isActive: editor => editor.isActive('spoiler'),
    run: editor => editor.chain().focus().toggleSpoiler().run(),
  },
}
