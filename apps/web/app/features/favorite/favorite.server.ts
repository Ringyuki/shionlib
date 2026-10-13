import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam, optionalIdParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import { itemsPageSize, showcasePageSize } from './favorite'
import {
  listCreationCommand,
  listEditCommand,
  listRemovalCommand,
  membershipChangeCommand,
  noteChangeCommand,
} from './favorite.schema'
import {
  changeMembership,
  changeNote,
  createList,
  editList,
  loadFavoriteLists,
  loadFavorites,
  loadShowcase,
  removeList,
} from './favorite.use-cases'

export function favoriteListsLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(args.url.searchParams.get('game_id') ?? undefined)
  return routeLazyLoader(args, api => loadFavoriteLists(api, gameId))
}

export async function favoritesLoader(args: LoaderFunctionArgs) {
  const listId = optionalIdParam(args.params.listId)
  const page = requestedPage(args.url)
  const favorites = await routeLoader(args, api => loadFavorites(api, listId, page))
  if (listId !== undefined && favorites.selected === undefined) {
    throw data(null, { status: 404 })
  }
  keepWithinPages(args.url, favorites.total, itemsPageSize)
  return favorites
}

export async function showcaseLoader(args: LoaderFunctionArgs) {
  const owner = idParam(args.params.id)
  const listId = optionalIdParam(args.params.listId)
  const page = requestedPage(args.url)
  const showcase = await routeLoader(args, api => loadShowcase(api, owner, listId, page))
  if (listId !== undefined && showcase.selected === undefined) {
    throw data(null, { status: 404 })
  }
  keepWithinPages(args.url, showcase.total, showcasePageSize)
  return showcase
}

export async function favoriteMembershipAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, membershipChangeCommand)
  return routeAction(args, api => changeMembership(api, change))
}

export async function createFavoriteListAction(args: ActionFunctionArgs) {
  const creation = await readCommand(args, listCreationCommand)
  return routeAction(args, api => createList(api, creation))
}

export async function editFavoriteListAction(args: ActionFunctionArgs) {
  const edit = await readCommand(args, listEditCommand)
  return routeAction(args, api => editList(api, edit))
}

export async function removeFavoriteListAction(args: ActionFunctionArgs) {
  const removal = await readCommand(args, listRemovalCommand)
  return routeAction(args, api => removeList(api, removal))
}

export async function favoriteNoteAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, noteChangeCommand)
  return routeAction(args, api => changeNote(api, change))
}
