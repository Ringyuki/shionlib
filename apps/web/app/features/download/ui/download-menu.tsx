import { DropdownMenuItem, DropdownMenuSeparator, Text } from '@hina-ui/react'
import { Copy, Globe, Send, SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { isManager } from '~/shared/vendor/managers'
import type { DownloadMethod } from '../download'
import type { Download } from '../use-download'
import { ManagerLogo } from './manager-logo'

function MethodIcon({ method }: { method: DownloadMethod }) {
  if (isManager(method)) {
    return <ManagerLogo manager={method} className="size-4" />
  }
  return method === 'aria2' ? <Send /> : <Globe />
}

export function DownloadMenu({ download }: { download: Download }) {
  const t = useTranslations('download')
  const { openSettings } = download
  return (
    <>
      {download.methods.map(({ method, usable }) => {
        const label = t(`via.${method}`)
        return (
          <DropdownMenuItem
            key={method}
            icon={<MethodIcon method={method} />}
            disabled={!usable}
            trailing={
              usable ? undefined : (
                <Text as="span" size="xs" tone="muted">
                  {t('needsBangumi')}
                </Text>
              )
            }
            onSelect={() => download.start(method)}
          >
            {method === download.preferred ? t('asDefault', { label }) : label}
          </DropdownMenuItem>
        )
      })}
      <DropdownMenuSeparator />
      <DropdownMenuItem icon={<Copy />} onSelect={() => download.start('copy')}>
        {t('copyLink')}
      </DropdownMenuItem>
      {openSettings !== undefined && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<SlidersHorizontal />} onSelect={openSettings}>
            {t('openSettings')}
          </DropdownMenuItem>
        </>
      )}
    </>
  )
}
