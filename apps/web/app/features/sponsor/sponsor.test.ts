import { describe, expect, it } from 'vitest'
import {
  badgeDays,
  badgeUntil,
  captionOf,
  cardOf,
  celebrates,
  feeOf,
  methodOf,
  owned,
  previewOf,
  remembered,
  shownCard,
  sponsorPaths,
  stageOf,
  startedFor,
  toCents,
  type Order,
  type OrderView,
  type Self,
  type Started,
  type WallEntry,
} from './sponsor'

const self: Self = {
  id: 9,
  name: 'ringyuki',
  avatar: 'user/9/avatar/a.webp',
  cover: 'user/9/cover/c.webp',
  bio: ' Galgame 玩家 ',
  is_sponsor: true,
  sponsor_expires_at: '2026-12-12T00:00:00.000Z',
}

const order: Order = {
  id: 4,
  providerOrderId: 'idr-4',
  amount: 10,
  status: 'DONE',
  sponsorName: null,
  user: { id: 9, name: 'ringyuki', avatar: 'user/9/avatar/a.webp', is_sponsor: true },
  message: ' 加油 ',
  isPrivate: false,
  paymentMethod: { id: 'alipay', name: 'Alipay', brand: 'alipay', fee_rate: null, fee_fixed: null },
  paidAt: '2026-10-13T06:06:00.000Z',
  expiresAt: null,
  created: '2026-10-13T06:00:00.000Z',
}

const view = (changed: Partial<Order>): OrderView => ({
  order: { ...order, ...changed },
  badge_until: null,
  payment_methods: null,
})

describe('sponsorPaths', () => {
  it('keeps the token of a guest in the address of the order', () => {
    const paths = sponsorPaths('zh')
    expect(paths.wall).toBe('/zh/sponsor')
    expect(paths.checkout).toBe('/zh/sponsor/new')
    expect(paths.order(4)).toBe('/zh/sponsor/orders/4')
    expect(paths.order(4, '')).toBe('/zh/sponsor/orders/4')
    expect(paths.order(4, 'a b')).toBe('/zh/sponsor/orders/4?token=a+b')
  })
})

describe('cardOf', () => {
  const entry: WallEntry = {
    id: 1,
    user: {
      id: 9,
      name: 'ringyuki',
      avatar: null,
      cover: 'c.webp',
      bio: ' 简介 ',
      is_sponsor: true,
    },
    name: null,
    message: null,
    sponsored_at: '2026-10-02T00:00:00.000Z',
  }

  it('shows what the profile of a sponsor shows', () => {
    expect(cardOf(entry)).toEqual({
      userId: 9,
      name: 'ringyuki',
      avatar: null,
      cover: 'c.webp',
      bio: '简介',
      active: true,
      message: '',
      at: '2026-10-02T00:00:00.000Z',
    })
  })

  it('shows the name a sponsor without an account gave, or none', () => {
    expect(cardOf({ ...entry, user: null, name: ' 路过的玩家 ', message: '找到了' })).toMatchObject(
      {
        userId: undefined,
        name: '路过的玩家',
        cover: null,
        active: false,
        message: '找到了',
      },
    )
    expect(cardOf({ ...entry, user: null, name: '  ' }).name).toBeUndefined()
  })
})

describe('previewOf', () => {
  it('previews the profile of the viewer with the message being written', () => {
    expect(previewOf(self, { name: 'ignored', message: ' 加油 ' })).toEqual({
      userId: undefined,
      name: 'ringyuki',
      avatar: 'user/9/avatar/a.webp',
      cover: 'user/9/cover/c.webp',
      bio: 'Galgame 玩家',
      active: true,
      message: '加油',
      at: undefined,
    })
  })

  it('previews the name a guest signs with', () => {
    expect(previewOf(null, { name: ' 路过 ', message: '' })).toMatchObject({
      name: '路过',
      active: false,
    })
    expect(previewOf(null, { name: '', message: '' }).name).toBeUndefined()
  })
})

describe('badge', () => {
  it('gives whole days for the cents paid', () => {
    expect(badgeDays(5, 6)).toBe(30)
    expect(badgeDays(1.99, 6)).toBe(11)
    expect(badgeDays(0.1, 6)).toBe(0)
  })

  it('adds to a badge that still runs and starts over after one that ran out', () => {
    const now = new Date('2026-10-13T00:00:00.000Z')
    expect(badgeUntil(now, null, 60).toISOString()).toBe('2026-12-12T00:00:00.000Z')
    expect(badgeUntil(now, '2026-10-23T00:00:00.000Z', 30).toISOString()).toBe(
      '2026-11-22T00:00:00.000Z',
    )
    expect(badgeUntil(now, '2026-01-01T00:00:00.000Z', 30).toISOString()).toBe(
      '2026-11-12T00:00:00.000Z',
    )
  })

  it('keeps an amount to cents', () => {
    expect(toCents(12.345)).toBe(12.35)
    expect(toCents(10)).toBe(10)
  })
})

