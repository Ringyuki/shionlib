import { viewKey, type View } from './ad'

export type Watcher<Target> = {
  watch: (target: Target) => void
  unwatch: (target: Target) => void
}

export type Seen<Target> = (target: Target, visible: boolean) => void

export type TrackerOptions<Target> = {
  dwellMs: number
  delayMs: number
  batch: number
  watcher: (seen: Seen<Target>) => Watcher<Target>
}

export type Send = (views: View[]) => Promise<unknown>

type Watched = {
  view: View
  visible: boolean
  timer: ReturnType<typeof setTimeout> | undefined
}

export function viewportWatcher(share: number) {
  return (seen: Seen<Element>): Watcher<Element> => {
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          seen(entry.target, entry.isIntersecting && entry.intersectionRatio >= share)
        }
      },
      { threshold: [share] },
    )
    return {
      watch: target => observer.observe(target),
      unwatch: target => observer.unobserve(target),
    }
  }
}

export class ViewTracker<Target extends object> {
  private readonly watched = new Map<Target, Watched>()
  private readonly counted = new Set<string>()
  private readonly options: TrackerOptions<Target>
  private queue: View[] = []
  private flushTimer: ReturnType<typeof setTimeout> | undefined
  private sending = false
  private watcher: Watcher<Target> | undefined
  private send: Send | undefined

  constructor(options: TrackerOptions<Target>) {
    this.options = options
  }

  observe(target: Target, view: View): () => void {
    this.watched.set(target, { view, visible: false, timer: undefined })
    this.watching().watch(target)
    return () => {
      clearTimeout(this.watched.get(target)?.timer)
      this.watched.delete(target)
      this.watcher?.unwatch(target)
    }
  }

  newPage(): void {
    this.counted.clear()
    for (const watched of this.watched.values()) {
      this.mark(watched, watched.visible)
    }
  }

  connect(send: Send): () => void {
    this.send = send
    if (this.queue.length > 0) {
      this.schedule()
    }
    return () => {
      this.send = undefined
      clearTimeout(this.flushTimer)
    }
  }

  private watching(): Watcher<Target> {
    this.watcher ??= this.options.watcher((target, visible) => {
      const watched = this.watched.get(target)
      if (watched !== undefined) {
        this.mark(watched, visible)
      }
    })
    return this.watcher
  }

  private mark(watched: Watched, visible: boolean): void {
    clearTimeout(watched.timer)
    watched.visible = visible
    watched.timer = visible
      ? setTimeout(() => this.count(watched.view), this.options.dwellMs)
      : undefined
  }

  private count(view: View): void {
    const key = viewKey(view)
    if (this.counted.has(key)) {
      return
    }
    this.counted.add(key)
    this.queue.push(view)
    this.schedule()
  }

  private schedule(): void {
    clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => void this.flush(), this.options.delayMs)
  }

  private async flush(): Promise<void> {
    const send = this.send
    if (send === undefined || this.sending || this.queue.length === 0) {
      return
    }
    const views = this.queue.splice(0, this.options.batch)
    this.sending = true
    try {
      await send(views)
    } finally {
      this.sending = false
    }
    if (this.queue.length > 0) {
      this.schedule()
    }
  }
}
