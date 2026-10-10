import { cn, Toolbar, ToolbarButton, ToolbarSeparator, Tooltip } from '@hina-ui/react'
import { Fragment } from 'react'
import { useTranslations } from 'use-intl'
import { groupOrder, type EditorPlugin } from '../plugin'
import { useEditorLinking, useEditorValue, type EditorHandle } from '../use-rich-editor'
import { EditorHistory } from './editor-history'
import { EditorStyleMenu } from './editor-style-menu'
import { Hint } from './shortcut'

type EditorToolbarProps = {
  handle: EditorHandle
  history?: boolean
  flat?: boolean
  className?: string
}

const divider = 'mx-1.5 h-4.5 self-center'

const on = '1'

const keep = (event: { preventDefault: () => void }) => event.preventDefault()

function statesOf(plugins: readonly EditorPlugin[], handle: EditorHandle): string {
  const editor = handle.editor
  return plugins
    .map(({ tool }) =>
      editor === null
        ? '01'
        : `${tool.isActive?.(editor) === true ? on : '0'}${tool.isDisabled?.(editor) === true ? on : '0'}`,
    )
    .join('')
}

export function EditorToolbar({
  handle,
  history = false,
  flat = false,
  className,
}: EditorToolbarProps) {
  const t = useTranslations('editor')
  const { editor, plugins } = handle
  const linking = useEditorLinking(handle)
  const states = useEditorValue(
    editor,
    () => statesOf(plugins, handle),
    statesOf(plugins, { ...handle, editor: null }),
  )
  const groups = groupOrder
    .map(group => plugins.filter(plugin => plugin.group === group))
    .filter(group => group.length > 0)
  return (
    <Toolbar
      label={t('toolbar')}
      variant="bare"
      size="md"
      className={cn('flex-nowrap gap-0.5', className)}
      onMouseDown={keep}
    >
      {history && <EditorHistory handle={handle} />}
      {groups.map((group, index) => (
        <Fragment key={group[0]?.group}>
          {!flat && (history || index > 0) && <ToolbarSeparator className={divider} />}
          {group.map(plugin => {
            const place = plugins.indexOf(plugin) * 2
            return (
              <Tool
                key={plugin.id}
                plugin={plugin}
                handle={handle}
                active={states[place] === on || (plugin.id === 'link' && linking)}
                disabled={editor === null || states[place + 1] === on}
              />
            )
          })}
        </Fragment>
      ))}
    </Toolbar>
  )
}

type ToolProps = { plugin: EditorPlugin; handle: EditorHandle; active: boolean; disabled: boolean }

function Tool({ plugin, handle, active, disabled }: ToolProps) {
  const t = useTranslations('editor')
  const { editor, session } = handle
  const { icon: Icon, choices, run, shortcut } = plugin.tool
  const label = t(`tool.${plugin.id}`)
  if (choices !== undefined) {
    return <EditorStyleMenu label={label} choices={choices} handle={handle} disabled={disabled} />
  }
  return (
    <Tooltip content={<Hint label={label} shortcut={shortcut} />} side="bottom">
      <ToolbarButton
        variant={active ? 'soft' : 'ghost'}
        tone={active ? 'accent' : 'neutral'}
        label={label}
        tooltip={false}
        aria-pressed={active}
        disabled={disabled}
        className={cn('size-8', !active && 'text-muted')}
        onClick={() => editor !== null && run?.(editor, session)}
      >
        <Icon />
      </ToolbarButton>
    </Tooltip>
  )
}
