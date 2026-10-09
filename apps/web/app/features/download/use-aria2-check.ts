import { useState } from 'react'
import { reachAria2, type Aria2Reach, type Aria2Target } from '~/shared/vendor/aria2'

export function useAria2Check() {
  const [checking, setChecking] = useState(false)
  const [reach, setReach] = useState<Aria2Reach>()
  const check = async (target: Pick<Aria2Target, 'endpoint' | 'secret'>) => {
    setChecking(true)
    setReach(await reachAria2(target))
    setChecking(false)
  }
  return { check, checking, reach, forget: () => setReach(undefined) }
}
