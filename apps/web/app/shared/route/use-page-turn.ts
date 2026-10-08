import { useLocation, useNavigate, useNavigation } from 'react-router'
import { searchAtPage } from '~/shared/http/paging'

export function usePageTurn() {
  const navigate = useNavigate()
  const navigation = useNavigation()
  const location = useLocation()
  return {
    turning: navigation.state === 'loading' && navigation.location.pathname === location.pathname,
    turnTo: (page: number) => void navigate({ search: searchAtPage(location.search, page) }),
  }
}
