import { resolvePath, useLocation, useNavigate, useNavigation, type To } from 'react-router'
import { listStart, searchAtPage } from '~/shared/http/paging'

export function usePageTurn() {
  const navigate = useNavigate()
  const navigation = useNavigation()
  const location = useLocation()
  const turn = (to: To) => void navigate({ ...resolvePath(to, location.pathname), hash: listStart })
  return {
    turning: navigation.state === 'loading' && navigation.location.pathname === location.pathname,
    turn,
    turnTo: (page: number) => turn({ search: searchAtPage(location.search, page) }),
  }
}
