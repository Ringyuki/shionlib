import * as v from 'valibot'
import { feedKinds, type FeedKind } from './activity'

const feedKind = v.fallback(v.picklist(feedKinds), 'all')

export function feedKindFrom(raw: unknown): FeedKind {
  return v.parse(feedKind, raw)
}
