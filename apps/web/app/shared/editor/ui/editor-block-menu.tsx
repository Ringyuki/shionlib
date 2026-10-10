import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useStore, type BlockKind, type BlockMenu } from '../session'
import type { EditorHandle } from '../use-rich-editor'

const kinds: readonly BlockKind[] = [
  'paragraph',
  'heading2',
  'heading3',
  'bulletList',
  'orderedList',
  'blockquote',
]

function useLastMenu(menu: BlockMenu | null): BlockMenu | null {
  const [kept, setKept] = useState(menu)
  if (menu !== null && menu !== kept) {
    setKept(menu)
  }
  return menu ?? kept
}

export function EditorBlockMenu({ handle }: { handle: EditorHandle }) {
  const t = useTranslations('editor')
  const { editor, session } = handle
  const open = useStore(session.blockMenu)
  const menu = useLastMenu(open)
  const close = () => {
    session.blockMenu.set(null)
    session.block.set(null)
  }
  const position = menu?.position ?? 0
  return (
    <DropdownMenu
      label={t('block.menu')}
      open={open !== null}
      onOpenChange={next => {
        if (!next) {
          close()
        }
      }}
      anchor={menu?.anchor ?? null}
      side="left"
      align="start"
      content={
        <>
          {menu?.convertible === true && (
            <>
              <DropdownMenuLabel>{t('block.turnInto')}</DropdownMenuLabel>
              {kinds.map(kind => (
                <DropdownMenuItem
                  key={kind}
                  onSelect={() => editor?.chain().turnBlockInto(position, kind).focus().run()}
                >
                  {t(`command.${kind}`)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => editor?.commands.duplicateBlock(position)}>
            {t('block.duplicate')}
          </DropdownMenuItem>
          <DropdownMenuItem tone="danger" onSelect={() => editor?.commands.removeBlock(position)}>
            {t('block.remove')}
          </DropdownMenuItem>
        </>
      }
    />
  )
}
