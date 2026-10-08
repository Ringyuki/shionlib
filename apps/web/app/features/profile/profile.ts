import { gamePath } from '~/features/game'
import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

export type Profile = Schema<'UserProfileDTO'>

export type Upload = Schema<'DownloadUserResourceDTO'>

export type Uploads = { items: Upload[]; total: number; page: number }

export const profileTabs = ['uploads', 'favorites', 'comments', 'walkthroughs'] as const

export type ProfileTab = (typeof profileTabs)[number]

export const uploadsPageSize = 24

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

type Placed = Pick<Upload, 'id'> & { game: Pick<Upload['game'], 'id'> }

export function uploadPath(locale: Locale, upload: Placed): string {
  return `${gamePath(locale, upload.game.id)}#resource-${upload.id}`
}

export function otherFiles(upload: Pick<Upload, 'files_count'>): number {
  return Math.max(0, upload.files_count - 1)
}
