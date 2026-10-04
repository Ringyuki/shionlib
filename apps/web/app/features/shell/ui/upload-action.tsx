import { Tooltip } from '@hina-ui/react'
import { Upload } from 'lucide-react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { sitePaths } from '../shell'
import { SidebarLabel } from './sidebar-label'

type UploadActionProps = {
  rail: boolean
}

export function UploadAction({ rail }: UploadActionProps) {
  const t = useTranslations('shell')
  const locale = useLocale()
  const label = t('upload')
  return (
    <Tooltip content={label} side="right" disabled={!rail}>
      <Button
        asChild
        block
        loginRequired
        className="h-10 justify-start gap-3 rounded-lg ps-[11px] font-medium [&_svg]:size-5 [&_svg]:shrink-0"
      >
        <Link to={sitePaths(locale).upload} aria-label={rail ? label : undefined}>
          <Upload aria-hidden />
          <SidebarLabel collapsed={rail}>{label}</SidebarLabel>
        </Link>
      </Button>
    </Tooltip>
  )
}
