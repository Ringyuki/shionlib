import type { Schema } from '~/shared/api/types'

export type Game = Schema<'AdminGameItemDTO'>

export const statuses = [1, 2] as const

export type Status = (typeof statuses)[number]

export const visible: Status = 1

export const hidden: Status = 2

export const sorts = ['views', 'downloads', 'updated'] as const

export type Sort = (typeof sorts)[number]

export const defaultSort: Sort = 'views'

export type Filter = {
  query: string
  status: Status | undefined
  sort: Sort
  page: number
}

export const maxQueryLength = 100

export const queryDelay = 300

export function searchOf(filter: Omit<Filter, 'page'>): string {
  const search = new URLSearchParams()
  if (filter.query !== '') {
    search.set('q', filter.query)
  }
  if (filter.status !== undefined) {
    search.set('status', String(filter.status))
  }
  if (filter.sort !== defaultSort) {
    search.set('sort', filter.sort)
  }
  const text = search.toString()
  return text === '' ? '' : `?${text}`
}

export function narrowed(filter: Pick<Filter, 'query' | 'status'>): boolean {
  return filter.query !== '' || filter.status !== undefined
}

type Titled = Pick<Game, 'title_jp' | 'title_zh' | 'title_en'>

export function titlesOf(game: Titled): { main: string; other: string | undefined } {
  const titles = [game.title_jp, game.title_zh, game.title_en].filter(title => title !== '')
  const [main = '', ...rest] = titles
  return { main, other: rest.find(title => title !== main) }
}

export function coverOf(game: Pick<Game, 'covers'>) {
  return game.covers?.[0]
}

export function shown(game: Pick<Game, 'status'>): boolean {
  return game.status === visible
}
