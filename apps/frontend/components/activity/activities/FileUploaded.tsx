import { Activity, ActivityType } from '@/interfaces/activity/activity.interface'
import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/shionui/Badge'
import { CircleDashed, CloudCheck, FileArchive } from 'lucide-react'

interface FileUploadedProps {
  activity: Activity
}

export const FileUploaded = async ({ activity }: FileUploadedProps) => {
  const t = await getTranslations('Components.Home.Activity.Activities.FileUploaded')
  return activity.type === ActivityType.FILE_UPLOAD_TO_SERVER ? (
    <div className="flex gap-2 items-center flex-wrap">
      <span>{t('uploadedToServerPrefix')}</span>
      <span className="flex items-center gap-1">
        <FileArchive className="size-4 shrink-0" />
        <span className="font-medium font-mono!">{activity.file?.file_name} </span>
      </span>
      {t('uploadedToServerSuffix') && <span>{t('uploadedToServerSuffix')}</span>}
      <Badge variant="info" className="flex items-center gap-1">
        <CircleDashed className="size-4" />
        {t('pending')}
      </Badge>
    </div>
  ) : (
    <div className="flex gap-2 items-center flex-wrap">
      <span>{t('uploadedToS3Prefix')}</span>
      <span className="flex items-center gap-1">
        <FileArchive className="size-4 shrink-0" />
        <span className="font-medium font-mono!">{activity.file?.file_name} </span>
      </span>
      {t('uploadedToS3Suffix') && <span>{t('uploadedToS3Suffix')}</span>}
      <span className="flex gap-1 items-center text-success">
        <CloudCheck className="size-4" />
        {t('processCompleted')}
      </span>
    </div>
  )
}
