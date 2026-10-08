type ShownMatch = { id: string; pathname: string; data: unknown }

type Shown = { url: string; matches: readonly ShownMatch[] }

let shown: Shown | undefined

let staleReloads = 0

const listeners = new Set<() => void>()

export function rememberShown(next: Shown) {
  shown = next
}

export function shownFor(routeId: string, request: URL): { data: unknown } | undefined {
  const matches = shown?.matches ?? []
  const index = matches.findIndex(match => match.id === routeId)
  const match = matches[index]
  if (shown === undefined || match === undefined) {
    return undefined
  }
  const page = index === matches.length - 1
  const same = page
    ? request.pathname + request.search === shown.url
    : inside(match.pathname, request.pathname)
  return same ? { data: match.data } : undefined
}

export function noteStaleReload() {
  staleReloads += 1
  listeners.forEach(listener => listener())
}

export function subscribeToStaleReloads(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function staleReloadCount(): number {
  return staleReloads
}

function inside(parent: string, pathname: string): boolean {
  const base = parent.replace(/\/+$/, '')
  return pathname === base || pathname.startsWith(`${base}/`)
}
