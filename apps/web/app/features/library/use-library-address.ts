import { useNavigation } from 'react-router'
import { pageParam } from '~/shared/route/params'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { librarySearch, withoutConditions, type LibraryContent } from './library'
import { addressFrom } from './library.schema'

export function useLibraryAddress({ address, years }: Pick<LibraryContent, 'address' | 'years'>) {
  const stay = useInPageNavigate()
  const navigation = useNavigation()
  const { turning, turn } = usePageTurn()
  const wanted = turning ? new URLSearchParams(navigation.location?.search) : undefined
  const shown =
    wanted === undefined ? address : addressFrom(wanted, pageParam(wanted.get('page')), years)
  return {
    turning,
    shown,
    narrow: (changes: Partial<typeof address>) =>
      stay({ search: librarySearch({ ...shown, ...changes, page: 1 }) }),
    reset: () => stay({ search: librarySearch(withoutConditions(shown)) }),
    setPage: (page: number) => turn({ search: librarySearch({ ...shown, page }) }),
  }
}

export type LibraryControls = ReturnType<typeof useLibraryAddress>
