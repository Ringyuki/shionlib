import { useEffect, useState } from 'react'
import { useNavigation } from 'react-router'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { filterDelay, viewSearch, type View } from './inspection'

export function useContentsView(view: View | undefined, first: number | undefined) {
  const stay = useInPageNavigate()
  const navigation = useNavigation()
  const shown = view?.query ?? ''
  const [draft, setDraft] = useState(shown)
  const [known, setKnown] = useState(shown)
  if (known !== shown) {
    setKnown(shown)
    if (draft.trim() !== shown) {
      setDraft(shown)
    }
  }
  const show = (changes: Partial<View>, replace: boolean) =>
    stay({ search: viewSearch({ ...view, ...changes }, first) }, { replace })
  useEffect(() => {
    const wanted = draft.trim()
    if (wanted === shown) {
      return
    }
    const timer = window.setTimeout(() => show({ query: wanted }, true), filterDelay)
    return () => window.clearTimeout(timer)
  })
  return {
    draft,
    setDraft,
    searching: navigation.state === 'loading' && draft.trim() !== shown,
    chooseFile: (inspectionId: number) => show({ inspectionId, query: '' }, false),
  }
}
