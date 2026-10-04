import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { idParam } from '~/shared/route/params'
import { routeAction, routeLoader } from '~/shared/route/route.server'
import { parseMembershipChange } from './favorite'
import { changeMembership, loadFavoriteLists } from './favorite.use-cases'

export function favoriteListsLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(new URL(args.request.url).searchParams.get('game_id') ?? undefined)
  return routeLoader(args, api => loadFavoriteLists(api, gameId))
}

export async function favoriteMembershipAction(args: ActionFunctionArgs) {
  const change = parseMembershipChange(await args.request.json().catch(() => undefined))
  if (change === undefined) {
    throw data(null, { status: 400 })
  }
  return routeAction(args, api => changeMembership(api, change))
}
