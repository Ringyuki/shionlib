import { describe, expect, it } from 'vitest'
import {
  getAspectRatio,
  getPreferredCharacterContent,
  getPreferredContent,
  getPreferredDeveloperContent,
} from '../../../../components/game/description/helpers/getPreferredContent'

describe('components/game/description/helpers/getPreferredContent (unit)', () => {
  it('computes aspect ratio buckets', () => {
    expect(getAspectRatio([100, 100])).toBe('1 / 1')
    expect(getAspectRatio([100, 200])).toBe('1 / 1.5')
    expect(getAspectRatio([200, 100])).toBe('1.5 / 1')
    expect(getAspectRatio([0, 0])).toBe('1.5 / 1')
  })

  it('picks preferred cover by language with orientation metadata', () => {
    const preferred = getPreferredContent(
      {
        covers: [
          { language: 'zh', url: 'zh.webp', dims: [300, 200] },
          { language: 'en', url: 'en.webp', dims: [200, 300] },
        ],
      } as any,
      'cover',
      'en',
    )

    expect(preferred.cover.url).toBe('en.webp')
    expect(preferred.aspect).toBe('1 / 1.5')
    expect(preferred.vertical).toBe(true)
  })

  it('falls back title/intro and computes disabled language list', () => {
    const title = getPreferredContent(
      {
        title_jp: '',
        title_en: '',
        title_zh: '中文标题',
      } as any,
      'title',
      'en',
    )
    expect(title.title).toBe('中文标题')
    expect(title.language).toBe('zh')
    expect(title.disable_languages).toEqual(expect.arrayContaining(['jp', 'en']))

    const intro = getPreferredContent(
      {
        intro_jp: '',
        intro_en: 'English intro',
        intro_zh: '',
      } as any,
      'intro',
      'zh',
    )
    expect(intro.intro).toBe('English intro')
    expect(intro.language).toBe('en')
    expect(intro.disable_languages).toEqual(expect.arrayContaining(['jp', 'zh']))
  })

  it('picks preferred character/developer content with fallback', () => {
    const name = getPreferredCharacterContent(
      {
        name_jp: '',
        name_en: 'Alice',
        name_zh: '',
        intro_jp: '',
        intro_en: '',
        intro_zh: '角色介绍',
      } as any,
      'name',
      'zh',
    )
    expect(name.name).toBe('Alice')
    expect(name.language).toBe('en')

    const characterIntro = getPreferredCharacterContent(
      {
        name_jp: '',
        name_en: '',
        name_zh: '',
        intro_jp: '',
        intro_en: 'Character intro',
        intro_zh: '',
      } as any,
      'intro',
      'zh',
    )
    expect(characterIntro.intro).toBe('Character intro')
    expect(characterIntro.language).toBe('en')

    const developerIntro = getPreferredDeveloperContent(
      {
        intro_jp: '',
        intro_en: 'Developer intro',
        intro_zh: '',
      } as any,
      'zh',
    )
    expect(developerIntro.intro).toBe('Developer intro')
    expect(developerIntro.language).toBe('en')
  })
})
