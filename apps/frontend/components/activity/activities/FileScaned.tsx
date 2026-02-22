import { Activity, ActivityFileCheckStatus } from '@/interfaces/activity/activity.interface'
import { getTranslations } from 'next-intl/server'
import { Badge, BadgeAppearance, BadgeVariant } from '@/components/shionui/Badge'
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  FileArchive,
  Lock,
  Shield,
  LucideIcon,
  Ban,
} from 'lucide-react'

interface FileScanedProps {
  activity: Activity
}

const fileScanStatusMap: Record<
  ActivityFileCheckStatus,
  { icon: LucideIcon; variant: BadgeVariant; appearance: BadgeAppearance; text: string }
> = {
  [ActivityFileCheckStatus.OK]: {
    icon: CircleCheck,
    variant: 'success',
    appearance: 'soft',
    text: 'pass',
  },
  [ActivityFileCheckStatus.BROKEN_OR_TRUNCATED]: {
    icon: CircleX,
    variant: 'destructive',
    appearance: 'soft',
    text: 'brokenOrTruncated',
  },
  [ActivityFileCheckStatus.BROKEN_OR_UNSUPPORTED]: {
    icon: CircleX,
    variant: 'destructive',
    appearance: 'soft',
    text: 'brokenOrUnsupported',
  },
  [ActivityFileCheckStatus.ENCRYPTED]: {
    icon: Lock,
    variant: 'destructive',
    appearance: 'soft',
    text: 'encrypted',
  },
  [ActivityFileCheckStatus.HARMFUL]: {
    icon: Shield,
    variant: 'destructive',
    appearance: 'soft',
    text: 'harmfulContent',
  },
  [ActivityFileCheckStatus.PENDING]: {
    icon: CircleDashed,
    variant: 'info',
    appearance: 'soft',
    text: 'pendingScan',
  },
}

const FileScanStatusBadge = async ({ activity }: FileScanedProps) => {
  const t = await getTranslations('Components.Home.Activity.Activities.FileScaned')
  const FileScanStatusIconComponent = fileScanStatusMap[activity.file?.file_check_status!].icon
  return (
    <Badge
      intent={fileScanStatusMap[activity.file?.file_check_status!].variant}
      appearance={fileScanStatusMap[activity.file?.file_check_status!].appearance}
      className="flex items-center gap-1"
    >
      <FileScanStatusIconComponent className="size-4" />
      {t(fileScanStatusMap[activity.file?.file_check_status!].text)}
    </Badge>
  )
}

export const FileScaned = async ({ activity }: FileScanedProps) => {
  const t = await getTranslations('Components.Home.Activity.Activities.FileScaned')

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <span>{t('scannedPrefix')}</span>
      <span className="flex items-center gap-1">
        <FileArchive className="size-4 shrink-0" />
        <span className="font-medium font-mono!">{activity.file?.file_name} </span>
      </span>
      {t('scannedSuffix') && <span>{t('scannedSuffix')}</span>}
      <FileScanStatusBadge activity={activity} />
      {activity.file?.file_check_status !== ActivityFileCheckStatus.OK && (
        <span className="flex items-center gap-1 text-destructive">
          <Ban className="size-4" />
          {t('processAborted')}
        </span>
      )}
    </div>
  )
}
