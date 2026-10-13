import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { filterFrom, userCommand } from './admin-user.schema'
import { changeUser, loadUser, loadUsers } from './admin-user.use-cases'

export async function usersLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadUsers(api, filter, pageSize))
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export function userLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, api => loadUser(api, id))
}

export async function userAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, userCommand)
  return routeAction(args, api => changeUser(api, change))
}
