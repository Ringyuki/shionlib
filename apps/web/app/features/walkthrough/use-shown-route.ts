import { useLocation } from 'react-router'
import { routeKey, routeSearch, shownRoute, type Route } from './walkthrough'
import { ordinalFrom } from './walkthrough.schema'

export function useShownRoute(routes: readonly Route[]) {
  const { pathname, search } = useLocation()
  const ordinal = ordinalFrom(new URLSearchParams(search).get(routeKey))
  return {
    index: shownRoute(routes, ordinal),
    hrefOf: (index: number) => `${pathname}${routeSearch(index)}`,
  }
}
