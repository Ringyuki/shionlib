import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  Inline,
  Popover,
  SplitButton,
  Stack,
  Text,
} from '@hina-ui/react'
import { Copy, Download, Globe, Send } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { TurnstileChallenge } from '~/shared/vendor/turnstile-challenge'
import { turnstileAction, type DownloadMethod } from '../download'
import { useDownload } from '../use-download'

type DownloadButtonProps = {
  file: { id: number; name: string }
  disabled?: boolean
}

export function DownloadButton({ file, disabled = false }: DownloadButtonProps) {
  const t = useTranslations('download')
  const download = useDownload(file)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const methodLabel = (method: DownloadMethod) => {
    const label = t(method === 'browser' ? 'viaBrowser' : 'viaAria2')
    return method === download.preferred ? t('asDefault', { label }) : label
  }
  return (
    <>
      <Inline ref={setAnchor} className="shrink-0">
        <SplitButton
          size="sm"
          loading={download.busy}
          disabled={disabled}
          menuLabel={t('methods')}
          icon={<Download />}
          onClick={() => download.start(download.preferred)}
          renderContent={() => (
            <>
              <DropdownMenuItem icon={<Globe />} onSelect={() => download.start('browser')}>
                {methodLabel('browser')}
              </DropdownMenuItem>
              <DropdownMenuItem icon={<Send />} onSelect={() => download.start('aria2')}>
                {methodLabel('aria2')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem icon={<Copy />} onSelect={() => download.start('copy')}>
                {t('copyLink')}
              </DropdownMenuItem>
            </>
          )}
        >
          {t('download')}
        </SplitButton>
      </Inline>
      <Popover
        anchor={anchor}
        open={download.verifying}
        onOpenChange={open => {
          if (!open) {
            download.cancel()
          }
        }}
        side="bottom"
        align="end"
        content={
          <Stack gap="sm" className="w-[18.5rem]">
            <Stack gap="none">
              <Text size="sm" weight="medium">
                {t('verifying')}
              </Text>
              <Text size="xs" tone="muted">
                {t('verifyingHint')}
              </Text>
            </Stack>
            <TurnstileChallenge
              action={turnstileAction}
              onToken={download.verified}
              onFailure={download.failed}
            />
          </Stack>
        }
      />
    </>
  )
}
