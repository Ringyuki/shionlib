import { createContext, useContext } from 'react'

export const ExplicitContext = createContext(false)

export function useShowsExplicit(): boolean {
  return useContext(ExplicitContext)
}
