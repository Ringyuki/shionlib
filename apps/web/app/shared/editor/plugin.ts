import type { Editor } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'
import type { EditorSession } from './session'

export type RichEditor = Editor

export type PluginId = 'bold' | 'spoiler' | 'link'

export type Tool = {
  icon: LucideIcon
  shortcut: string
  isActive: (editor: RichEditor) => boolean
  run: (editor: RichEditor, session: EditorSession) => void
}

export type EditorPlugin = { id: PluginId; tool: Tool }
