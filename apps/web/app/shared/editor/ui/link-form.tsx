import { FormField, Inline, Input } from '@hina-ui/react'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { linkAddressFrom } from '~/shared/richtext/rich-text.schema'
import { Button, IconButton } from '~/shared/ui/button'
import type { RichEditor } from '../plugin'
import type { LinkOverlay } from '../session'

type LinkFormProps = { editor: RichEditor; overlay: LinkOverlay; onDone: () => void }

export function LinkForm({ editor, overlay, onDone }: LinkFormProps) {
  const t = useTranslations('editor')
  const [href, setHref] = useState(overlay.href)
  const [refused, setRefused] = useState(false)
  const existing = overlay.href !== ''
  const address = linkAddressFrom(href)
  const apply = () => {
    if (address === undefined) {
      setRefused(true)
      return
    }
    const chain = editor.chain().focus()
    if (existing) {
      chain.extendMarkRange('link').setLink({ href: address }).run()
    } else if (editor.state.selection.empty) {
      const marked = { type: 'text', marks: [{ type: 'link', attrs: { href: address } }] }
      chain.insertContent({ ...marked, text: address }).run()
    } else {
      chain.setLink({ href: address }).run()
    }
    onDone()
  }
  return (
    <FormField error={refused ? t('issue.address') : undefined} className="w-full sm:w-81.5">
      <Inline gap="sm" align="center" wrap={false}>
        <Input
          size="sm"
          type="url"
          inputMode="url"
          autoComplete="off"
          autoFocus={overlay.fresh}
          aria-label={t('linkAddress')}
          placeholder={t('linkAddressHint')}
          value={href}
          onValueChange={next => {
            setHref(next)
            setRefused(false)
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              apply()
            }
          }}
          className="h-8 min-w-0 flex-1"
        />
        {overlay.fresh && (
          <Button size="sm" className="h-8 px-3" onClick={apply}>
            {t('confirm')}
          </Button>
        )}
        {existing && (
          <>
            <IconButton
              size="sm"
              className="size-8"
              label={t('linkOpen')}
              disabled={address === undefined}
              onClick={() => window.open(address, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink />
            </IconButton>
            <Button
              size="sm"
              variant="ghost"
              tone="danger"
              className="h-8 px-3"
              onClick={() => {
                editor.chain().focus().extendMarkRange('link').unsetLink().run()
                onDone()
              }}
            >
              {t('linkRemove')}
            </Button>
          </>
        )}
      </Inline>
    </FormField>
  )
}
