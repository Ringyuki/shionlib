import type { ApiQuery, Schema } from '~/shared/api/types'
import { pageKey } from '~/shared/http/paging'
import type { Locale } from '~/shared/i18n/locale'

export type Activity = Schema<'ActivityDTO'>

export type ActivityCategory = NonNullable<ApiQuery<'/activity/list', 'get'>['category']>

export type FeedFile = NonNullable<Activity['file']>

export type Feed = {
  kind: FeedKind
  page: number
  happenings: Happening[]
  total: number
}

type Placed = Pick<Activity, 'id' | 'user' | 'created'> & { game: NonNullable<Activity['game']> }

export type Happening =
  | (Placed & { kind: 'resources'; resourceId: number; files: FeedFile[] })
  | (Placed & { kind: 'comments'; commentId: number })
  | (Placed & { kind: 'walkthroughs'; walkthroughId: number; guide: string })

export const feedKinds = ['all', 'resources', 'comments', 'walkthroughs'] as const

export type FeedKind = (typeof feedKinds)[number]

export const pageSize = 30

const kindKey = 'kind'

const categories: Record<Exclude<FeedKind, 'all'>, ActivityCategory> = {
  resources: 'files',
  comments: 'comments',
  walkthroughs: 'walkthroughCreates',
}

export function categoryOf(kind: FeedKind): ActivityCategory | undefined {
  return kind === 'all' ? undefined : categories[kind]
}

export function activityPath(locale: Locale): string {
  return `/${locale}/activity`
}

export function searchOfKind(search: string, kind: FeedKind): string {
  const params = new URLSearchParams(search)
  params.delete(pageKey)
  if (kind === 'all') {
    params.delete(kindKey)
  } else {
    params.set(kindKey, kind)
  }
  const kept = params.toString()
  return kept === '' ? '' : `?${kept}`
}

export function happeningsOf(activities: readonly Activity[]): Happening[] {
  const happenings: Happening[] = []
  for (const activity of activities) {
    const happening = happeningOf(activity)
    const last = happenings.at(-1)
    if (happening === undefined) {
      continue
    }
    if (
      happening.kind === 'resources' &&
      last?.kind === 'resources' &&
      last.resourceId === happening.resourceId &&
      last.user.id === happening.user.id
    ) {
      last.files.push(...happening.files)
    } else {
      happenings.push(happening)
    }
  }
  return happenings
}

function happeningOf(activity: Activity): Happening | undefined {
  const { id, user, created, game, file, comment, walkthrough } = activity
  if (game === null) {
    return undefined
  }
  const placed = { id, user, created, game }
  if (activity.type === 'FILE_UPLOAD_TO_S3') {
    return file === null
      ? undefined
      : { ...placed, kind: 'resources', resourceId: file.resource_id, files: [file] }
  }
  if (activity.type === 'COMMENT') {
    return comment === null ? undefined : { ...placed, kind: 'comments', commentId: comment.id }
  }
  return walkthrough === null
    ? undefined
    : { ...placed, kind: 'walkthroughs', walkthroughId: walkthrough.id, guide: walkthrough.title }
}
