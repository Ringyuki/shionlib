import { Badge, Button, Indicator, Popover } from '@hina-ui/react'
import { Upload } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { trayStatus } from '../upload'
import { useUploadOutcomes } from '../use-upload-outcomes'
import { useUploads } from '../use-uploads'
import { UploadPanel } from './upload-panel'

const dots = {
  active: <Indicator tone="accent" size="sm" pulse />,
  attention: <Indicator tone="warning" size="sm" />,
  finished: <Indicator tone="success" size="sm" />,
}

export function UploadTray() {
  const t = useTranslations('upload')
  const state = useUploads()
  useUploadOutcomes(state)
  const status = trayStatus(state)
  if (status === 'idle') {
    return null
  }
  return (
    <Badge bare content={dots[status]} shape="circle">
      <Popover align="end" content={<UploadPanel state={state} />}>
        <Button variant="ghost" tone="neutral" iconOnly aria-label={t('tray')} icon={<Upload />} />
      </Popover>
    </Badge>
  )
}
