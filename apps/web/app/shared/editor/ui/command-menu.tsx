import { Card, cn, Popover, ScrollArea, Stack, Text, type ScrollAreaHandle } from '@hina-ui/react'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'use-intl'
import { useStore, type CommandMenu as Menu, type Store } from '../session'
import type { EditorHandle } from '../use-rich-editor'

const keep = (event: { preventDefault: () => void }) => event.preventDefault()

const edge = 4

export function CommandMenu({ handle }: { handle: EditorHandle }) {
  const menu = useStore(handle.session.commands)
  return (
    <Popover
      open={menu !== null}
      onOpenChange={open => {
        if (!open) {
          handle.session.commands.set(null)
        }
      }}
      anchor={menu?.anchor ?? null}
      modal={false}
      side="bottom"
      align="start"
      sideOffset={6}
      updatePositionStrategy="always"
      padded={false}
      className="max-w-none"
      onOpenAutoFocus={keep}
      onInteractOutside={keep}
      content={menu !== null && <Commands menu={menu} store={handle.session.commands} />}
    />
  )
}

function Commands({ menu, store }: { menu: Menu; store: Store<Menu | null> }) {
  const t = useTranslations('editor')
  const area = useRef<ScrollAreaHandle>(null)
  useEffect(() => {
    const viewport = area.current?.viewport
    const row = viewport?.querySelector(`[data-command-index="${menu.index}"]`)
    if (viewport === undefined || !(row instanceof HTMLElement)) {
      return
    }
    const top = row.offsetTop
    const bottom = top + row.offsetHeight
    if (top < viewport.scrollTop + edge) {
      viewport.scrollTo({ top: top - edge })
    } else if (bottom > viewport.scrollTop + viewport.clientHeight - edge) {
      viewport.scrollTo({ top: bottom - viewport.clientHeight + edge })
    }
  }, [menu.index])
  if (menu.items.length === 0) {
    return (
      <Text size="sm" tone="muted" className="w-66 px-3.5 py-3">
        {t('noCommand')}
      </Text>
    )
  }
  return (
    <ScrollArea ref={area} className="max-h-96 w-66">
      <Stack role="listbox" aria-label={t('commands')} gap="none" className="p-1">
        {menu.items.map((item, index) => (
          <Card
            key={item.id}
            as="button"
            role="option"
            aria-selected={index === menu.index}
            padded={false}
            data-command-index={index}
            className={cn(
              'hn-state-layer hn-interactive hn-press-none flex h-9 w-full items-center gap-2.5',
              'rounded-md border-0 px-2.5 text-start shadow-none',
              index === menu.index ? 'bg-accent-soft text-accent-text' : 'bg-transparent',
            )}
            onMouseDown={keep}
            onMouseEnter={() => index !== menu.index && store.set({ ...menu, index })}
            onClick={() => menu.choose(index)}
          >
            <item.icon aria-hidden className="size-4 shrink-0" />
            <Text as="span" size="sm" truncate className="min-w-0 flex-1">
              {t(`command.${item.id}`)}
            </Text>
            {item.typed !== undefined && (
              <Text as="span" size="xs" tone="faint" className="shrink-0 font-mono">
                {item.typed}
              </Text>
            )}
          </Card>
        ))}
      </Stack>
    </ScrollArea>
  )
}
