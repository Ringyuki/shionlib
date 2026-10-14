import type { Schema } from '~/shared/api/types'

export type Placed = Schema<'AdPlacedDTO'>

export type Shown = Schema<'AdShownDTO'>

export type Slot = Placed['slot']

export type View = Schema<'AdViewInput'>

export type Placements = Partial<Record<Slot, Shown[]>>

export const slots = [
  'home',
  'game',
  'resource',
  'download',
  'sidebar',
] as const satisfies readonly Slot[]

export const bannerRatio = 6

export const dwellMs = 1000

export const visibleShare = 0.5

export const flushDelayMs = 1000

export const adPage = Object.freeze({ sidebarAds: true })

export function placementsOf(placed: Placed[]): Placements {
  const placements: Placements = {}
  for (const { slot, ads } of placed) {
    placements[slot] = ads ?? []
  }
  return placements
}

export function adsIn(placements: Placements | undefined, slot: Slot): Shown[] {
  return placements?.[slot] ?? []
}

export function viewKey(view: View): string {
  return `${view.slot}:${view.ad_id}`
}
