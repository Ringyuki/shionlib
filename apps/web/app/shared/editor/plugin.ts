import type { Editor, Range } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'
import type { EditorSession } from './session'

export type RichEditor = Editor

export type PluginId =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'spoiler'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'horizontalRule'
  | 'link'
  | 'image'
  | 'table'

export type ToolbarGroup = 'style' | 'inline' | 'block' | 'insert'

export type ChoiceId = 'paragraph' | 'heading2' | 'heading3'

export type CommandId =
  | 'paragraph'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'horizontalRule'
  | 'image'
  | 'table'

export type ToolAction = (editor: RichEditor, session: EditorSession) => void

export type ToolChoice = {
  id: ChoiceId
  shortcut?: string
  isActive: (editor: RichEditor) => boolean
  run: ToolAction
}

export type Tool = {
  icon: LucideIcon
  shortcut?: string
  isActive?: (editor: RichEditor) => boolean
  isDisabled?: (editor: RichEditor) => boolean
  run?: ToolAction
  choices?: readonly ToolChoice[]
}

export type SlashCommand = {
  id: CommandId
  icon: LucideIcon
  typed?: string
  keywords: readonly string[]
  run: (editor: RichEditor, range: Range, session: EditorSession) => void
}

export type EditorPlugin = {
  id: PluginId
  group: ToolbarGroup
  order: number
  bubble?: boolean
  tool: Tool
  commands?: readonly SlashCommand[]
}

export const groupOrder: readonly ToolbarGroup[] = ['style', 'inline', 'block', 'insert']
