import { Divider, Inline, Popover, Tooltip, type OverlayAnchor } from '@hina-ui/react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import { IconButton } from '~/shared/ui/button'
import type { RichEditor } from '../plugin'
import { selectionRect } from '../selection'
import { useStore } from '../session'
import { useEditorValue, type EditorHandle } from '../use-rich-editor'
import { Hint } from './shortcut'

const keep = (event: { preventDefault: () => void }) => event.preventDefault()

const showDelay = 120

function selectsText(editor: RichEditor): boolean {
  const { selection } = editor.state
  return (
    editor.isEditable &&
    editor.isFocused &&
    !selection.empty &&
    selection.$from.parent.isTextblock &&
    selection.$to.parent.isTextblock &&
    !window.matchMedia('(pointer: coarse)').matches
  )
}

function useSettled(wanted: boolean): boolean {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!wanted) {
      return
    }
    const timer = window.setTimeout(() => setSettled(true), showDelay)
    return () => {
      window.clearTimeout(timer)
      setSettled(false)
    }
  }, [wanted])
  return wanted && settled
}

export function EditorBubbleMenu({ handle }: { handle: EditorHandle }) {
  const t = useTranslations('editor')
  const { editor, plugins, session } = handle
  const link = useStore(session.link)
  const selecting = useEditorValue(editor, selectsText, false)
  const shown = useSettled(selecting && link === null)
  const marks = useEditorValue(
    editor,
    current =>
      plugins.map(plugin => (plugin.tool.isActive?.(current) === true ? '1' : '0')).join(''),
    '',
  )
  const last = useRef<DOMRect | null>(null)
  const anchor = useMemo<OverlayAnchor | null>(
    () =>
      editor === null
        ? null
        : {
            contextElement: editor.view.dom,
            getBoundingClientRect: () => {
              if (!editor.state.selection.empty || last.current === null) {
                last.current = selectionRect(editor)
              }
              return last.current
            },
          },
    [editor],
  )
  return (
    <Popover
      open={shown}
      anchor={anchor}
      modal={false}
      side="top"
      updatePositionStrategy="always"
      padded={false}
      className="max-w-none p-1"
      onOpenAutoFocus={keep}
      onInteractOutside={keep}
      onEscapeKeyDown={keep}
      content={
        <Inline gap="xs" align="center" wrap={false}>
          {plugins.map((plugin, index) => {
            const active = marks[index] === '1'
            const label = t(`tool.${plugin.id}`)
            const parted = plugin.group !== plugins[index - 1]?.group && index > 0
            return plugin.bubble === true ? (
              <Fragment key={plugin.id}>
                {parted && <Divider orientation="vertical" className="mx-0.5 h-4 self-center" />}
                <Tooltip content={<Hint label={label} shortcut={plugin.tool.shortcut} />}>
                  <IconButton
                    size="sm"
                    label={label}
                    tooltip={false}
                    aria-pressed={active}
                    variant={active ? 'soft' : 'ghost'}
                    tone={active ? 'accent' : 'neutral'}
                    onMouseDown={keep}
                    onClick={() => editor !== null && plugin.tool.run?.(editor, session)}
                  >
                    <plugin.tool.icon />
                  </IconButton>
                </Tooltip>
              </Fragment>
            ) : null
          })}
        </Inline>
      }
    />
  )
}
