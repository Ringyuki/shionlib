import { gamePath } from '~/features/game'
import type { ApiQuery, Schema } from '~/shared/api/types'
import { pageKey } from '~/shared/http/paging'
import type { Locale } from '~/shared/i18n/locale'
import { sameDocument, type RichDocument, type RichSection } from '~/shared/richtext/rich-text'

export type Walkthrough = Schema<'WalkthroughDTO'>

export type WalkthroughItem = Schema<'WalkthroughItemDTO'>

export type UserWalkthrough = Schema<'UserWalkthroughDTO'>

export type GameRef = Pick<
  Schema<'GameHeaderDTO'>,
  'id' | 'title_jp' | 'title_zh' | 'title_en' | 'covers' | 'developers'
>

export type WalkthroughState = 'published' | 'draft' | 'reviewing' | 'hidden'

export type Shelf = (typeof shelves)[number]

export type Walkthroughs = { gameId: number; items: WalkthroughItem[]; total: number; page: number }

export type UserWalkthroughs = {
  items: UserWalkthrough[]
  total: number
  page: number
  shelf: Shelf
}

export type Reading = {
  game: GameRef
  resources: number
  walkthrough: Walkthrough
  content: RichDocument
  others: WalkthroughItem[]
}

export type Writing = { title: string; content: RichDocument }

export type Draft = Writing & {
  game: GameRef
  walkthroughId: number | undefined
  authorId: number | undefined
  state: WalkthroughState
}

export type Saved = { id: number; state: WalkthroughState }

export type Contents = { id: string; label: string; children: { id: string; label: string }[] }

type Stated = Pick<WalkthroughItem, 'status' | 'review_pending'>

type StoredStatus = NonNullable<ApiQuery<'/user/datas/{id}/walkthroughs', 'get'>['status']>

export const pageSize = 20

export const userPageSize = 20

export const othersShown = 5

export const shelves = ['all', 'published', 'draft'] as const

export const shelfKey = 'status'

export const legacyEditedKey = 'walkthrough_id'

export const canvasColumn = 'mx-auto w-full max-w-3xl px-4 sm:px-6'

const shelfStatus: Record<Shelf, StoredStatus | undefined> = {
  all: undefined,
  published: 'PUBLISHED',
  draft: 'DRAFT',
}

export function walkthroughsPath(locale: Locale, gameId: number): string {
  return gamePath(locale, gameId, 'walkthrough')
}

export function walkthroughPath(locale: Locale, gameId: number, walkthroughId: number): string {
  return `${walkthroughsPath(locale, gameId)}/${walkthroughId}`
}

export function writingPath(locale: Locale, gameId: number, walkthroughId?: number): string {
  return walkthroughId === undefined
    ? `${walkthroughsPath(locale, gameId)}/new`
    : `${walkthroughPath(locale, gameId, walkthroughId)}/edit`
}

export function statusOf(shelf: Shelf): StoredStatus | undefined {
  return shelfStatus[shelf]
}

export function searchOnShelf(search: string, shelf: Shelf): string {
  const params = new URLSearchParams(search)
  params.delete(pageKey)
  if (shelf === 'all') {
    params.delete(shelfKey)
  } else {
    params.set(shelfKey, shelf)
  }
  const kept = params.toString()
  return kept === '' ? '' : `?${kept}`
}

export function writtenBy(draft: Pick<Draft, 'authorId'>, viewerId: number): boolean {
  return draft.authorId === undefined || draft.authorId === viewerId
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

export function isUnsaved(written: Writing, stored: Writing): boolean {
  if (written.title !== stored.title) {
    return true
  }
  return written.content !== stored.content && !sameDocument(written.content, stored.content)
}

export function contentsOf(sections: readonly RichSection[]): Contents[] {
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
