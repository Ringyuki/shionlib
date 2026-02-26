// @vitest-environment jsdom
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContentLimit } from '@/interfaces/user/user.interface'

const hoisted = vi.hoisted(() => ({
  spoilerProps: [] as any[],
}))

vi.mock('next-intl', () => ({
  useLocale: () => 'zh',
}))

vi.mock('@/i18n/navigation.client', () => ({
  Link: ({ href, className, children }: any) =>
    React.createElement(
      'a',
      { href: typeof href === 'string' ? href : String(href), className },
      children,
    ),
}))

vi.mock('@/components/shionui/Card', () => ({
  Card: ({ children, className }: any) => React.createElement('div', { className }, children),
  CardContent: ({ children, className }: any) =>
    React.createElement('div', { className }, children),
}))

vi.mock('@/components/common/shared/FadeImage', () => ({
  FadeImage: ({ alt }: any) => React.createElement('img', { alt: alt || '' }),
}))

vi.mock('@/components/shionui/Spoiler', () => ({
  Spoiler: (props: any) => {
    hoisted.spoilerProps.push(props)
    return React.createElement('div', { 'data-testid': 'spoiler' }, props.children)
  },
}))

vi.mock('@/components/game/description/helpers/getPreferredContent', () => ({
  getPreferredContent: (game: any, type: string) => {
    if (type === 'title') {
      return { title: game.title_zh || 'title', language: 'zh', disable_languages: [] }
    }
    if (type === 'intro') {
      return { intro: game.intro_zh || '', language: 'zh', disable_languages: [] }
    }
    return { cover: game.covers?.[0], vertical: true, aspect: '1 / 1.5' }
  },
}))

import { GameEmbeddedCard } from '@/components/game/GameEmbeddedCard'

const makeGame = (cover?: Partial<{ sexual: number; url: string }>) =>
  ({
    id: 1,
    title_jp: 'title-jp',
    title_zh: '标题',
    title_en: 'title-en',
    intro_jp: 'intro-jp',
    intro_zh: '这是简介',
    intro_en: 'intro-en',
    covers: cover
      ? [
          {
            language: 'zh',
            url: cover.url ?? '/cover.png',
            type: 'dig',
            dims: [600, 800],
            sexual: cover.sexual ?? 0,
            violence: 0,
          },
        ]
      : [],
  }) as any

describe('components/game/GameEmbeddedCard (unit)', () => {
  beforeEach(() => {
    hoisted.spoilerProps.length = 0
  })

  it('renders safely when cover is missing', () => {
    render(React.createElement(GameEmbeddedCard, { game: makeGame() }))

    expect(screen.getByText('标题')).toBeTruthy()
    expect(screen.getByText('#1')).toBeTruthy()
    expect(hoisted.spoilerProps).toHaveLength(0)
  })

  it('locks spoiler closed for NEVER_SHOW_NSFW_CONTENT', () => {
    render(
      React.createElement(GameEmbeddedCard, {
        game: makeGame({ sexual: 2 }),
        content_limit: ContentLimit.NEVER_SHOW_NSFW_CONTENT,
      }),
    )

    expect(screen.getByTestId('spoiler')).toBeTruthy()
    expect(hoisted.spoilerProps[0]?.open).toBe(false)
  })

  it('locks spoiler closed for SHOW_WITH_SPOILER', () => {
    render(
      React.createElement(GameEmbeddedCard, {
        game: makeGame({ sexual: 2 }),
        content_limit: ContentLimit.SHOW_WITH_SPOILER,
      }),
    )

    expect(screen.getByTestId('spoiler')).toBeTruthy()
    expect(hoisted.spoilerProps[0]?.open).toBe(false)
  })
})
