import type { Viewer } from '~/features/viewer'
import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

export type Profile = Schema<'UserProfileDTO'>

export type Upload = Schema<'DownloadUserResourceDTO'>

export type Uploads = { items: Upload[]; total: number; page: number; own: boolean }

export const profileTabs = ['uploads', 'favorites', 'comments', 'walkthroughs'] as const

export type ProfileTab = (typeof profileTabs)[number]

export const uploadsPageSize = 20

export const pictureKinds = ['avatar', 'cover', 'background'] as const

export type PictureKind = (typeof pictureKinds)[number]

export const pictureShapes = {
  avatar: { aspect: 1, width: 512, height: 512, round: true },
  cover: { aspect: 3, width: 1500, height: 500, round: false },
  background: { aspect: 16 / 9, width: 2560, height: 1440, round: false },
} as const satisfies Record<PictureKind, object>

export const pictureTypes = 'image/jpeg,image/png,image/webp,image/avif'

type Counted = Pick<
  Profile,
  'resource_count' | 'favorite_count' | 'comment_count' | 'walkthrough_count'
>

type Onlooker = Pick<Viewer, 'id' | 'show_profile_backgrounds'>

export function profilePath(locale: Locale, userId: number, tab: ProfileTab = 'uploads'): string {
  const base = `/${locale}/user/${userId}`
  return tab === 'uploads' ? base : `${base}/${tab}`
}

export function tabAt(pathname: string, locale: Locale, userId: number): ProfileTab {
  const at = (tab: ProfileTab) => {
    const base = profilePath(locale, userId, tab)
    return pathname === base || pathname.startsWith(`${base}/`)
  }
  return profileTabs.find(tab => tab !== 'uploads' && at(tab)) ?? 'uploads'
}

export function countOf(profile: Counted, tab: ProfileTab): number {
  const counts = {
    uploads: profile.resource_count,
    favorites: profile.favorite_count,
    comments: profile.comment_count,
    walkthroughs: profile.walkthrough_count,
  }
  return counts[tab]
}

export function openingTab(profile: Counted): ProfileTab | undefined {
  return profileTabs.find(tab => countOf(profile, tab) > 0)
}

export function shownTabs(profile: Counted, own: boolean, current: ProfileTab): ProfileTab[] {
  if (own) {
    return [...profileTabs]
  }
  if (openingTab(profile) === undefined) {
    return []
  }
  return profileTabs.filter(tab => tab === current || countOf(profile, tab) > 0)
}

export function backgroundFor(
  profile: Pick<Profile, 'id' | 'background'>,
  viewer: Onlooker | null,
): string | null {
  const declined = viewer !== null && viewer.id !== profile.id && !viewer.show_profile_backgrounds
  return declined ? null : profile.background
}

export function uploadPath(locale: Locale, upload: Pick<Upload, 'id'>): string {
  return `/${locale}/resource/${upload.id}`
}

export function otherFiles(upload: Pick<Upload, 'files_count'>): number {
  return Math.max(0, upload.files_count - 1)
}
