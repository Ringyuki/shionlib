type Place = { pathname: string; search: string }

type Click = {
  button: number
  metaKey: boolean
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  defaultPrevented: boolean
}

export function changesPage(from: Place, to: Place): boolean {
  return to.pathname !== from.pathname || to.search !== from.search
}

export function navigatesHere(click: Click, target: string | undefined): boolean {
  const modified = click.metaKey || click.altKey || click.ctrlKey || click.shiftKey
  const ownTab = target === undefined || target === '_self'
  return !click.defaultPrevented && click.button === 0 && !modified && ownTab
}
