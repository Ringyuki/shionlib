import { describe, expect, it } from 'vitest'
import { fakeApi } from '~/shared/api/testing'
import type { ApiData } from '~/shared/api/types'
import { loadCharacter } from './character.use-cases'

const character: ApiData<'/character/{id}', 'get'> = {
  id: 68,
  h_id: 12,
  name_jp: '鳴瀬しろは',
  name_zh: '鸣濑白羽',
  name_en: 'Naruse Shiroha',
  aliases: null,
  intro_jp: '',
  intro_zh: '',
  intro_en: '',
  image: null,
  blood_type: null,
  height: 155,
  weight: null,
  bust: null,
  waist: null,
  hips: null,
  cup: null,
  age: 17,
  birthday: [6, 8],
  gender: ['f'],
  appearances: [{ game_id: 1, role: 'main', actor: null }],
}

const games: ApiData<'/game/list', 'get'> = {
  items: null,
  meta: {
    currentPage: 2,
    itemCount: 0,
    itemsPerPage: 36,
    totalItems: 40,
    totalPages: 2,
    content_limit: 0,
  },
}

describe('loadCharacter', () => {
  it('loads the character with the games it appears in, newest first', async () => {
    const fake = fakeApi().on('get', '/character/{id}', character).on('get', '/game/list', games)
    await expect(loadCharacter(fake.api, 68, 2)).resolves.toEqual({
      character,
      works: { games: [], total: 40, page: 2, order: { sort: 'release_date', ascending: false } },
    })
    const listed = fake.requests.find(request => request.url.includes('/game/list'))
    expect(Object.fromEntries(new URL(listed?.url ?? '').searchParams)).toEqual({
      character_id: '68',
      page: '2',
      pageSize: '36',
      'filter[sort_by]': 'release_date',
      'filter[sort_order]': 'desc',
    })
  })
})