describe('order', () => {
  it('knows an order it may read from one that was held back', () => {
    expect(owned(view({}))).toBe(true)
    expect(owned(view({ providerOrderId: '' }))).toBe(false)
  })

  it('names the stage of each status', () => {
    expect(stageOf({ status: 'NEW' })).toBe('pay')
    expect(stageOf({ status: 'DONE' })).toBe('done')
    expect(stageOf({ status: 'EXPIRED' })).toBe('expired')
    expect(stageOf({ status: 'REFUND' })).toBe('refunded')
  })

  it('shows the card of a public order with the profile of its owner', () => {
    expect(shownCard(order, self)).toEqual({
      userId: 9,
      name: 'ringyuki',
      avatar: 'user/9/avatar/a.webp',
      cover: 'user/9/cover/c.webp',
      bio: 'Galgame 玩家',
      active: true,
      message: '加油',
      at: '2026-10-13T06:06:00.000Z',
    })
    expect(shownCard(order, null)).toMatchObject({ cover: null, bio: '' })
    expect(shownCard({ ...order, user: null, sponsorName: '路过' }, null)).toMatchObject({
      userId: undefined,
      name: '路过',
      active: false,
    })
    expect(shownCard({ ...order, isPrivate: true }, self)).toBeUndefined()
  })

  it('celebrates an order that was paid a moment ago', () => {
    const paid = { status: 'DONE', paidAt: '2026-10-13T06:06:00.000Z' } as const
    expect(celebrates(paid, new Date('2026-10-13T06:07:00.000Z'))).toBe(true)
    expect(celebrates(paid, new Date('2026-10-13T06:30:00.000Z'))).toBe(false)
    expect(celebrates({ status: 'NEW', paidAt: null }, new Date('2026-10-13T06:07:00.000Z'))).toBe(
      false,
    )
  })

  it('remembers the latest celebrated orders once each', () => {
    expect(remembered([1, 2], 2)).toEqual([1, 2])
    expect(remembered([1, 2], 3)).toEqual([1, 2, 3])
    expect(
      remembered(
        Array.from({ length: 20 }, (_, index) => index),
        99,
      ),
    ).toHaveLength(20)
  })
})

describe('payment', () => {
  const started: Started = {
    order: 4,
    method: 'alipay',
    payUrl: 'https://pay.example/4',
    payCurrency: 'CNY',
    amount: 72.5,
  }

  it('resumes a payment only for the order it was started for while it waits', () => {
    expect(startedFor(started, { id: 4, status: 'NEW' })).toBe(started)
    expect(startedFor(started, { id: 5, status: 'NEW' })).toBeUndefined()
    expect(startedFor(started, { id: 4, status: 'DONE' })).toBeUndefined()
    expect(startedFor(undefined, { id: 4, status: 'NEW' })).toBeUndefined()
  })

  it('finds the method a payment was started with, or keeps its id', () => {
    const alipay = {
      id: 'alipay',
      name: 'Alipay',
      brand: 'alipay',
      fee_rate: '3.0%',
      fee_fixed: null,
    } as const
    expect(methodOf([alipay], 'alipay')).toBe(alipay)
    expect(methodOf([alipay], 'bank')).toEqual({
      id: 'bank',
      name: 'bank',
      brand: null,
      fee_rate: null,
      fee_fixed: null,
    })
  })

  it('words the fee of a method from what the provider states', () => {
    expect(feeOf({ fee_rate: '3.0%', fee_fixed: null })).toBe('3.0%')
    expect(feeOf({ fee_rate: '4.4%', fee_fixed: '0.30' })).toBe('4.4% + 0.30')
    expect(feeOf({ fee_rate: null, fee_fixed: '0.30' })).toBe('0.30')
    expect(feeOf({ fee_rate: null, fee_fixed: null })).toBeUndefined()
  })

  it('adds what a brand settles in when its name does not say', () => {
    expect(captionOf({ brand: 'usdt' })).toBe('USDT')
    expect(captionOf({ brand: 'alipay' })).toBeUndefined()
    expect(captionOf({ brand: null })).toBeUndefined()
  })
})
