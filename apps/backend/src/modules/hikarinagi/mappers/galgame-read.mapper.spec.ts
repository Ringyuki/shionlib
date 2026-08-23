import {
  hasRatedMedia,
  mapBundleToDetails,
  mapBundleToTags,
  mapBundleToLinks,
  mapBundleToRelations,
  mapBundleToGameDetail,
  mapBundleToHeader,
  mapCardToListItem,
  mapCardToNestedGame,
} from './galgame-read.mapper'
import { includesRated } from '../../user/helpers/content-limit.helper'
import { UserContentLimit } from '../../user/interfaces/user.interface'

const media = (sexual: number) => ({
  src: `covers/${sexual}.webp`,
  width: 10,
  height: 20,
  sexual,
  violence: 0,
})

const coverRows = [
  { language: 'ja', kind: 'PACKAGE_FRONT', media: media(1) },
  { language: 'ja', kind: 'PACKAGE_FRONT', media: media(0) },
] as never[]

const bundle = {
  galgame: {
    origin_lang: 'ja',
    origin_title: 'げーむ',
    trans_title: null,
    en_title: null,
    aliases: [],
    origin_intro: null,
    trans_intro: null,
    en_intro: null,
    covers: coverRows,
    images: [media(1), media(0)],
    release_date: null,
    release_date_tbd: false,
    adv_type: null,
    platforms: [],
    nsfw: false,
  },
  characters: [],
  staff: [],
  producers: [],
  relations: [],
  tags: [],
} as never

const card = { id: 1, origin_title: 'げーむ', trans_title: null, covers: coverRows } as never

describe('read-through NSFW gating', () => {
  it('treats every non-permissive content limit as strict', () => {
    expect(includesRated(undefined)).toBe(false)
    expect(includesRated(0)).toBe(false)
    expect(includesRated(UserContentLimit.NEVER_SHOW_NSFW_CONTENT)).toBe(false)
    expect(includesRated(UserContentLimit.SHOW_WITH_SPOILER)).toBe(true)
    expect(includesRated(UserContentLimit.JUST_SHOW)).toBe(true)
  })

  it('drops rated covers from every read-through shape when strict', () => {
    expect(mapBundleToHeader(bundle, false).covers.map(c => c.sexual)).toEqual([0])
    expect(mapBundleToGameDetail(bundle, false).covers.map(c => c.sexual)).toEqual([0])
    expect(mapCardToListItem(card, false).covers.map(c => c.sexual)).toEqual([0])
    expect(mapCardToNestedGame(card, false).covers.map(c => c.sexual)).toEqual([0])
    expect(mapBundleToDetails(bundle, false).images.map(i => i.sexual)).toEqual([0])
  })

  it('keeps rated covers when the reader opted in', () => {
    expect(mapBundleToHeader(bundle, true).covers.map(c => c.sexual)).toEqual([1, 0])
    expect(mapCardToListItem(card, true).covers.map(c => c.sexual)).toEqual([1, 0])
    expect(mapBundleToDetails(bundle, true).images.map(i => i.sexual)).toEqual([1, 0])
  })

  it('omits the images block entirely for a strict reader on the game detail shape', () => {
    expect('images' in mapBundleToGameDetail(bundle, false)).toBe(false)
    expect('images' in mapBundleToGameDetail(bundle, true)).toBe(true)
  })
})

describe('read-through relations', () => {
  const relationBundle = {
    galgame: {
      external_links: [
        { name: 'website', label: 'Official website', url: 'https://a.test' },
        { name: 'steam', label: 'Steam', url: 'https://store.steampowered.com/app/1' },
      ],
    },
    relations: [
      {
        relation: 'SEQUEL',
        target_galgame: {
          id: 781,
          origin_title: 'safe',
          trans_title: null,
          nsfw: false,
          covers: coverRows,
        },
      },
      {
        relation: 'PREQUEL',
        target_galgame: {
          id: 900,
          origin_title: 'unmapped',
          trans_title: null,
          nsfw: false,
          covers: [],
        },
      },
      {
        relation: 'SIDE_STORY',
        target_galgame: {
          id: 950,
          origin_title: 'adult',
          trans_title: null,
          nsfw: true,
          covers: [],
        },
      },
    ],
  } as never

  const localIds = new Map([
    [781, 709],
    [950, 42],
  ])

  it('points to_game at the local shell id, never the hikarinagi id', () => {
    const [first] = mapBundleToRelations(relationBundle, localIds, true)

    expect(first.to_game_id).toBe(709)
    expect(first.to_game.id).toBe(709)
    expect(first.relation).toBe('SEQUEL')
  })

  it('drops a related work that has no local shell to link to', () => {
    const out = mapBundleToRelations(relationBundle, localIds, true)

    expect(out.map(row => row.to_game_id)).not.toContain(900)
  })

  it('hides both nsfw-flagged and rated-cover related works from a strict reader', () => {
    const strict = mapBundleToRelations(relationBundle, localIds, false)
    const loose = mapBundleToRelations(relationBundle, localIds, true)

    expect(strict.map(row => row.relation)).toEqual([])
    expect(loose.map(row => row.relation)).toEqual(['SEQUEL', 'SIDE_STORY'])
  })

  it('maps external links with a stable key for each entry', () => {
    expect(mapBundleToLinks(relationBundle)).toEqual([
      { id: 1, name: 'website', label: 'Official website', url: 'https://a.test' },
      { id: 2, name: 'steam', label: 'Steam', url: 'https://store.steampowered.com/app/1' },
    ])
  })
})

