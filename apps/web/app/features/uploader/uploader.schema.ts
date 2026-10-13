import * as v from 'valibot'
import { firstListing, sortKeys, stages, type Listing } from './uploader'

const stage = v.fallback(v.nullable(v.picklist(stages)), null)

const sort = v.fallback(v.picklist(sortKeys), firstListing.sort)

const search = v.fallback(v.pipe(v.string(), v.trim(), v.maxLength(100)), '')

export function listingFrom(params: URLSearchParams, page: number): Listing {
  return {
    stage: v.parse(stage, params.get('status')) ?? undefined,
    search: v.parse(search, params.get('q')),
    sort: v.parse(sort, params.get('sort')),
    ascending: params.get('order') === 'asc',
    page,
  }
}
