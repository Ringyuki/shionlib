import { formatDoc } from './format-doc'

describe('formatDoc', () => {
  it('formats indexed game document with derived fields', () => {
    const doc = formatDoc({
      id: 1,
      creator_id: 7,
      title_jp: '',
      title_zh: '中文标题',
      title_en: 'English Title',
      aliases: ['alias-a'],
      intro_jp: '',
      intro_zh: '中文简介',
      intro_en: 'english intro',
      tags: ['tag-a'],
      platform: ['win'],
      nsfw: false,
      covers: [
        { id: 10, sexual: 1, violence: 0, url: 'a.jpg', dims: [100, 200] },
        { id: 11, sexual: 5, violence: 0, url: 'b.jpg', dims: [300, 400] },
      ] as any,
      images: [{ id: 20, sexual: 2, violence: 1, url: 'c.jpg', dims: [50, 50] }] as any,
      release_date: new Date('2025-01-02T03:04:05.000Z'),
      extra_info: [],
      links: [],
      developers: [
        {
          role: 'main',
          developer: { id: 100, name: 'Dev A', aliases: ['A'] },
        },
      ],
      characters: [
        {
          role: 'main',
          actor: 'CV A',
          character: {
            name_jp: '名',
            name_en: 'Name',
            name_zh: '名字',
            aliases: ['n'],
            intro_jp: 'jp',
            intro_en: 'en',
            intro_zh: 'zh',
          },
        },
      ],
      staffs: ['writer'] as any,
    } as any)

    expect(doc.max_cover_sexual).toBe(5)
    expect(doc.title_jp).toBeUndefined()
    expect(doc.title_zh).toBe('中文标题')
    expect(doc.release_date).toBe('2025-01-02T03:04:05.000Z')
    expect(doc.developers_names).toEqual(['Dev A'])
    expect(doc.developers_aliases).toEqual(['A'])
    expect(doc.character_actors).toEqual(['CV A'])
    expect(doc.character_names_en).toEqual(['Name'])
    expect(doc.staffs).toEqual(['writer'])
  })

  it('handles empty cover list and missing release date', () => {
    const doc = formatDoc({
      id: 2,
      creator_id: 1,
      title_jp: 'JP',
      title_zh: 'ZH',
      title_en: 'EN',
      aliases: [],
      intro_jp: '',
      intro_zh: '',
      intro_en: '',
      tags: [],
      platform: [],
      nsfw: false,
      covers: [],
      images: [],
      release_date: undefined,
      extra_info: [],
      links: [],
      developers: [],
      characters: [],
      staffs: [],
    } as any)

    expect(doc.max_cover_sexual).toBe(0)
    expect(doc.release_date).toBeNull()
    expect(doc.developers).toEqual([])
    expect(doc.character_aliases).toEqual([])
  })
})
