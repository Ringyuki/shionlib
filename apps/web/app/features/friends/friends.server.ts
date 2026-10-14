import type { LoaderFunctionArgs } from 'react-router'
import { routeLoader } from '~/shared/route/route.server'
import { loadFriends } from './friends.use-cases'

export async function friendsLoader(args: LoaderFunctionArgs) {
  return { friends: await routeLoader(args, loadFriends) }
}
