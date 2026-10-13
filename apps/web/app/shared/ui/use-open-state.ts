import { useState, type Dispatch, type SetStateAction } from 'react'

export function useOpenState<Value>(
  open: boolean,
  initial: () => Value,
): [Value, Dispatch<SetStateAction<Value>>] {
  const [state, setState] = useState(initial)
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setState(initial())
    }
  }
  return [state, setState]
}
