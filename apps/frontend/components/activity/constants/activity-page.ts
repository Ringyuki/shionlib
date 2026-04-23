import {
  BookOpenCheck,
  MessageSquareText,
  PencilLine,
  PlusCircle,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityFeedCategory } from '../activities/constants/activity-feed'

export const ACTIVITY_CACHE_KEY = 'activity:v2'

export const activityCategoryIconMap: Record<ActivityFeedCategory, LucideIcon> = {
  comments: MessageSquareText,
  gameCreates: PlusCircle,
  walkthroughCreates: BookOpenCheck,
  edits: PencilLine,
  files: UploadCloud,
}
