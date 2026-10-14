import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { adminPaths, pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { searchWith } from './admin-check'
import {
  caseReviewCommand,
  filterFrom,
  quickReviewCommand,
  stalledCommand,
} from './admin-check.schema'
import { changeStalled, loadChecks, reviewCase, reviewCases } from './admin-check.use-cases'

export async function checksLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadChecks(api, filter, pageSize))
  if (filter.opened !== undefined && listing.opened === undefined) {
    throw redirect(`${args.url.pathname}${searchWith(args.url.search, undefined)}`)
  }
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export function formerChecksLoader(args: LoaderFunctionArgs) {
  const { opened } = filterFrom(args.url.searchParams, 1)
  return redirect(`${adminPaths.checks}${searchWith('', opened)}`)
}

export async function reviewCaseAction(args: ActionFunctionArgs) {
  const review = await readCommand(args, caseReviewCommand)
  return routeAction(args, api => reviewCase(api, review))
}

export async function quickReviewAction(args: ActionFunctionArgs) {
  const review = await readCommand(args, quickReviewCommand)
  return routeAction(args, api => reviewCases(api, review))
}

export async function stalledAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, stalledCommand)
  return routeAction(args, api => changeStalled(api, change))
}
