import type { ApiBody, Schema } from '~/shared/api/types'
import { siteInstant, siteMinute } from '~/shared/i18n/site-time'

export type AdminAd = Schema<'AdminAdDTO'>

export type Overview = Schema<'AdOverviewDTO'>

export type SlotSummary = Schema<'AdSlotSummaryDTO'>

export type Report = Schema<'AdReportDTO'>

export type Counts = Schema<'AdCountsDTO'>

export type Status = AdminAd['status']

export type Slot = SlotSummary['slot']

export type Material = SlotSummary['material']

export type Language = NonNullable<AdminAd['languages']>[number]

export type Draft = ApiBody<'/admin/ad', 'post'>

export const statuses = [
  'running',
  'scheduled',
  'ended',
  'disabled',
] as const satisfies readonly Status[]

export const slots = [
  'home',
  'game',
  'resource',
  'download',
  'sidebar',
] as const satisfies readonly Slot[]

export const languages = ['zh', 'ja', 'en'] as const satisfies readonly Language[]

export const imageKinds = ['banner', 'side-image', 'side-icon'] as const

export const sideTypes = 'image/png,image/webp'

export type ImageKind = (typeof imageKinds)[number]

export const ranges = ['7', '30'] as const

export type Range = (typeof ranges)[number]

export const rangeDays = { '7': 7, '30': 30 } as const

export const defaultRange: Range = '30'

export const statusTones = {
  running: 'success',
  scheduled: 'info',
  ended: 'neutral',
  disabled: 'warning',
} as const satisfies Record<Status, string>

export const openedAd = 'ad'

export const defaultWeight = 5

export const bannerRatio = 6

export type Filter = {
  status: Status | undefined
  slot: Slot | undefined
  ad: number | undefined
  days: Range
  page: number
}

export function searchOf(filter: Omit<Filter, 'page'>): string {
  const search = new URLSearchParams()
  if (filter.status !== undefined) {
    search.set('status', filter.status)
  }
  if (filter.slot !== undefined) {
    search.set('slot', filter.slot)
  }
  if (filter.ad !== undefined) {
    search.set(openedAd, String(filter.ad))
  }
  if (filter.days !== defaultRange) {
    search.set('days', filter.days)
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

export type AdValues = {
  name: string
  link: string
  banner: string | null
  bannerAdult: boolean
  sideImage: string | null
  sideIcon: string | null
  sideAdult: boolean
  slots: Slot[]
  languages: Language[]
  weight: number
  enabled: boolean
  startAt: string | null
  endAt: string | null
}

export const blankAd: AdValues = {
  name: '',
  link: '',
  banner: null,
  bannerAdult: false,
  sideImage: null,
  sideIcon: null,
  sideAdult: false,
  slots: [],
  languages: ['zh'],
  weight: defaultWeight,
  enabled: true,
  startAt: null,
  endAt: null,
}

const minuteOf = (instant: string | null) =>
  instant === null ? null : siteMinute(new Date(instant))

const instantOf = (minute: string | null) => (minute === null ? null : siteInstant(minute))

export function valuesOf(ad: AdminAd): AdValues {
  return {
    name: ad.name,
    link: ad.link,
    banner: ad.banner,
    bannerAdult: ad.banner_adult,
    sideImage: ad.side_image,
    sideIcon: ad.side_icon,
    sideAdult: ad.side_adult,
    slots: ad.slots ?? [],
    languages: ad.languages ?? [],
    weight: ad.weight,
    enabled: ad.enabled,
    startAt: minuteOf(ad.start_at),
    endAt: minuteOf(ad.end_at),
  }
}

export function materialOf(slot: Slot): Material {
  return slot === 'sidebar' ? 'side' : 'banner'
}

type Images = Pick<AdValues, 'banner' | 'sideImage' | 'sideIcon'>

export function hasMaterial(images: Images, material: Material): boolean {
  return material === 'side'
    ? images.sideImage !== null && images.sideIcon !== null
    : images.banner !== null
}

export function fits(images: Images, slot: Slot): boolean {
  return hasMaterial(images, materialOf(slot))
}

export function withImages(values: AdValues, images: Partial<Images>): AdValues {
  const next = { ...values, ...images }
  return {
    ...next,
    bannerAdult: next.banner !== null && next.bannerAdult,
    sideAdult: next.sideImage !== null && next.sideAdult,
    slots: next.slots.filter(slot => fits(next, slot)),
  }
}

export function draftOf(values: AdValues): Draft {
  return {
    name: values.name.trim(),
    link: values.link.trim(),
    banner: values.banner,
    banner_adult: values.banner !== null && values.bannerAdult,
    side_image: values.sideImage,
    side_icon: values.sideIcon,
    side_adult: values.sideImage !== null && values.sideAdult,
    slots: slots.filter(slot => values.slots.includes(slot) && fits(values, slot)),
    languages: languages.filter(language => values.languages.includes(language)),
    weight: values.weight,
    enabled: values.enabled,
    start_at: instantOf(values.startAt),
    end_at: instantOf(values.endAt),
  }
}

export function rateOf(counts: Counts): number | undefined {
  return counts.views === 0 ? undefined : counts.clicks / counts.views
}

export function hostOf(link: string): string {
  try {
    return new URL(link).host
  } catch {
    return link
  }
}

export function previewOf(ad: Pick<AdminAd, 'banner' | 'side_icon' | 'side_image'>) {
  return ad.banner ?? ad.side_icon ?? ad.side_image
}
