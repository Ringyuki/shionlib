import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { pageSize } from '~/features/admin'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { filterFrom, gameCommand } from './admin-game.schema'
import { changeGame, loadGames } from './admin-game.use-cases'

export async function gamesLoader(args: LoaderFunctionArgs) {
  const filter = filterFrom(args.url.searchParams, requestedPage(args.url))
  const listing = await routeLoader(args, api => loadGames(api, filter, pageSize))
  keepWithinPages(args.url, listing.total, pageSize)
  return listing
}

export async function gameAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, gameCommand)
  return routeAction(args, api => changeGame(api, change))
}
