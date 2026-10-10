import { Inline, Tooltip } from '@hina-ui/react'
import { GripVertical, Plus } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { IconButton } from '~/shared/ui/button'
import { useStore } from '../session'
import type { EditorHandle } from '../use-rich-editor'

export function EditorBlockHandle({ handle }: { handle: EditorHandle }) {
  const t = useTranslations('editor')
  const { editor, session } = handle
  const block = useStore(session.block)
  if (editor === null || block === null) {
    return null
  }
  const leaves = (target: EventTarget | null) =>
    !(target instanceof Node && editor.view.dom.contains(target)) &&
    session.blockMenu.get() === null
  return (
    <Inline
      gap="none"
      wrap={false}
      data-block-handle=""
      contentEditable={false}
      className="absolute start-0 -translate-x-full pe-1 max-lg:hidden"
      style={{ top: block.top }}
      onMouseLeave={event => {
        if (leaves(event.relatedTarget)) {
          session.block.set(null)
        }
      }}
    >
      <Tooltip content={t('block.add')}>
        <IconButton
          size="xs"
          label={t('block.add')}
          tooltip={false}
          className="text-faint"
          onClick={() => {
            editor.commands.addBlockAfter(block.position)
            session.block.set(null)
          }}
        >
          <Plus />
        </IconButton>
      </Tooltip>
      <Tooltip content={t('block.drag')}>
        <IconButton
          size="xs"
          label={t('block.menu')}
          tooltip={false}
          draggable
          className="text-faint cursor-grab active:cursor-grabbing"
          onDragStart={event => {
            editor.commands.dragBlock(block.position, event.dataTransfer)
          }}
          onDragEnd={() => session.block.set(null)}
          onClick={event =>
            session.blockMenu.set({
              anchor: event.currentTarget,
              position: block.position,
              convertible: block.convertible,
            })
          }
        >
          <GripVertical />
        </IconButton>
      </Tooltip>
    </Inline>
  )
}
