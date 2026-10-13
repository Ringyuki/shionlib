import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { darkClass, darkQuery, themeCookieValue, type ThemePreference } from './theme'

type ThemeState = {
  preference: ThemePreference
  change: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeState>({ preference: 'system', change: () => undefined })

function applyTheme(preference: ThemePreference) {
  const dark =
    preference === 'dark' || (preference === 'system' && window.matchMedia(darkQuery).matches)
  document.documentElement.classList.toggle(darkClass, dark)
}

export function ThemeProvider({
  initial,
  children,
}: {
  initial: ThemePreference
  children: ReactNode
}) {
  const [preference, setPreference] = useState(initial)

  useEffect(() => {
    applyTheme(preference)
    if (preference !== 'system') {
      return
    }
    const media = window.matchMedia(darkQuery)
    const follow = () => applyTheme('system')
    media.addEventListener('change', follow)
    return () => media.removeEventListener('change', follow)
  }, [preference])

  const change = (next: ThemePreference) => {
    document.cookie = themeCookieValue(next)
    setPreference(next)
  }

  return <ThemeContext value={{ preference, change }}>{children}</ThemeContext>
}

export function useTheme(): ThemeState {
  return useContext(ThemeContext)
}
