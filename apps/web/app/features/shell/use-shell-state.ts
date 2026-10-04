import type { SidebarState } from '@hina-ui/react'
import { useState } from 'react'
import { sidebarCookieValue, type SidebarMode } from './shell'

export function useShellState(initial: SidebarMode) {
  const [mode, setMode] = useState<SidebarMode>(initial)
  const [mobileOpen, setMobileOpen] = useState(false)
  const changeMode = (state: SidebarState) => {
    const next: SidebarMode = state === 'rail' ? 'rail' : 'expanded'
    setMode(next)
    document.cookie = sidebarCookieValue(next)
  }
  return {
    mode,
    changeMode,
    mobileOpen,
    setMobileOpen,
    closeMobile: () => setMobileOpen(false),
  }
}
