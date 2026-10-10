import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { loadViewer } from '~/features/viewer'
import { isLocale } from '~/shared/i18n/locale.schema'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam, optionalIdParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import {
  legacyEditedKey,
  pageSize,
  shelfKey,
  userPageSize,
  writingPath,
  writtenBy,
} from './walkthrough'
import {
  shelfFrom,
  walkthroughPublishCommand,
  walkthroughRemovalCommand,
  walkthroughSaveCommand,
} from './walkthrough.schema'
import {
  loadDraft,
  loadReading,
  loadUserWalkthroughs,
  loadWalkthroughs,
  publishWalkthrough,
  removeWalkthrough,
  saveWalkthrough,
} from './walkthrough.use-cases'

export async function walkthroughsLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(args.params.id)
  const page = requestedPage(args.url)
  const walkthroughs = await routeLoader(args, api => loadWalkthroughs(api, gameId, page))
  keepWithinPages(args.url, walkthroughs.total, pageSize)
  return walkthroughs
}

export async function userWalkthroughsLoader(args: LoaderFunctionArgs) {
  const userId = idParam(args.params.id)
  const page = requestedPage(args.url)
  const shelf = shelfFrom(args.url.searchParams.get(shelfKey))
  const walkthroughs = await routeLoader(args, api =>
    loadUserWalkthroughs(api, userId, page, shelf),
  )
  keepWithinPages(args.url, walkthroughs.total, userPageSize)
  return walkthroughs
}

export async function readingLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(args.params.id)
  const walkthroughId = idParam(args.params.walkthroughId)
  const reading = await routeLoader(args, api => loadReading(api, gameId, walkthroughId))
  if (reading === undefined) {
    throw data(null, { status: 404 })
  }
  return reading
}

export async function writingLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(args.params.id)
  const walkthroughId = optionalIdParam(args.params.walkthroughId)
  const [draft, viewer] = await routeLoader(args, api =>
    Promise.all([loadDraft(api, gameId, walkthroughId), loadViewer(api)]),
  )
  if (draft === undefined || (viewer !== null && !writtenBy(draft, viewer.id))) {
    throw data(null, { status: 404 })
  }
  return draft
}

export function legacyWritingRedirect({ params, url }: LoaderFunctionArgs) {
  const gameId = idParam(params.id)
  const walkthroughId = optionalIdParam(url.searchParams.get(legacyEditedKey) ?? undefined)
  if (!isLocale(params.lang)) {
    throw data(null, { status: 404 })
  }
  return redirect(writingPath(params.lang, gameId, walkthroughId), 301)
}

export async function walkthroughSaveAction(args: ActionFunctionArgs) {
  const save = await readCommand(args, walkthroughSaveCommand)
  return routeAction(args, api => saveWalkthrough(api, save))
}

export async function walkthroughPublishAction(args: ActionFunctionArgs) {
  const publish = await readCommand(args, walkthroughPublishCommand)
  return routeAction(args, api => publishWalkthrough(api, publish))
}

export async function walkthroughRemovalAction(args: ActionFunctionArgs) {
  const removal = await readCommand(args, walkthroughRemovalCommand)
  return routeAction(args, api => removeWalkthrough(api, removal))
}
