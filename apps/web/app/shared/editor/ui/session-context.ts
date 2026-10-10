import { createContext, useContext } from 'react'
import type { EditorSession } from '../session'

export const SessionContext = createContext<EditorSession | null>(null)

export function useEditorSession(): EditorSession | null {
  return useContext(SessionContext)
}
