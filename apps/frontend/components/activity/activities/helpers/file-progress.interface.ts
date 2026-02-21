import { Activity, ActivityType } from '@/interfaces/activity/activity.interface'
import { StageState } from '../interfaces/file-progress.interface'
import { stageDefinitions } from '../constants/file-progress'
import { BadgeVariant } from '@/components/shionui/Badge'

export const buildStageStates = (activities: Activity[]): StageState[] => {
  const reuploadActivities = activities.filter(
    activity => activity.type === ActivityType.FILE_REUPLOAD,
  )
  const latestReupload = reuploadActivities.reduce<Activity | null>((latest, current) => {
    if (!latest) return current
    const latestTime = new Date(latest.created).getTime()
    const currentTime = new Date(current.created).getTime()
    return currentTime > latestTime ? current : latest
  }, null)

  const relevantActivities = latestReupload
    ? activities.filter(
        activity =>
          new Date(activity.created).getTime() >= new Date(latestReupload.created).getTime(),
      )
    : activities

  const states = stageDefinitions.map(stage => {
    const stageActivities = relevantActivities.filter(activity =>
      stage.types.includes(activity.type),
    )

    if (!stageActivities.length) {
      return { ...stage, completed: false, failed: false }
    }

    const latestActivity = stageActivities.reduce((latest, current) => {
      const latestTime = new Date(latest.created).getTime()
      const currentTime = new Date(current.created).getTime()
      return currentTime > latestTime ? current : latest
    }, stageActivities[0])

    const failed = stage.key === 'scan' && latestActivity.type !== ActivityType.FILE_CHECK_OK

    return {
      ...stage,
      completed: true,
      failed,
      latestActivity,
    }
  })

  const lastSuccessfulStageIndex = states.reduce(
    (acc, stage, index) => (stage.completed && !stage.failed ? index : acc),
    -1,
  )
  if (lastSuccessfulStageIndex > -1) {
    for (let i = 0; i <= lastSuccessfulStageIndex; i += 1) {
      const stage = states[i]
      if (!stage.completed) {
        states[i] = { ...stage, completed: true, failed: false }
      }
    }
  }
  return states
}

export const getPrimaryStatus = (stages: StageState[]) => {
  const hasFailure = stages.some(stage => stage.failed)
  if (hasFailure) {
    return { variant: 'destructive' as BadgeVariant, labelKey: 'status.failed' }
  }

  const allCompleted = stages.every(stage => stage.completed)
  if (allCompleted) {
    return { variant: 'success' as BadgeVariant, labelKey: 'status.completed' }
  }

  const inProgress = stages.some(stage => stage.completed)
  return inProgress
    ? { variant: 'info' as BadgeVariant, labelKey: 'status.inProgress' }
    : { variant: 'neutral' as BadgeVariant, labelKey: 'status.waiting' }
}
