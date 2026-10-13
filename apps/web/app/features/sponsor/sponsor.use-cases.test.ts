import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { OrderView, SponsorState } from './sponsor'
import { createOrder, loadOrder, loadState, loadWall, payOrder } from './sponsor.use-cases'

const state: SponsorState = { enabled: true, badge_days_per_dollar: 6 }

const view: OrderView = {
  order: {
    id: 4,
    providerOrderId: 'idr-4',
    amount: 10,
    status: 'NEW',
    sponsorName: null,
    user: null,
    message: null,
    isPrivate: false,
    paymentMethod: null,
    paidAt: null,
    expiresAt: '2026-10-13T06:32:00.000Z',
    created: '2026-10-13T06:02:00.000Z',
  },
  badge_until: null,
  payment_methods: [
    { id: 'alipay', name: 'Alipay', brand: 'alipay', fee_rate: '3.0%', fee_fixed: null },
  ],
}

const created = {
  orderId: 4,
  providerOrderId: 'idr-4',
  paymentMethods: null,
  expiresAt: null,
  accessToken: 'signed',
}

const queryOf = (requests: Request[], path: string) =>
  Object.fromEntries(
    new URL(requests.find(request => new URL(request.url).pathname === path)?.url ?? '')
      .searchParams,
  )

describe('loadWall', () => {
  it('loads one page of sponsors with the state of sponsorship', async () => {
    const fake = fakeApi()
      .on('get', '/sponsor/wall', {
        items: null,
        meta: { currentPage: 2, itemCount: 0, itemsPerPage: 24, totalItems: 30, totalPages: 2 },
      })
      .on('get', '/sponsor/state', state)
    await expect(loadWall(fake.api, 2)).resolves.toEqual({
      entries: [],
      total: 30,
      page: 2,
      state,
    })
    expect(queryOf(fake.requests, '/sponsor/wall')).toEqual({ page: '2', pageSize: '24' })
  })
})

describe('loadState', () => {
  it('tells whether orders are accepted', async () => {
    const { api } = fakeApi().on('get', '/sponsor/state', state)
    await expect(loadState(api)).resolves.toEqual(state)
  })
})

describe('createOrder', () => {
  it('sends the amount in cents and leaves out what was not written', async () => {
    const fake = fakeApi().on('post', '/sponsor/order', created)
    await expect(
      createOrder(fake.api, { amount: 12.345, name: '  ', message: ' ', shown: true }),
    ).resolves.toEqual({ id: 4, token: 'signed' })
    await expect(fake.requests[0]?.json()).resolves.toEqual({ amount: 12.35, isPrivate: false })
  })

  it('sends the name and the message of an order kept off the wall', async () => {
    const fake = fakeApi().on('post', '/sponsor/order', created)
    await createOrder(fake.api, { amount: 5, name: ' 路过 ', message: ' 加油 ', shown: false })
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      amount: 5,
      isPrivate: true,
      name: '路过',
      message: '加油',
    })
  })
})

describe('loadOrder', () => {
  it('reads an order with the token from its address', async () => {
    const fake = fakeApi().on('get', '/sponsor/order/{id}', view).on('get', '/sponsor/state', state)
    await expect(loadOrder(fake.api, 4, 'signed')).resolves.toEqual({
      view,
      state,
      token: 'signed',
    })
    expect(queryOf(fake.requests, '/sponsor/order/4')).toEqual({ token: 'signed' })
  })

  it('sends no token for the owner', async () => {
    const fake = fakeApi().on('get', '/sponsor/order/{id}', view).on('get', '/sponsor/state', state)
    await loadOrder(fake.api, 4, '')
    expect(queryOf(fake.requests, '/sponsor/order/4')).toEqual({})
  })
})

describe('payOrder', () => {
  it('starts a payment that comes back to the order', async () => {
    const payment = { payUrl: 'https://pay.example/4', payCurrency: 'CNY', amount: 72.5 }
    const fake = fakeApi().on('post', '/sponsor/order/{id}/pay', payment)
    await expect(
      payOrder(fake.api, {
        id: 4,
        method: 'alipay',
        back: 'https://shionlib.com/zh/sponsor/orders/4',
      }),
    ).resolves.toEqual(payment)
    expect(new URL(fake.requests[0]?.url ?? '').pathname).toBe('/sponsor/order/4/pay')
    await expect(fake.requests[0]?.json()).resolves.toEqual({
      method: 'alipay',
      redirectUrl: 'https://shionlib.com/zh/sponsor/orders/4',
    })
  })
})
