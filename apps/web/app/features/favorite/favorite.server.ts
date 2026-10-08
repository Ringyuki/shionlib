import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { idParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLazyLoader } from '~/shared/route/route.server'
import { listCreationCommand, membershipChangeCommand } from './favorite.schema'
import { changeMembership, createListWithGame, loadFavoriteLists } from './favorite.use-cases'

export function favoriteListsLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(new URL(args.request.url).searchParams.get('game_id') ?? undefined)
  return routeLazyLoader(args, api => loadFavoriteLists(api, gameId))
}

export async function favoriteMembershipAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, membershipChangeCommand)
  return routeAction(args, api => changeMembership(api, change))
}

export async function createFavoriteListAction(args: ActionFunctionArgs) {
  const creation = await readCommand(args, listCreationCommand)
  return routeAction(args, api => createListWithGame(api, creation))
}
