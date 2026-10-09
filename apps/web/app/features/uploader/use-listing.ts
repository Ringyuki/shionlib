import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useNavigation } from 'react-router'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { listingSearch, searchDelay, type Listing, type Order, type Stage } from './uploader'

export function useListing(listing: Listing) {
  const navigate = useNavigate()
  const stay = useInPageNavigate()
  const navigation = useNavigation()
  const location = useLocation()
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
    turning: navigation.state === 'loading' && navigation.location.pathname === location.pathname,
    setStage: (stage: Stage | undefined) => narrow({ stage }),
    setOrder: ({ sort, ascending }: Order) => narrow({ sort, ascending }),
    setPage: (page: number) => void navigate({ search: listingSearch({ ...listing, page }) }),
  }
}
