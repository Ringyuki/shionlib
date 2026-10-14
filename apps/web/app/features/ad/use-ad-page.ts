import { useMatches } from 'react-router'
import { adPage } from './ad'

export function useAdPage(): boolean {
  return useMatches().some(match => match.handle === adPage && match.loaderData !== undefined)
}
