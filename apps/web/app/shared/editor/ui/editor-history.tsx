import { ToolbarButton, Tooltip } from '@hina-ui/react'
import { Redo2, Undo2 } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { useEditorValue, type EditorHandle } from '../use-rich-editor'
import { Hint } from './shortcut'

export function EditorHistory({ handle }: { handle: EditorHandle }) {
  const t = useTranslations('editor')
  const { editor } = handle
  const canUndo = useEditorValue(editor, current => current.can().undo(), false)
  const canRedo = useEditorValue(editor, current => current.can().redo(), false)
  return (
    <>
      <Tooltip content={<Hint label={t('undo')} shortcut="Mod-z" />} side="bottom">
        <ToolbarButton
          label={t('undo')}
          tooltip={false}
          className="text-muted size-8"
          disabled={!canUndo}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 />
        </ToolbarButton>
      </Tooltip>
      <Tooltip content={<Hint label={t('redo')} shortcut="Mod-Shift-z" />} side="bottom">
        <ToolbarButton
          label={t('redo')}
          tooltip={false}
          className="text-muted size-8"
          disabled={!canRedo}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 />
        </ToolbarButton>
      </Tooltip>
    </>
  )
}