describe('card completeness', () => {
  const jaCard = {
    id: 1,
    origin_lang: 'ja',
    origin_title: 'げーむ',
    trans_title: '游戏',
    en_title: 'Game',
    aliases: ['alias'],
    adv_type: 'ADV',
    origin_intro: 'にほんご',
    trans_intro: '中文简介',
    en_intro: 'english',
    covers: [],
  } as never

  const zhCard = {
    id: 2,
    origin_lang: 'zh-Hans',
    origin_title: '中文原名',
    trans_title: null,
    en_title: null,
    aliases: [],
    adv_type: null,
    covers: [],
  } as never

  it('carries title_en, aliases and type on list cards', () => {
    expect(mapCardToListItem(jaCard, true)).toMatchObject({
      title_jp: 'げーむ',
      title_zh: '游戏',
      title_en: 'Game',
      aliases: ['alias'],
      type: 'ADV',
    })
  })

  it('carries release_date and the developer on list cards, not only on nested ones', () => {
    const card = {
      ...(jaCard as unknown as Record<string, unknown>),
      release_date: '2019-08-30',
      developer: { id: 396, name: 'ゆずソフト' },
    } as never

    expect(mapCardToListItem(card, true)).toMatchObject({
      release_date: '2019-08-30',
      developers: [{ developer: { id: 396, name: 'ゆずソフト' } }],
    })
    expect(mapCardToNestedGame(card, true)).toMatchObject({
      release_date: '2019-08-30',
      developers: [{ developer: { id: 396, name: 'ゆずソフト' } }],
    })
  })

  it('leaves the developer list empty when the card has none', () => {
    expect(mapCardToListItem(jaCard, true).developers).toEqual([])
  })

  it('carries the intros on nested cards so embedded cards are not blank', () => {
    expect(mapCardToNestedGame(jaCard, true)).toMatchObject({
      intro_jp: 'にほんご',
      intro_zh: '中文简介',
      intro_en: 'english',
    })
  })

  it('places a chinese-origin title in title_zh, never in title_jp', () => {
    const card = mapCardToListItem(zhCard, true)

    expect(card.title_jp).toBe('')
    expect(card.title_zh).toBe('中文原名')
  })
})

describe('tag ordering', () => {
  const tagBundle = {
    tags: [
      { tag: { id: 5, name: '柚子社', aliases: [], count: 20 } },
      { tag: { id: 1, name: 'Galgame', aliases: [], count: 10893 } },
      { tag: { id: 9, name: '幼刀！', aliases: [], count: 1 } },
      { tag: { id: 3, name: '废萌', aliases: [], count: 788 } },
      { tag: { id: 2, name: '同分', aliases: [], count: 20 } },
    ],
  } as never

  it('orders tags by usage count so the colour tiers stay contiguous', () => {
    expect(mapBundleToTags(tagBundle).map(row => row.tag.name)).toEqual([
      'Galgame',
      '废萌',
      '同分',
      '柚子社',
      '幼刀！',
    ])
  })

  it('breaks ties by id so the order is stable across requests', () => {
    const first = mapBundleToTags(tagBundle).map(row => row.tag.id)
    const second = mapBundleToTags(tagBundle).map(row => row.tag.id)

    expect(first).toEqual(second)
    expect(first.indexOf(2)).toBeLessThan(first.indexOf(5))
  })
})

describe('producer roles on the header', () => {
  const producerBundle = {
    galgame: {
      origin_lang: 'ja',
      origin_title: 'x',
      trans_title: null,
      aliases: [],
      covers: [],
      images: [],
    },
    producers: [
      { role: 'DEVELOPER', producer: { id: 1, name: 'Key', aliases: [] } },
      { role: 'DEVELOPER', producer: { id: 2, name: 'VisualArts', aliases: [] } },
      { role: 'PUBLISHER', producer: { id: 3, name: 'HIKARI FIELD', aliases: [] } },
      { role: 'LOCALIZER', producer: { id: 4, name: '汉化组', aliases: [] } },
    ],
    characters: [],
    staff: [],
    relations: [],
    tags: [],
  } as never

  it('shows developers only, never publishers or localizers', () => {
    expect(mapBundleToHeader(producerBundle, true).developers.map(d => d.developer.name)).toEqual([
      'Key',
      'VisualArts',
    ])
  })

  it('applies the same rule to the game detail shape', () => {
    expect(
      mapBundleToGameDetail(producerBundle, true).developers.map(d => d.developer.name),
    ).toEqual(['Key', 'VisualArts'])
  })
})

describe('whole-work gating on rated covers', () => {
  const withCover = (sexual: number) =>
    ({
      galgame: {
        nsfw: false,
        covers: [{ language: 'ja', kind: 'PACKAGE_FRONT', media: media(sexual) }],
      },
    }) as never

  it('treats a work with any rated cover as rated, even when the nsfw flag is off', () => {
    expect(hasRatedMedia(withCover(0))).toBe(false)
    expect(hasRatedMedia(withCover(1))).toBe(true)
    expect(hasRatedMedia(withCover(2))).toBe(true)
  })

  it('still honours the work-level nsfw flag on its own', () => {
    expect(hasRatedMedia({ galgame: { nsfw: true, covers: [] } } as never)).toBe(true)
  })

  it('drops a related work whose cover is rated, not just nsfw-flagged ones', () => {
    const bundle = {
      relations: [
        {
          relation: 'SEQUEL',
          target_galgame: {
            id: 781,
            origin_title: 'rated',
            trans_title: null,
            nsfw: false,
            covers: coverRows,
          },
        },
      ],
    } as never

    expect(mapBundleToRelations(bundle, new Map([[781, 709]]), false)).toEqual([])
    expect(mapBundleToRelations(bundle, new Map([[781, 709]]), true)).toHaveLength(1)
  })
})
