import { cn, Inline, Popover, Progress, SplitButton, Stack, Text } from '@hina-ui/react'
import { Download } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import type { DownloadSubject } from '../download'
import { useDownload } from '../use-download'
import { useDownloadArea } from '../use-download-area'
import { DownloadMenu } from './download-menu'

type DownloadButtonProps = DownloadSubject & {
  disabled?: boolean
  size?: 'sm' | 'md'
  block?: boolean
  className?: string
}

export function DownloadButton({
  resourceId,
  file,
  disabled = false,
  size = 'sm',
  block = false,
  className,
}: DownloadButtonProps) {
  const t = useTranslations('download')
  const download = useDownload({ resourceId, file })
  const area = useDownloadArea()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <Inline ref={setAnchor} className={cn('shrink-0', className)}>
        <SplitButton
          size={size}
          block={block}
          loading={download.busy}
          disabled={disabled}
          menuLabel={t('methods')}
          icon={<Download />}
          onClick={() => download.start(download.preferred)}
          renderContent={() => <DownloadMenu download={download} />}
        >
          {t('download')}
        </SplitButton>
      </Inline>
      <Popover
        anchor={anchor}
        open={download.preparing}
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
            <Progress value={download.progress} size="sm" aria-label={t('verifying')} />
            {area?.banner}
          </Stack>
        }
      />
    </>
  )
}
