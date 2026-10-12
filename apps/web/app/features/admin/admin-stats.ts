import type { Schema } from '~/shared/api/types'

export const trendRanges = [7, 30, 90] as const

export type TrendRange = (typeof trendRanges)[number]

export const defaultTrendRange: TrendRange = 30

export type Overview = Schema<'AdminStatsOverviewDTO'>

export type TrendPoint = Schema<'AdminStatsTrendDTO'>

export type Storage = Schema<'AdminStorageDTO'>

export function spoolUsed(storage: Pick<Storage, 'spool_capacity' | 'spool_available'>): number {
  return Math.max(0, storage.spool_capacity - storage.spool_available)
}

export function spoolShare(storage: Pick<Storage, 'spool_capacity' | 'spool_available'>): number {
  return storage.spool_capacity <= 0 ? 0 : spoolUsed(storage) / storage.spool_capacity
}
