const settledAfter = 600

const held = new WeakMap<HTMLElement, () => void>()

function scrollerOf(element: Element): Element {
  for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent)
    const scrolls = overflowY === 'auto' || overflowY === 'scroll'
    if (scrolls && parent.scrollHeight > parent.clientHeight) {
      return parent
    }
  }
  return document.scrollingElement ?? document.documentElement
}

function shownFrom(scroller: Element): number {
  return scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top
}

function placeIn(scroller: Element, element: Element): number {
  return element.getBoundingClientRect().top - shownFrom(scroller) + scroller.scrollTop
}

export function startsInView(element: Element): boolean {
  return element.getBoundingClientRect().top >= shownFrom(scrollerOf(element))
}

export function holdInPlace(kept: HTMLElement, resized: Element): void {
  const scroller = scrollerOf(kept)
  if (!(scroller instanceof HTMLElement)) {
    return
  }
  held.get(scroller)?.()
  const from = placeIn(scroller, kept)
  const anchoring = scroller.style.overflowAnchor
  let followed = 0
  const observer = new ResizeObserver(() => {
    const before = scroller.scrollTop
    scroller.scrollTop = before + placeIn(scroller, kept) - from - followed
    followed += scroller.scrollTop - before
  })
  const release = () => {
    window.clearTimeout(timer)
    observer.disconnect()
    scroller.style.overflowAnchor = anchoring
    held.delete(scroller)
  }
  const timer = window.setTimeout(release, settledAfter)
  held.set(scroller, release)
  scroller.style.overflowAnchor = 'none'
  observer.observe(resized)
}
