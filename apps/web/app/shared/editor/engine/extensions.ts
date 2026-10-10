import type { AnyExtension, Extensions } from '@tiptap/core'
import { Bold } from '@tiptap/extension-bold'
import { Document } from '@tiptap/extension-document'
import { HardBreak } from '@tiptap/extension-hard-break'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Text } from '@tiptap/extension-text'
import { Dropcursor, Placeholder, UndoRedo } from '@tiptap/extensions'
import type { EditorPlugin, PluginId } from '../plugin'
import type { EditorSession } from '../session'
import { linkMark } from './link'
import { Spoiler } from './spoiler'

function pluginExtension(id: PluginId, session: EditorSession): AnyExtension {
  switch (id) {
    case 'bold':
      return Bold
    case 'spoiler':
      return Spoiler
    case 'link':
      return linkMark(session)
  }
}

export type ExtensionOptions = {
  plugins: readonly EditorPlugin[]
  session: EditorSession
  placeholder: string
}

export function extensionsFor({ plugins, session, placeholder }: ExtensionOptions): Extensions {
  return [
    Document,
    Paragraph,
    Text,
    HardBreak.extend({ name: 'hard_break' }),
    UndoRedo,
    Dropcursor,
    Placeholder.configure({ placeholder }),
    ...plugins.map(plugin => pluginExtension(plugin.id, session)),
  ]
}
