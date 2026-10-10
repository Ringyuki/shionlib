import { cn, Toolbar, ToolbarButton, Tooltip } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { EditorPlugin } from '../plugin'
import { useEditorLinking, useEditorValue, type EditorHandle } from '../use-rich-editor'
import { Hint } from './shortcut'

type EditorToolbarProps = { handle: EditorHandle; className?: string }

const on = '1'

const keep = (event: { preventDefault: () => void }) => event.preventDefault()

function statesOf(plugins: readonly EditorPlugin[], handle: EditorHandle): string {
  const editor = handle.editor
  return plugins.map(({ tool }) => (editor !== null && tool.isActive(editor) ? on : '0')).join('')
}

export function EditorToolbar({ handle, className }: EditorToolbarProps) {
  const t = useTranslations('editor')
  const { editor, plugins } = handle
  const linking = useEditorLinking(handle)
  const states = useEditorValue(
    editor,
    () => statesOf(plugins, handle),
    statesOf(plugins, { ...handle, editor: null }),
  )
  return (
    <Toolbar
      label={t('toolbar')}
      variant="bare"
      size="md"
      className={cn('flex-nowrap gap-0.5', className)}
      onMouseDown={keep}
    >
      {plugins.map((plugin, place) => (
        <Tool
          key={plugin.id}
          plugin={plugin}
          handle={handle}
          active={states[place] === on || (plugin.id === 'link' && linking)}
        />
      ))}
    </Toolbar>
  )
}

type ToolProps = { plugin: EditorPlugin; handle: EditorHandle; active: boolean }

function Tool({ plugin, handle, active }: ToolProps) {
  const t = useTranslations('editor')
  const { editor, session } = handle
  const { icon: Icon, run, shortcut } = plugin.tool
  const label = t(`tool.${plugin.id}`)
  return (
    <Tooltip content={<Hint label={label} shortcut={shortcut} />} side="bottom">
      <ToolbarButton
        variant={active ? 'soft' : 'ghost'}
        tone={active ? 'accent' : 'neutral'}
        label={label}
        tooltip={false}
        aria-pressed={active}
        disabled={editor === null}
        className={cn('size-8', !active && 'text-muted')}
        onClick={() => editor !== null && run(editor, session)}
      >
        <Icon />
      </ToolbarButton>
    </Tooltip>
  )
}
