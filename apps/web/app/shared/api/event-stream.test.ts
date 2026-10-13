import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { followEvents } from './event-stream'
import { fakeXhr, type FakeXhrReply } from './xhr-testing'

type Listener = (event: Event) => void

class FakeEventSource {
  static readonly CLOSED = 2
  static opened: FakeEventSource[] = []
  readyState = 1
  closed = false
  readonly url: string
  readonly init: EventSourceInit | undefined
  private readonly listeners = new Map<string, Listener[]>()

  constructor(url: string, init?: EventSourceInit) {
    this.url = url
    this.init = init
    FakeEventSource.opened.push(this)
  }

  addEventListener(name: string, listener: Listener) {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener])
  }

  emit(name: string, data: string) {
    for (const listener of this.listeners.get(name) ?? []) {
      listener(new MessageEvent(name, { data }))
    }
  }

  fail() {
    this.readyState = FakeEventSource.CLOSED
    for (const listener of this.listeners.get('error') ?? []) {
      listener(new Event('error'))
    }
  }

  close() {
    this.closed = true
  }
}

function install(reply: () => FakeXhrReply) {
  const fake = fakeXhr(reply)
  vi.stubGlobal('XMLHttpRequest', fake.XMLHttpRequest)
  return fake
}

const options = { probe: '/message/unread', origin: 'http://web.test', retryAfter: 1000 } as const

const settle = () => vi.advanceTimersByTimeAsync(0)

beforeEach(() => {
  vi.useFakeTimers()
  FakeEventSource.opened = []
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('followEvents', () => {
  it('opens the stream once the session answers and hands each event to its handler', async () => {
    const xhr = install(() => ({ status: 200, text: '{"code":0,"data":2}' }))
    const unread = vi.fn()
    followEvents('/message/stream', { 'message:unread': unread }, options)
    await settle()
    expect(xhr.sent[0]?.url).toBe('http://web.test/api/message/unread')
    const [stream] = FakeEventSource.opened
    expect([stream?.url, stream?.init?.withCredentials]).toEqual([
      'http://web.test/api/message/stream',
      true,
    ])
    stream?.emit('message:unread', '{"unread":3}')
    stream?.emit('ping', '{}')
    expect(unread.mock.calls).toEqual([['{"unread":3}']])
  })

  it('does not open a stream for a visitor who is not signed in', async () => {
    install(() => ({ status: 401, text: '{"code":200108,"message":"no session"}' }))
    followEvents('/message/stream', {}, options)
    await settle()
    await vi.advanceTimersByTimeAsync(5000)
    expect(FakeEventSource.opened).toHaveLength(0)
  })

  it('tries again later when the server cannot be reached or the stream is closed', async () => {
    let reachable = false
    install(() => (reachable ? { status: 200, text: '{"code":0,"data":0}' } : 'network-error'))
    followEvents('/message/stream', {}, options)
    await settle()
    expect(FakeEventSource.opened).toHaveLength(0)
    reachable = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(FakeEventSource.opened).toHaveLength(1)
    FakeEventSource.opened[0]?.fail()
    await vi.advanceTimersByTimeAsync(1000)
    expect(FakeEventSource.opened).toHaveLength(2)
  })

  it('closes the stream and stops trying when it is stopped', async () => {
    install(() => ({ status: 200, text: '{"code":0,"data":0}' }))
    const stop = followEvents('/message/stream', {}, options)
    await settle()
    stop()
    expect(FakeEventSource.opened[0]?.closed).toBe(true)
    FakeEventSource.opened[0]?.fail()
    await vi.advanceTimersByTimeAsync(5000)
    expect(FakeEventSource.opened).toHaveLength(1)
  })
})
