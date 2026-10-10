import { useEffect, useState } from 'react'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { usePageTurn } from '~/shared/route/use-page-turn'
import { listingSearch, searchDelay, type Listing, type Order, type Stage } from './uploader'

export function useListing(listing: Listing) {
  const stay = useInPageNavigate()
  const { turning, turn } = usePageTurn()
  const [draft, setDraft] = useState(listing.search)
  const [known, setKnown] = useState(listing.search)
  if (known !== listing.search) {
    setKnown(listing.search)
    if (draft.trim() !== listing.search) {
      setDraft(listing.search)
    }
  }
  const narrow = (changes: Partial<Listing>) =>
    stay(
      { search: listingSearch({ ...listing, page: 1, ...changes }) },
      { replace: 'search' in changes },
    )
  useEffect(() => {
    const wanted = draft.trim()
    if (wanted === listing.search) {
      return
    }
    const timer = window.setTimeout(() => narrow({ search: wanted }), searchDelay)
    return () => window.clearTimeout(timer)
  })
  return {
    draft,
    setDraft,
    turning,
    setStage: (stage: Stage | undefined) => narrow({ stage }),
    setOrder: ({ sort, ascending }: Order) => narrow({ sort, ascending }),
    setPage: (page: number) => turn({ search: listingSearch({ ...listing, page }) }),
  }
}
