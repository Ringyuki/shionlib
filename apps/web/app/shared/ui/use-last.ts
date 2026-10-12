import { useState } from 'react'

export function useLast<Value>(value: Value | undefined): Value | undefined {
  const [kept, setKept] = useState(value)
  if (value !== undefined && value !== kept) {
    setKept(value)
  }
  return value ?? kept
}
