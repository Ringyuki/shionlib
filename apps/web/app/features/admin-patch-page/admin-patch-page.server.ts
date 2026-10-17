import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLazyLoader } from '~/shared/route/route.server'
import { assignCommand, lookupCommand } from './admin-patch-page.schema'
import { assignPatchPages, loadPatchPages, lookUpPatchPage } from './admin-patch-page.use-cases'

export function patchPagesLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.url.searchParams.get('id') ?? undefined)
  return routeLazyLoader(args, api => loadPatchPages(api, id))
}

export async function patchPagesAction(args: ActionFunctionArgs) {
  const assignment = await readCommand(args, assignCommand)
  return routeAction(args, api => assignPatchPages(api, assignment))
}

export async function patchPageLookupAction(args: ActionFunctionArgs) {
  const lookup = await readCommand(args, lookupCommand)
  return routeAction(args, api => lookUpPatchPage(api, lookup))
}
