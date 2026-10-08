import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'

export type MessageItem = Schema<'MessageItemDTO'>

export type MessageDetail = Schema<'MessageDetailDTO'>

type MessageType = MessageItem['type']

export const categories = ['all', 'system', 'comment-reply', 'comment-like'] as const

export type Category = (typeof categories)[number]

export type Inbox = {
  category: Category
  page: number
  items: MessageItem[]
  total: number
  unread: number
  opened: MessageDetail | null
}

export type InboxAddress = { category: Category; page?: number; opened?: number }

const types: Record<Exclude<Category, 'all'>, MessageType> = {
  system: 'SYSTEM',
  'comment-reply': 'COMMENT_REPLY',
  'comment-like': 'COMMENT_LIKE',
}

export const pageSize = 30

export const openedParam = 'm'

export const streamPath = '/message/stream'

export const unreadPath = '/message/unread'

export const unreadEvent = 'message:unread'

export const newMessageEvent = 'message:new'

export function typeOf(category: Category): MessageType | undefined {
  return category === 'all' ? undefined : types[category]
}

export function categoryOf(type: MessageType): Exclude<Category, 'all'> {
  return type === 'COMMENT_REPLY'
    ? 'comment-reply'
    : type === 'COMMENT_LIKE'
      ? 'comment-like'
      : 'system'
}

export function inboxRoot(locale: Locale): string {
  return `/${locale}/message`
}

export function inboxPath(locale: Locale, { category, page = 1, opened }: InboxAddress): string {
  const params = new URLSearchParams()
  if (page > 1) {
    params.set('page', String(page))
  }
  if (opened !== undefined) {
    params.set(openedParam, String(opened))
  }
  const search = params.toString()
  const base = category === 'all' ? inboxRoot(locale) : `${inboxRoot(locale)}/${category}`
  return search === '' ? base : `${base}?${search}`
}

export function atInbox(pathname: string, locale: Locale): boolean {
  const root = inboxRoot(locale)
  return pathname === root || pathname.startsWith(`${root}/`)
}

export function lastPage(total: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

export function linkTarget(
  locale: Locale,
  message: Pick<MessageDetail, 'link_url' | 'external_link'>,
) {
  const url = (message.link_url ?? '').trim()
  if (url === '') {
    return undefined
  }
  return message.external_link || !url.startsWith('/')
    ? { external: true, href: url }
    : { external: false, href: `/${locale}${url}` }
}
