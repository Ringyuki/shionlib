import { Activity, ActivityType } from '@/interfaces/activity/activity.interface'

type FileStageKey = 'uploadServer' | 'uploadS3' | 'scan'

export interface StageDefinition {
  key: FileStageKey
  types: ActivityType[]
}

export interface StageState extends StageDefinition {
  completed: boolean
  failed: boolean
  latestActivity?: Activity
}
