import { useLocation, useNavigate, useNavigation } from 'react-router'
import { keepScroll } from '~/features/shell'
import { pageParam } from '~/shared/route/params'
import { librarySearch, withoutConditions, type LibraryContent } from './library'
import { addressFrom } from './library.schema'

export function useLibraryAddress({ address, years }: Pick<LibraryContent, 'address' | 'years'>) {
  const navigate = useNavigate()
  const navigation = useNavigation()
  const location = useLocation()
  const turning =
    navigation.state === 'loading' && navigation.location.pathname === location.pathname
  const wanted = turning ? new URLSearchParams(navigation.location.search) : undefined
  const shown =
    wanted === undefined ? address : addressFrom(wanted, pageParam(wanted.get('page')), years)
  return {
    turning,
    shown,
    narrow: (changes: Partial<typeof address>) =>
      void navigate(
        { search: librarySearch({ ...shown, ...changes, page: 1 }) },
        { state: keepScroll },
      ),
    reset: () =>
      void navigate({ search: librarySearch(withoutConditions(shown)) }, { state: keepScroll }),
    setPage: (page: number) => void navigate({ search: librarySearch({ ...shown, page }) }),
  }
}

export type LibraryControls = ReturnType<typeof useLibraryAddress>
