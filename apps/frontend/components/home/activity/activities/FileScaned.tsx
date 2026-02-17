import { Activity, ActivityFileCheckStatus } from '@/interfaces/activity/activity.interface'
import { getTranslations } from 'next-intl/server'
import { Badge, BadgeVariant } from '@/components/shionui/Badge'
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
  { icon: LucideIcon; badgeVariant: BadgeVariant; text: string }
> = {
  [ActivityFileCheckStatus.OK]: { icon: CircleCheck, badgeVariant: 'success', text: 'pass' },
  [ActivityFileCheckStatus.BROKEN_OR_TRUNCATED]: {
    icon: CircleX,
    badgeVariant: 'destructive',
    text: 'brokenOrTruncated',
  },
  [ActivityFileCheckStatus.BROKEN_OR_UNSUPPORTED]: {
    icon: CircleX,
    badgeVariant: 'destructive',
    text: 'brokenOrUnsupported',
  },
  [ActivityFileCheckStatus.ENCRYPTED]: {
    icon: Lock,
    badgeVariant: 'destructive',
    text: 'encrypted',
  },
  [ActivityFileCheckStatus.HARMFUL]: {
    icon: Shield,
    badgeVariant: 'destructive',
    text: 'harmfulContent',
  },
  [ActivityFileCheckStatus.PENDING]: {
    icon: CircleDashed,
    badgeVariant: 'info',
    text: 'pendingScan',
  },
}

const FileScanStatusBadge = async ({ activity }: FileScanedProps) => {
  const t = await getTranslations('Components.Home.Activity.Activities.FileScaned')
  const FileScanStatusIconComponent = fileScanStatusMap[activity.file?.file_check_status!].icon
  return (
    <Badge
      variant={fileScanStatusMap[activity.file?.file_check_status!].badgeVariant}
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
