import { Badge, Button, Indicator } from '@hina-ui/react'
import { Upload } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslations } from 'use-intl'
import { queueStatus } from '../upload'
import { useUploadOutcomes } from '../use-upload-outcomes'
import { useUploads } from '../use-uploads'

const dots = {
  active: <Indicator tone="accent" size="sm" pulse />,
  attention: <Indicator tone="warning" size="sm" />,
  finished: <Indicator tone="success" size="sm" />,
}

export function UploadIndicator({ to }: { to: string }) {
  const t = useTranslations('upload')
  const state = useUploads()
  useUploadOutcomes(state)
  const status = queueStatus(state)
  if (status === 'idle') {
    return null
  }
  return (
    <Badge bare content={dots[status]} shape="circle">
      <Button asChild variant="ghost" tone="neutral" iconOnly aria-label={t(`status.${status}`)}>
        <Link to={to}>
          <Upload aria-hidden />
        </Link>
      </Button>
    </Badge>
  )
}
