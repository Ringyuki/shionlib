import { keepScrollPosition } from '@hina-ui/react'
import { resolvePath, useLocation, useNavigate, type NavigateOptions, type To } from 'react-router'
import { changesPage } from './in-page'

export function usePositionHold() {
  const location = useLocation()
  return (to: To) => {
    if (changesPage(location, resolvePath(to, location.pathname))) {
      keepScrollPosition()
    }
  }
}

export function useInPageNavigate() {
  const navigate = useNavigate()
  const hold = usePositionHold()
  return (to: To, options: Pick<NavigateOptions, 'replace'> = {}) => {
    hold(to)
    void navigate(to, { ...options, preventScrollReset: true })
  }
}
