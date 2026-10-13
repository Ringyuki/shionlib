import { useEffect, useEffectEvent, useState } from 'react'
import { useNavigation } from 'react-router'

export function useQueryDraft(shown: string, delay: number, apply: (query: string) => void) {
  const navigation = useNavigation()
  const [draft, setDraft] = useState(shown)
  const [known, setKnown] = useState(shown)
  if (known !== shown) {
    setKnown(shown)
    if (draft.trim() !== shown) {
      setDraft(shown)
    }
  }
  const send = useEffectEvent(apply)
  const wanted = draft.trim()
  useEffect(() => {
    if (wanted === shown) {
      return
    }
    const timer = window.setTimeout(() => send(wanted), delay)
    return () => window.clearTimeout(timer)
  }, [wanted, shown, delay])
  return {
    draft,
    setDraft,
    searching: navigation.state === 'loading' && wanted !== shown,
  }
}
