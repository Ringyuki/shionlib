import { describe, expect, it } from 'vitest'
import { pageMeta, shareImage, type HeadArgs } from './seo'
import { breadcrumbs } from './structured-data'

const root = {
  id: 'root',
  loaderData: {
    publicConfig: { siteUrl: 'https://shionlib.com', ogImageUrl: 'https://og.example' },
  },
}

function args(path: string, lang = 'zh'): HeadArgs {
  const url = new URL(path, 'https://shionlib.com')
  return {
    location: { pathname: url.pathname, search: url.search },
    params: { lang },
    matches: [root],
  }
}

function tag(tags: ReturnType<typeof pageMeta>, key: string, value: string) {
  return tags.find(entry => Object.entries(entry).some(([k, v]) => k === key && v === value))
}

describe('pageMeta', () => {
  it('writes the head of an indexed Chinese page', () => {
    const tags = pageMeta(args('/zh/game/962/'), {
      title: '橘光柠水随想曲',
      description: '一行目\n\n二行目',
      image: shareImage('/game/962', '橘光柠水随想曲'),
      structured: at => [breadcrumbs(at, [{ name: '游戏库', path: '/zh/game' }])],
    })
    expect(tags).toContainEqual({ title: '橘光柠水随想曲 - Shionlib' })
    expect(tags).toContainEqual({ name: 'description', content: '一行目 二行目' })
    expect(tags).toContainEqual({ name: 'robots', content: 'max-image-preview:large' })
    expect(tags).toContainEqual({
      tagName: 'link',
      rel: 'canonical',
      href: 'https://shionlib.com/zh/game/962',
    })
    expect(tags).toContainEqual({
      property: 'og:image',
      content: 'https://og.example/game/962?locale=zh',
    })
    expect(tags).toContainEqual({ property: 'og:locale', content: 'zh_CN' })
    expect(tags).toContainEqual({ name: 'twitter:card', content: 'summary_large_image' })
    expect(tags).toContainEqual({
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: '游戏库',
            item: 'https://shionlib.com/zh/game',
          },
        ],
      },
    })
  })

  it('keeps English and Japanese pages out of search', () => {
    for (const lang of ['en', 'ja']) {
      const tags = pageMeta(args(`/${lang}/game/962`, lang), { title: 'Game' })
      expect(tag(tags, 'content', 'noindex, follow')).toBeDefined()
      expect(tag(tags, 'rel', 'canonical')).toBeUndefined()
    }
  })

  it('indexes pages of a list but not its filters, and never private pages', () => {
    const paged = pageMeta(args('/zh/game?page=3'), { title: '游戏库' })
    expect(paged).toContainEqual({
      tagName: 'link',
      rel: 'canonical',
      href: 'https://shionlib.com/zh/game?page=3',
    })
    const filtered = pageMeta(args('/zh/game?tag=纯爱&page=2'), { title: '游戏库' })
    expect(tag(filtered, 'content', 'noindex, follow')).toBeDefined()
    const own = pageMeta(args('/zh/user/settings'), { title: '设置', indexable: false })
    expect(tag(own, 'rel', 'canonical')).toBeUndefined()
  })

  it('keeps a whole title, defaults the share image and clips long descriptions', () => {
    const tags = pageMeta(args('/zh'), {
      title: 'Shionlib 书音的图书馆',
      whole: true,
      description: '汐'.repeat(400),
    })
    expect(tags).toContainEqual({ title: 'Shionlib 书音的图书馆' })
    expect(tags).toContainEqual({
      property: 'og:image',
      content: 'https://og.example/default?locale=zh',
    })
    const description = tag(tags, 'name', 'description')
    expect(
      description !== undefined &&
        'content' in description &&
        Array.from(String(description.content)),
    ).toHaveLength(160)
  })

  it('writes nothing without the site or a head', () => {
    expect(pageMeta({ ...args('/zh'), matches: [] }, { title: 'x' })).toEqual([])
    expect(pageMeta(args('/zh'), undefined)).toEqual([])
  })
})
