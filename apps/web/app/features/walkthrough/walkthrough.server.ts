import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam, optionalIdParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { editedParam, pageSize, userPageSize } from './walkthrough'
import { walkthroughRemovalCommand, walkthroughSaveCommand } from './walkthrough.schema'
import {
  loadDraft,
  loadReading,
  loadUserWalkthroughs,
  loadWalkthroughs,
  removeWalkthrough,
  saveWalkthrough,
} from './walkthrough.use-cases'

export async function walkthroughsLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(args.params.id)
  const page = requestedPage(args.request)
  const walkthroughs = await routeLoader(args, api => loadWalkthroughs(api, gameId, page))
  keepWithinPages(args.request, walkthroughs.total, pageSize)
  return walkthroughs
}

export async function userWalkthroughsLoader(args: LoaderFunctionArgs) {
  const userId = idParam(args.params.id)
  const page = requestedPage(args.request)
  const walkthroughs = await routeLoader(args, api => loadUserWalkthroughs(api, userId, page))
  keepWithinPages(args.request, walkthroughs.total, userPageSize)
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

export async function editorLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(args.params.id)
  const edited = new URL(args.request.url).searchParams.get(editedParam) ?? undefined
  const walkthroughId = optionalIdParam(edited)
  const draft = await routeLoader(args, api => loadDraft(api, gameId, walkthroughId))
  if (draft === undefined) {
    throw data(null, { status: 404 })
  }
  return draft
}

export async function walkthroughSaveAction(args: ActionFunctionArgs) {
  const save = await readCommand(args, walkthroughSaveCommand)
  return routeAction(args, async api => {
    const saved = await saveWalkthrough(api, save)
    return { id: saved.id, status: saved.status, reviewPending: saved.review_pending }
  })
}

export async function walkthroughRemovalAction(args: ActionFunctionArgs) {
  const removal = await readCommand(args, walkthroughRemovalCommand)
  return routeAction(args, api => removeWalkthrough(api, removal))
}
