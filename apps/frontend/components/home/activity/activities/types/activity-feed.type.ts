import { Activity as ActivityInterface } from '@/interfaces/activity/activity.interface'

export type ActivityFeedItem =
  | { kind: 'single'; activity: ActivityInterface }
  | { kind: 'file'; fileKey: string; fileId?: number; activities: ActivityInterface[] }
