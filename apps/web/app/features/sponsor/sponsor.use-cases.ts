import type { ApiClient } from '~/shared/api/client'
import {
  toCents,
  wallPageSize,
  type OrderView,
  type Payment,
  type SponsorState,
  type WallEntry,
} from './sponsor'
import type { OrderDraft, PaymentStart } from './sponsor.schema'

export type Wall = {
  entries: WallEntry[]
  total: number
  page: number
  state: SponsorState
}

export async function loadWall(api: ApiClient, page: number): Promise<Wall> {
  const [wall, state] = await Promise.all([
    api.get('/sponsor/wall', { params: { query: { page, pageSize: wallPageSize } } }),
    api.get('/sponsor/state'),
  ])
  return { entries: wall.items ?? [], total: wall.meta.totalItems, page, state }
}

export function loadState(api: ApiClient): Promise<SponsorState> {
  return api.get('/sponsor/state')
}

export type Created = {
  id: number
  token: string
}

export async function createOrder(api: ApiClient, draft: OrderDraft): Promise<Created> {
  const name = draft.name.trim()
  const message = draft.message.trim()
  const created = await api.post('/sponsor/order', {
    body: {
      amount: toCents(draft.amount),
      isPrivate: !draft.shown,
      ...(name === '' ? {} : { name }),
      ...(message === '' ? {} : { message }),
    },
  })
  return { id: created.orderId, token: created.accessToken }
}

export type OrderPage = {
  view: OrderView
  state: SponsorState
  token: string
}

export async function loadOrder(api: ApiClient, id: number, token: string): Promise<OrderPage> {
  const [view, state] = await Promise.all([
    api.get('/sponsor/order/{id}', {
      params: { path: { id }, query: token === '' ? {} : { token } },
    }),
    api.get('/sponsor/state'),
  ])
  return { view, state, token }
}

export function payOrder(api: ApiClient, request: PaymentStart): Promise<Payment> {
  return api.post('/sponsor/order/{id}/pay', {
    params: { path: { id: request.id } },
    body: { method: request.method, redirectUrl: request.back },
  })
}
