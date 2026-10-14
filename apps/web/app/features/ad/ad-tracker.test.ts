import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { View } from './ad'
import { ViewTracker, type Seen, type Watcher } from './ad-tracker'

type Target = { name: string }

let seen: Seen<Target> = () => {}

const watcher = (report: Seen<Target>): Watcher<Target> => {
  seen = report
  return { watch: () => {}, unwatch: () => {} }
}

const element = (): Target => ({ name: 'banner' })

const show = (target: Target, ratio: number) => seen(target, ratio >= 0.5)

function tracker(batch = 50) {
  const sent: View[][] = []
  const views = new ViewTracker({ dwellMs: 1000, delayMs: 1000, batch, watcher })
  views.connect(async seen => {
    sent.push(seen)
  })
  return { views, sent }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ViewTracker', () => {
  it('counts an ad once it has been half visible for a second', async () => {
    const { views, sent } = tracker()
    const banner = element()
    views.observe(banner, { ad_id: 1, slot: 'home' })
    show(banner, 0.6)
    await vi.advanceTimersByTimeAsync(999)
    expect(sent).toEqual([])
    await vi.advanceTimersByTimeAsync(1001)
    expect(sent).toEqual([[{ ad_id: 1, slot: 'home' }]])
  })

  it('does not count an ad that leaves or is not visible enough', async () => {
    const { views, sent } = tracker()
    const glimpsed = element()
    const edge = element()
    views.observe(glimpsed, { ad_id: 1, slot: 'home' })
    views.observe(edge, { ad_id: 2, slot: 'home' })
    show(glimpsed, 1)
    show(edge, 0.3)
    await vi.advanceTimersByTimeAsync(500)
    show(glimpsed, 0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(sent).toEqual([])
  })

  it('counts each ad once per page view and again on the next page', async () => {
    const { views, sent } = tracker()
    const side = element()
    views.observe(side, { ad_id: 3, slot: 'sidebar' })
    show(side, 1)
    await vi.advanceTimersByTimeAsync(2000)
    show(side, 0)
    show(side, 1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(sent.flat()).toEqual([{ ad_id: 3, slot: 'sidebar' }])
    views.newPage()
    await vi.advanceTimersByTimeAsync(2000)
    expect(sent.flat()).toEqual([
      { ad_id: 3, slot: 'sidebar' },
      { ad_id: 3, slot: 'sidebar' },
    ])
  })

  it('sends views in batches the API accepts', async () => {
    const { views, sent } = tracker(2)
    const banners = [1, 2, 3].map(id => {
      const banner = element()
      views.observe(banner, { ad_id: id, slot: 'game' })
      show(banner, 1)
      return banner
    })
    expect(banners).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(3000)
    expect(sent.map(batch => batch.length)).toEqual([2, 1])
  })

  it('keeps what it counted until a sender is connected', async () => {
    const views = new ViewTracker({ dwellMs: 1000, delayMs: 1000, batch: 50, watcher })
    const banner = element()
    views.observe(banner, { ad_id: 4, slot: 'resource' })
    show(banner, 1)
    await vi.advanceTimersByTimeAsync(3000)
    const sent: View[][] = []
    views.connect(async seen => {
      sent.push(seen)
    })
    await vi.advanceTimersByTimeAsync(1000)
    expect(sent).toEqual([[{ ad_id: 4, slot: 'resource' }]])
  })
})
