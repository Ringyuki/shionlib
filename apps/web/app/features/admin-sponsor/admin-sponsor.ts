import type { Schema } from '~/shared/api/types'

export type Order = Schema<'SponsorOrderDTO'>

export type Stats = Schema<'AdminSponsorStatsDTO'>

export const statuses = ['DONE', 'NEW', 'EXPIRED', 'REFUND'] as const

export type Status = (typeof statuses)[number]

export const settable = ['DONE', 'REFUND'] as const

export type Settable = (typeof settable)[number]

export type Filter = {
  status: Status | undefined
  page: number
}

export function searchOf(filter: Pick<Filter, 'status'>): string {
  return filter.status === undefined ? '' : `?${new URLSearchParams({ status: filter.status })}`
}

export function offered(order: Pick<Order, 'status'>): Settable[] {
  return settable.filter(status => status !== order.status)
}

export function sponsorOf(order: Pick<Order, 'user' | 'sponsorName'>): {
  name: string | undefined
  avatar: string | null
} {
  if (order.user !== null) {
    return { name: order.user.name, avatar: order.user.avatar }
  }
  const name = order.sponsorName?.trim() ?? ''
  return { name: name === '' ? undefined : name, avatar: null }
}

export function grantsBadge(order: Pick<Order, 'user' | 'status'>): boolean {
  return order.user !== null && order.status !== 'DONE'
}

export const statusTones = {
  DONE: 'success',
  NEW: 'warning',
  EXPIRED: 'neutral',
  REFUND: 'neutral',
} as const
