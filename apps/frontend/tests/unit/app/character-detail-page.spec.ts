import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const notFound = vi.fn(() => {
    throw new Error('NOT_FOUND')
  })
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))
  const getPreferredCharacterContent = vi.fn()

  const CharacterContent = vi.fn(
    ({ appearances_count, content_limit }: { appearances_count: number; content_limit: number }) =>
      React.createElement(
        'section',
        {
          'data-testid': 'character-content',
          'data-appearances': String(appearances_count),
          'data-limit': String(content_limit),
        },
        'content',
      ),
  )

  return {
    notFound,
    get,
    requestFactory,
    getPreferredCharacterContent,
    CharacterContent,
  }
})

vi.mock('next/navigation', () => ({
  notFound: hoisted.notFound,
}))

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('@/components/character/CharacterContent', () => ({
  CharacterContent: hoisted.CharacterContent,
}))

vi.mock('@/components/game/description/helpers/getPreferredContent', () => ({
  getPreferredCharacterContent: hoisted.getPreferredCharacterContent,
}))

describe('app/[locale]/(main)/character/[id]/page (unit)', () => {
  beforeEach(() => {
    hoisted.notFound.mockClear()
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
    hoisted.getPreferredCharacterContent.mockReset()
  })

  it('calls notFound when id is invalid', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/character/[id]/page')

    await expect(
      pageModule.default({
        params: Promise.resolve({ id: 'x' }),
        searchParams: Promise.resolve({ page: '1' }),
      }),
    ).rejects.toThrow('NOT_FOUND')

    expect(hoisted.notFound).toHaveBeenCalledTimes(1)
  })

  it('fetches character + games and renders content', async () => {
    hoisted.get
      .mockResolvedValueOnce({
        data: { id: 9, name_zh: '角色', image: '/char.png' },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: 1 }],
          meta: { totalItems: 3, content_limit: 4 },
        },
      })

    const pageModule = await import('../../../app/[locale]/(main)/character/[id]/page')
    const element = await pageModule.default({
      params: Promise.resolve({ id: '9' }),
      searchParams: Promise.resolve({ page: '2' }),
    })

    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/character/9')
    expect(hoisted.get).toHaveBeenNthCalledWith(2, '/game/list', {
      params: {
        page: '2',
        pageSize: 15,
        character_id: '9',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="character-content"')
    expect(html).toContain('data-appearances="3"')
    expect(html).toContain('data-limit="4"')
  })

  it('builds metadata from preferred character content', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        id: 9,
        image: '/char.png',
      },
    })

    hoisted.getPreferredCharacterContent
      .mockReturnValueOnce({ name: 'Character Name' })
      .mockReturnValueOnce({ intro: 'Character intro for metadata description.' })

    const pageModule = await import('../../../app/[locale]/(main)/character/[id]/page')
    const metadata = await pageModule.generateMetadata({
      params: Promise.resolve({ locale: 'ja', id: '9' }),
    } as any)

    expect(hoisted.get).toHaveBeenCalledWith('/character/9')
    expect(metadata.title).toBe('Character Name')
    expect(metadata.description).toContain('Character intro')
    expect(metadata.alternates?.canonical).toBe('/ja/character/9')
  })
})
