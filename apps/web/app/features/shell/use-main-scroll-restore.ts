import {
  createScrollRestorer,
  SCROLL_AT_ATTR,
  SCROLL_RESTORE_ATTR,
  type AppShellHandle,
  type ScrollRestorer,
} from '@hina-ui/react'
import { useEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigation } from 'react-router'
import { historyStateOf, scrollTopOf } from './shell.schema'

const abandonEvents = ['wheel', 'touchstart', 'keydown'] as const

export function useMainScrollRestore(shell: RefObject<AppShellHandle | null>, key: string) {
  const restorer = useRef<ScrollRestorer | null>(null)
  const location = useLocation()
  const navigation = useNavigation()
  const mounted = useRef(false)

  useEffect(() => {
    let frame = 0
    let teardown = () => {}
    const start = () => {
      const viewport = shell.current?.mainViewport
      if (viewport === undefined) {
        frame = window.requestAnimationFrame(start)
        return
      }
      teardown = attach(viewport)
    }
    const attach = (viewport: HTMLElement) => {
      const target = document.querySelector(`[${SCROLL_RESTORE_ATTR}="${key}"]`)
      const current = createScrollRestorer(key, {
        getViewport: () => shell.current?.mainViewport ?? null,
        takeFirstPaintTop: () => {
          const at = target?.getAttribute(SCROLL_AT_ATTR)
          target?.removeAttribute(SCROLL_AT_ATTR)
          return scrollTopOf(at)
        },
        readState: () => {
          const state = historyStateOf(window.history.state)
          return { ...state, position: state.idx }
        },
        writeState: state => window.history.replaceState(state, ''),
        setTimer: (run, ms) => {
          const id = window.setTimeout(run, ms)
          return () => window.clearTimeout(id)
        },
      })
      restorer.current = current
      const saveSoon = () => current.saveSoon()
      const abandon = () => current.abandon()
      const save = () => current.save()
      viewport.addEventListener('scroll', saveSoon, { passive: true })
      for (const name of abandonEvents) {
        viewport.addEventListener(name, abandon, { passive: true })
      }
      window.addEventListener('pagehide', save)
      current.restore(true)
      return () => {
        viewport.removeEventListener('scroll', saveSoon)
        for (const name of abandonEvents) {
          viewport.removeEventListener(name, abandon)
        }
        window.removeEventListener('pagehide', save)
        current.dispose()
        restorer.current = null
      }
    }
    start()
    return () => {
      window.cancelAnimationFrame(frame)
      teardown()
    }
  }, [shell, key])

  useEffect(() => {
    if (navigation.state === 'loading') {
      restorer.current?.save()
    }
  }, [navigation.state])

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const frame = window.requestAnimationFrame(() => {
      restorer.current?.restore()
      if (location.hash !== '') {
        document.getElementById(location.hash.slice(1))?.scrollIntoView()
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.key, location.hash])
}
