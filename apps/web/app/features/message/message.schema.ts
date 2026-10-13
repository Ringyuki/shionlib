import * as v from 'valibot'
import type { Schema } from '~/shared/api/types'
import { categories, type Category } from './message'

const category = v.picklist(categories)

const messageId = v.pipe(v.string(), v.toNumber(), v.safeInteger(), v.minValue(1))

const unread = v.pipe(v.string(), v.parseJson(), v.object({ unread: v.number() }))

export function categoryFrom(segment: string | undefined): Category | undefined {
  if (segment === undefined) {
    return 'all'
  }
  const parsed = v.safeParse(category, segment)
  return parsed.success && parsed.output !== 'all' ? parsed.output : undefined
}

export function openedFrom(raw: string | null): number | undefined {
  const parsed = v.safeParse(messageId, raw)
  return parsed.success ? parsed.output : undefined
}

export function unreadFrom(data: string): Schema<'MessageUnreadEventDTO'>['unread'] | undefined {
  const parsed = v.safeParse(unread, data)
  return parsed.success ? parsed.output.unread : undefined
}
