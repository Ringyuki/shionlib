import { Editor } from '@tiptap/core'
import { EditorContent } from '@tiptap/react'
import type { RichDocument } from '~/shared/richtext/rich-text'
import { documentFrom } from '~/shared/richtext/rich-text.schema'
import { extensionsFor, type ExtensionOptions } from './extensions'

export type EngineOptions = ExtensionOptions & {
  content: RichDocument
  onChange: (document: RichDocument) => void
}

export function createEditor({ content, onChange, ...options }: EngineOptions): Editor {
  return new Editor({
    extensions: extensionsFor(options),
    content,
    onUpdate: ({ editor }) => {
      const next = documentFrom(editor.getJSON())
      if (next !== undefined) {
        onChange(next)
      }
    },
  })
}

export const Content = EditorContent
