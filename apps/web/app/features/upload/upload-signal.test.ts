import { describe, expect, it, vi } from 'vitest'
import { linkSignals } from './upload-signal'

describe('linkSignals', () => {
  it('aborts with the reason of the first source that aborts', () => {
    const paused = new AbortController()
    const stalled = new AbortController()
    const linked = linkSignals([paused.signal, stalled.signal])
    const heard = vi.fn()
    linked.signal.addEventListener('abort', heard)
    expect(linked.signal.aborted).toBe(false)

    stalled.abort('stalled')
    paused.abort('paused')

    expect(linked.signal.aborted).toBe(true)
    expect(linked.signal.reason).toBe('stalled')
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('starts aborted when a source already is', () => {
    const open = new AbortController()
    const linked = linkSignals([open.signal, AbortSignal.abort('cancelled')])
    expect(linked.signal.aborted).toBe(true)
    expect(linked.signal.reason).toBe('cancelled')
  })

  it('stops listening to every source once one aborts', () => {
    const paused = new AbortController()
    const stalled = new AbortController()
    const unhooked = vi.spyOn(paused.signal, 'removeEventListener')
    linkSignals([paused.signal, stalled.signal])
    stalled.abort('stalled')
    expect(unhooked).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('no longer follows its sources once released', () => {
    const paused = new AbortController()
    const linked = linkSignals([paused.signal])
    linked.release()
    paused.abort('paused')
    expect(linked.signal.aborted).toBe(false)
  })
})
