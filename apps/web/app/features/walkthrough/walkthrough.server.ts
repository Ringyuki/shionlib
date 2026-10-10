import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { loadViewer } from '~/features/viewer'
import { isLocale } from '~/shared/i18n/locale.schema'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam, optionalIdParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { userPageSize, writingPath } from './walkthrough'
import { walkthroughRemovalCommand, walkthroughSaveCommand } from './walkthrough.schema'
import {
  loadGuides,
  loadUserWalkthroughs,
  loadWriting,
  removeWalkthrough,
  saveWalkthrough,
} from './walkthrough.use-cases'

export async function guidesLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(args.params.id)
  const walkthroughId = optionalIdParam(args.params.walkthroughId)
  const guides = await routeLoader(args, api => loadGuides(api, gameId, walkthroughId))
  if (guides === undefined) {
    throw data(null, { status: 404 })
  }
  return guides
}

export async function userWalkthroughsLoader(args: LoaderFunctionArgs) {
  const userId = idParam(args.params.id)
  const page = requestedPage(args.url)
  const walkthroughs = await routeLoader(args, api => loadUserWalkthroughs(api, userId, page))
  keepWithinPages(args.url, walkthroughs.total, userPageSize)
  return walkthroughs
}

export function writingLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(args.params.id)
  return routeLoader(args, async api => {
    const viewer = await loadViewer(api)
    return loadWriting(api, gameId, viewer?.id)
  })
}

export function legacyWritingRedirect({ params }: LoaderFunctionArgs) {
  const gameId = idParam(params.id)
  if (!isLocale(params.lang)) {
    throw data(null, { status: 404 })
  }
  return redirect(writingPath(params.lang, gameId), 301)
}

export async function walkthroughSaveAction(args: ActionFunctionArgs) {
  const save = await readCommand(args, walkthroughSaveCommand)
  return routeAction(args, api => saveWalkthrough(api, save))
}

export async function walkthroughRemovalAction(args: ActionFunctionArgs) {
  const removal = await readCommand(args, walkthroughRemovalCommand)
  return routeAction(args, api => removeWalkthrough(api, removal))
}
