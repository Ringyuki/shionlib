import { gamePath } from '~/features/game'
import type { Schema } from '~/shared/api/types'
import type { Locale } from '~/shared/i18n/locale'
import type { BBCodeSection } from '~/shared/markup/bbcode'

export type Walkthrough = Schema<'WalkthroughDTO'>

export type WalkthroughItem = Schema<'WalkthroughItemDTO'>

export type UserWalkthrough = Schema<'UserWalkthroughDTO'>

export type GameRef = Pick<Schema<'GameHeaderDTO'>, 'id' | 'title_jp' | 'title_zh' | 'title_en'>

export type Walkthroughs = { gameId: number; items: WalkthroughItem[]; total: number; page: number }

export type UserWalkthroughs = { items: UserWalkthrough[]; total: number; page: number }

export type Reading = { game: GameRef; walkthrough: Walkthrough; source: string }

export type Draft = {
  game: GameRef
  walkthroughId: number | undefined
  title: string
  content: string
  published: boolean
}

export type WalkthroughState = 'published' | 'draft' | 'reviewing' | 'hidden'

export type Contents = { id: string; label: string; children: { id: string; label: string }[] }

type Stated = Pick<WalkthroughItem, 'status' | 'review_pending'>

export const pageSize = 20

export const userPageSize = 20

export const editedParam = 'walkthrough_id'

export function walkthroughsPath(locale: Locale, gameId: number): string {
  return gamePath(locale, gameId, 'walkthrough')
}

export function walkthroughPath(locale: Locale, gameId: number, walkthroughId: number): string {
  return `${walkthroughsPath(locale, gameId)}/${walkthroughId}`
}

export function editorPath(locale: Locale, gameId: number, walkthroughId?: number): string {
  const base = `${walkthroughsPath(locale, gameId)}/edit`
  return walkthroughId === undefined
    ? base
    : `${base}?${new URLSearchParams({ [editedParam]: String(walkthroughId) })}`
}

export function stateOf(walkthrough: Stated): WalkthroughState {
  if (walkthrough.status === 'PUBLISHED') {
    return 'published'
  }
  if (walkthrough.status === 'DRAFT') {
    return 'draft'
  }
  return walkthrough.review_pending ? 'reviewing' : 'hidden'
}

export function contentsOf(sections: readonly BBCodeSection[]): Contents[] {
  const contents: Contents[] = []
  for (const section of sections) {
    const entry = { id: section.id, label: section.title }
    const chapter = contents.at(-1)
    if (section.level === 3 && chapter !== undefined) {
      chapter.children.push(entry)
    } else {
      contents.push({ ...entry, children: [] })
    }
  }
  return contents
}
