import { browserApiBase } from './browser'
import { sendWithSession } from './browser-client'
import type { ApiPath } from './types'

export type EventHandlers = Readonly<Record<string, (data: string) => void>>

export type EventStreamOptions = {
  probe: ApiPath<'get'>
  retryAfter?: number
  origin?: string
}

const defaultRetryAfter = 30_000

export function followEvents(
  path: ApiPath<'get'>,
  handlers: EventHandlers,
  { probe, retryAfter = defaultRetryAfter, origin = location.origin }: EventStreamOptions,
): () => void {
  let source: EventSource | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const later = () => {
    timer = setTimeout(() => void open(), retryAfter)
  }

  const signedIn = async (): Promise<boolean | undefined> => {
    try {
      const response = await sendWithSession({
        method: 'GET',
        url: `${origin}${browserApiBase}${probe}`,
      })
      return response.status !== 401
    } catch {
      return undefined
    }
  }

  const open = async () => {
    const ready = await signedIn()
    if (stopped || ready === false) {
      return
    }
    if (ready === undefined) {
      later()
      return
    }
    const opened = new EventSource(`${origin}${browserApiBase}${path}`, { withCredentials: true })
    source = opened
    for (const [name, handle] of Object.entries(handlers)) {
      opened.addEventListener(name, event => {
        if (event instanceof MessageEvent && typeof event.data === 'string') {
          handle(event.data)
        }
      })
    }
    opened.addEventListener('error', () => {
      if (opened.readyState === EventSource.CLOSED && !stopped) {
        later()
      }
    })
  }

  void open()

  return () => {
    stopped = true
    clearTimeout(timer)
    source?.close()
  }
}
