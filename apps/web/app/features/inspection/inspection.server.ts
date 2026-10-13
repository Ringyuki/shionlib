import { data, type LoaderFunctionArgs } from 'react-router'
import { routeFile, routeLazyLoader } from '~/shared/route/route.server'
import { entryIdFrom, wantedPageFrom } from './inspection.schema'
import { loadEntryPage, loadImagePreview, loadTextPreview } from './inspection.use-cases'

function wantedEntry(args: LoaderFunctionArgs): number {
  const entryId = entryIdFrom(args.url.searchParams)
  if (entryId === undefined) {
    throw data(null, { status: 400 })
  }
  return entryId
}

export function entryPageLoader(args: LoaderFunctionArgs) {
  const wanted = wantedPageFrom(args.url.searchParams)
  if (wanted === undefined) {
    throw data(null, { status: 400 })
  }
  return routeLazyLoader(args, api => loadEntryPage(api, wanted))
}

export function textPreviewLoader(args: LoaderFunctionArgs) {
  const entryId = wantedEntry(args)
  return routeLazyLoader(args, api => loadTextPreview(api, entryId))
}

export function imagePreviewLoader(args: LoaderFunctionArgs) {
  const entryId = wantedEntry(args)
  return routeFile(args, api => loadImagePreview(api, entryId))
}
