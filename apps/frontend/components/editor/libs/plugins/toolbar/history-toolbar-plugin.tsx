'use client'

import { useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { mergeRegister } from '@lexical/utils'
import {
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  LexicalEditor,
  REDO_COMMAND,
  UNDO_COMMAND,
} from 'lexical'
import { RedoIcon, UndoIcon } from 'lucide-react'

import { useToolbarContext } from '@/components/editor/libs/context/toolbar-context'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'

const IS_APPLE = true

export function HistoryToolbarPlugin() {
  const t = useTranslations('Components.Editor.Toolbar')
  const [editor] = useLexicalComposerContext()
  const { activeEditor, $updateToolbar } = useToolbarContext()
  const [isEditable, setIsEditable] = useState(editor.isEditable())
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    return mergeRegister(
      editor.registerEditableListener(editable => {
        setIsEditable(editable)
      }),
      activeEditor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateToolbar()
        })
      }),
      activeEditor.registerCommand<boolean>(
        CAN_UNDO_COMMAND,
        payload => {
          setCanUndo(payload)
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      activeEditor.registerCommand<boolean>(
        CAN_REDO_COMMAND,
        payload => {
          setCanRedo(payload)
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [$updateToolbar, activeEditor, editor])

  return (
    <div className="flex items-center gap-1">
      <Button
        disabled={!canUndo || !isEditable}
        onClick={() => {
          activeEditor.dispatchCommand(UNDO_COMMAND, undefined)
        }}
        title={IS_APPLE ? t('undoMac') : t('undoWin')}
        type="button"
        aria-label={t('undo')}
        size="icon"
        className="!h-8 !w-8"
        appearance={'outline'}
      >
        <UndoIcon className="size-4" />
      </Button>
      <Button
        disabled={!canRedo || !isEditable}
        onClick={() => {
          activeEditor.dispatchCommand(REDO_COMMAND, undefined)
        }}
        title={IS_APPLE ? t('redoMac') : t('redoWin')}
        type="button"
        aria-label={t('redo')}
        appearance={'outline'}
        size="icon"
        className="!h-8 !w-8"
      >
        <RedoIcon className="size-4" />
      </Button>
    </div>
  )
}
