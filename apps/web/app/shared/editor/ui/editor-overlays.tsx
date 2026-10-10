import { Popover, Sheet } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useStore, type LinkOverlay } from '../session'
import type { EditorHandle } from '../use-rich-editor'
import { LinkForm } from './link-form'
import { useNarrow } from './use-narrow'

const keep = (event: { preventDefault: () => void }) => event.preventDefault()

function useLastLink(link: LinkOverlay | null): LinkOverlay | null {
  const [kept, setKept] = useState(link)
  if (link !== null && link !== kept) {
    setKept(link)
  }
  return link ?? kept
}

export function EditorOverlays({ handle }: { handle: EditorHandle }) {
  const t = useTranslations('editor')
  const { editor, session } = handle
  const link = useStore(session.link)
  const shown = useLastLink(link)
  const narrow = useNarrow()
  const open = link !== null && editor !== null
  const close = () => session.link.set(null)
  const follow = (next: boolean) => {
    if (!next) {
      close()
    }
  }
  const form =
    editor === null || shown === null ? null : (
      <LinkForm
        key={`${shown.href}${String(shown.fresh)}`}
        editor={editor}
        overlay={shown}
        onDone={close}
      />
    )
  return (
    <>
      <Popover
        open={open && !narrow}
        onOpenChange={follow}
        anchor={shown?.anchor ?? null}
        modal={false}
        side="bottom"
        align="start"
        updatePositionStrategy="always"
        className="p-2"
        onOpenAutoFocus={shown?.fresh === true ? undefined : keep}
        onInteractOutside={event => {
          const inText = event.target instanceof Node && editor?.view.dom.contains(event.target)
          if (shown?.fresh === false && inText === true) {
            event.preventDefault()
          }
        }}
        onEscapeKeyDown={() => editor?.commands.focus()}
        content={form}
      />
      <Sheet
        open={open && narrow}
        onOpenChange={follow}
        title={t('tool.link')}
        renderContent={() => form}
      />
    </>
  )
}
