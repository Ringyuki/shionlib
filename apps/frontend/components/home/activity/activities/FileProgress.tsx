'use client'

import { Activity } from '@/interfaces/activity/activity.interface'
import { Card, CardContent } from '@/components/shionui/Card'
import { Badge, BadgeVariant } from '@/components/shionui/Badge'
import { timeFromNow } from '@/utils/time-format'
import { FileArchive, CircleCheck, CircleX, Loader } from 'lucide-react'
import { Avatar } from '@/components/common/user/Avatar'
import { formatBytes } from '@/utils/format'
import { eventBadgeVariantMap, systemFileActivityTypes } from './constants/file-progress'
import { buildStageStates, getPrimaryStatus } from './helpers/file-progress.interface'
import { StageState } from './interfaces/file-progress.interface'
import { useLocale, useTranslations } from 'next-intl'
import { ScrollBar } from '@/components/shionui/ScrollBar'

interface FileProgressProps {
  activities: Activity[]
}

export const FileProgress = ({ activities }: FileProgressProps) => {
  const locale = useLocale()
  const t = useTranslations('Components.Home.Activity.Activities.FileProgress')
  const tCard = useTranslations('Components.Home.Activity.ActivityCard')

  const sortedActivities = [...activities].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
  )
  const fileInfo = sortedActivities.find(activity => activity.file)?.file
  const stageStates = buildStageStates(sortedActivities)
  const completedStages = stageStates.filter(stage => stage.completed).length
  const progressValue = stageStates.length
    ? Math.round((completedStages / stageStates.length) * 100)
    : 0
  const primaryStatus = getPrimaryStatus(stageStates)
  const timelineActivities = [...activities].sort(
    (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
  )
  const StageIcon = (stage: StageState, hasPreviousFailure: boolean) => {
    if (stage.completed)
      return stage.failed ? <CircleX className="size-3.5" /> : <CircleCheck className="size-3.5" />
    if (hasPreviousFailure) return <CircleX className="size-3.5" />
    return <Loader className="size-3.5" />
  }

  return (
    <Card className="py-0">
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileArchive className="size-4 shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium leading-tight font-mono">
                {fileInfo?.file_name ?? t('unknownFile')}
              </span>
              {fileInfo?.file_size !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {formatBytes(fileInfo.file_size)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={primaryStatus.variant}>{t(primaryStatus.labelKey)}</Badge>
          <div className="space-y-2 flex-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden relative">
              <div
                className={`h-full transition-all ${
                  primaryStatus.variant === 'success'
                    ? 'bg-success'
                    : primaryStatus.variant === 'destructive'
                      ? 'bg-destructive'
                      : 'bg-primary'
                }`}
                style={{ width: `${progressValue}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-medium text-muted-foreground">
              {(() => {
                let cumulativeFailure = false
                return stageStates.map(stage => {
                  const stageFailed = stage.failed || cumulativeFailure
                  const textColor = stage.completed
                    ? stage.failed
                      ? 'text-destructive'
                      : 'text-success'
                    : 'text-muted-foreground'
                  const icon = StageIcon(stage, cumulativeFailure)
                  cumulativeFailure = stageFailed
                  return (
                    <div key={stage.key} className={`flex items-center gap-1 ${textColor}`}>
                      {icon}
                      <span>{t(`stages.${stage.key}`)}</span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t('timeline.title')}
          </div>
          <ScrollBar className="max-h-22">
            {timelineActivities.length === 0 ? (
              <span className="text-sm text-muted-foreground">{t('timeline.empty')}</span>
            ) : (
              <ol className="space-y-2">
                {timelineActivities.map(activity => {
                  const variant = eventBadgeVariantMap[activity.type] ?? ('neutral' as BadgeVariant)
                  const eventLabel = t(`events.${activity.type}`)
                  const actor = systemFileActivityTypes.has(activity.type) ? (
                    tCard('system')
                  ) : (
                    <span className="flex items-center gap-2">
                      <Avatar user={activity.user} className="size-6" />
                      <span className="text-sm font-medium leading-tight">
                        {activity.user.name}
                      </span>
                    </span>
                  )
                  return (
                    <li key={activity.id} className="flex items-center gap-3">
                      <Badge variant={variant} className="shrink-0" size="sm">
                        {eventLabel}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium leading-tight">{actor}</span>
                        <span className="text-xs text-muted-foreground">
                          {timeFromNow(activity.created, locale)}
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </ScrollBar>
        </div>
      </CardContent>
    </Card>
  )
}
