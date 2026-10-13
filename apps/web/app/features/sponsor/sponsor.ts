import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

export type WallEntry = Schema<'SponsorWallEntryDTO'>

export type SponsorState = Schema<'SponsorStateDTO'>

export type Order = Schema<'SponsorOrderDTO'>

export type OrderView = Schema<'SponsorOrderViewDTO'>

export type Method = Schema<'SponsorPaymentMethodDTO'>

export type Payment = Schema<'SponsorPaymentDTO'>

export type Self = Pick<
  Schema<'UserMeDTO'>,
  'id' | 'name' | 'avatar' | 'cover' | 'bio' | 'is_sponsor' | 'sponsor_expires_at'
>

export const wallPageSize = 24

export const presets = [5, 10, 20, 50] as const

export const defaultAmount = 10

export const watchEvery = 3000

export const celebrateWithin = 10 * 60 * 1000

export const startedKey = 'shionlib:sponsor-payment'

export const celebratedKey = 'shionlib:sponsor-celebrated'

export const celebratedKept = 20

export function sponsorPaths(locale: Locale) {
  const wall = `/${locale}/sponsor`
  return {
    wall,
    checkout: `${wall}/new`,
    order: (id: number, token?: string) =>
      token === undefined || token === ''
        ? `${wall}/orders/${id}`
        : `${wall}/orders/${id}?${new URLSearchParams({ token })}`,
  }
}

export type WallCard = {
  userId: number | undefined
  name: string | undefined
  avatar: string | null
  cover: string | null
  bio: string
  active: boolean
  message: string
  at: string | undefined
}

export function cardOf(entry: WallEntry): WallCard {
  const { user } = entry
  return {
    userId: user?.id,
    name: user?.name ?? named(entry.name),
    avatar: user?.avatar ?? null,
    cover: user?.cover ?? null,
    bio: (user?.bio ?? '').trim(),
    active: user?.is_sponsor ?? false,
    message: (entry.message ?? '').trim(),
    at: entry.sponsored_at,
  }
}

export type Draft = {
  name: string
  message: string
}

export function previewOf(self: Self | null, draft: Draft): WallCard {
  return {
    userId: undefined,
    name: self?.name ?? named(draft.name),
    avatar: self?.avatar ?? null,
    cover: self?.cover ?? null,
    bio: (self?.bio ?? '').trim(),
    active: self !== null,
    message: draft.message.trim(),
    at: undefined,
  }
}

function named(name: string | null): string | undefined {
  const text = (name ?? '').trim()
  return text === '' ? undefined : text
}

const cent = 100

const day = 24 * 60 * 60 * 1000

export function badgeDays(amount: number, perDollar: number): number {
  return Math.floor((Math.round(amount * cent) * perDollar) / cent)
}

export function badgeUntil(now: Date, current: string | null, days: number): Date {
  const kept = current === null ? now.getTime() : Math.max(now.getTime(), Date.parse(current))
  return new Date(kept + days * day)
}

export function owned(view: OrderView): boolean {
  return view.order.providerOrderId !== ''
}

export function shownCard(order: Order, self: Self | null): WallCard | undefined {
  if (order.isPrivate) {
    return undefined
  }
  const own = self !== null && order.user?.id === self.id
  return {
    userId: order.user?.id,
    name: order.user?.name ?? named(order.sponsorName),
    avatar: order.user?.avatar ?? null,
    cover: own ? self.cover : null,
    bio: own ? (self.bio ?? '').trim() : '',
    active: order.user?.is_sponsor ?? false,
    message: (order.message ?? '').trim(),
    at: order.paidAt ?? undefined,
  }
}

export type Started = {
  order: number
  method: string
  payUrl: string
  payCurrency: string | null
  amount: number | null
}

export function startedFor(started: Started | undefined, order: Pick<Order, 'id' | 'status'>) {
  return started !== undefined && started.order === order.id && order.status === 'NEW'
    ? started
    : undefined
}

export function remembered(celebrated: readonly number[], id: number): number[] {
  return [...celebrated.filter(known => known !== id), id].slice(-celebratedKept)
}

export type Stage = 'pay' | 'done' | 'expired' | 'refunded'

const stages = { NEW: 'pay', DONE: 'done', EXPIRED: 'expired', REFUND: 'refunded' } as const

export function stageOf(order: Pick<Order, 'status'>): Stage {
  return stages[order.status]
}

export function celebrates(order: Pick<Order, 'status' | 'paidAt'>, now: Date): boolean {
  return (
    order.status === 'DONE' &&
    order.paidAt !== null &&
    now.getTime() - Date.parse(order.paidAt) < celebrateWithin
  )
}

export const knownMethods = [
  'alipay',
  'wxpay',
  'crypto',
  'onramp-google',
  'onramp-apple',
  'onramp-paypal',
] as const

export type KnownMethod = (typeof knownMethods)[number]

export function knownMethod(method: string): KnownMethod | undefined {
  return knownMethods.find(known => known === method)
}

const captions: Partial<Record<KnownMethod, string>> = { crypto: 'USDT' }

export function captionOf(method: string): string | undefined {
  const known = knownMethod(method)
  return known === undefined ? undefined : captions[known]
}

export function payable(methods: readonly Method[] | null): Method[] {
  return (methods ?? []).filter(method => method.enabled)
}

export function toCents(amount: number): number {
  return Math.round(amount * cent) / cent
}
