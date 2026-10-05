import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { membershipChangeCommand } from './favorite.schema'
import { changeMembership, loadFavoriteLists } from './favorite.use-cases'

export function favoriteListsLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(new URL(args.request.url).searchParams.get('game_id') ?? undefined)
  return routeLoader(args, api => loadFavoriteLists(api, gameId))
}

export async function favoriteMembershipAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, membershipChangeCommand)
  return routeAction(args, api => changeMembership(api, change))
}
