import { data, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { idParam, optionalIdParam, pageParam } from '~/shared/route/params'
import { readCommand, routeAction, routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import { itemsSearch, lastPage } from './favorite'
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
  removeList,
} from './favorite.use-cases'

export function favoriteListsLoader(args: LoaderFunctionArgs) {
  const gameId = idParam(new URL(args.request.url).searchParams.get('game_id') ?? undefined)
  return routeLazyLoader(args, api => loadFavoriteLists(api, gameId))
}

export async function favoritesLoader(args: LoaderFunctionArgs) {
  const owner = idParam(args.params.id)
  const listId = optionalIdParam(args.params.listId)
  const url = new URL(args.request.url)
  const page = pageParam(url.searchParams.get('page'))
  const favorites = await routeLoader(args, api => loadFavorites(api, owner, listId, page))
  if (listId !== undefined && favorites.selected === undefined) {
    throw data(null, { status: 404 })
  }
  if (page > lastPage(favorites.total)) {
    throw redirect(`${url.pathname}${itemsSearch(lastPage(favorites.total))}`)
  }
  return favorites
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
