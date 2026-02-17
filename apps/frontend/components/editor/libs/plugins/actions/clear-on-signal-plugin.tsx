'use client'

import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { CLEAR_EDITOR_COMMAND } from 'lexical'

export function ClearOnSignalPlugin({ signal }: { signal?: number }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (signal === undefined) return
    editor.dispatchCommand(CLEAR_EDITOR_COMMAND, undefined)
  }, [editor, signal])

  return null
}
