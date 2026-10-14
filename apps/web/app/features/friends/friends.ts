import type { Schema } from '~/shared/api/types'

export type Friend = Schema<'FriendLinkDTO'>

export function hostOf(url: string): string {
  return new URL(url).host.replace(/^www\./, '')
}
