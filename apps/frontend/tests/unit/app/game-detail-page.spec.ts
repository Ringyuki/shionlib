import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))
  const GameDetail = vi.fn(({ game }: { game: { id: number; name: string } }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'game-detail',
        'data-id': String(game.id),
      },
      game.name,
    ),
  )

  return {
    get,
    requestFactory,
    GameDetail,
  }
})

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('@/components/game/description/GameDetail', () => ({
  GameDetail: hoisted.GameDetail,
}))

vi.mock('@/components/game/pvn/GamePVNSection', () => ({
  GamePVNSection: ({ gameId }: { gameId: number }) =>
    React.createElement('aside', { 'data-testid': 'game-pvn', 'data-game-id': String(gameId) }),
}))

describe('app/[locale]/(main)/game/[id]/page (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('fetches game details and renders GameDetail component', async () => {
    hoisted.get.mockResolvedValue({
      data: {
        id: 88,
        name: 'Game 88',
      },
    })

    const pageModule = await import('../../../app/[locale]/(main)/game/[id]/page')
    const element = await pageModule.default({ params: Promise.resolve({ id: '88' }) })

    expect(hoisted.get).toHaveBeenCalledWith('/game/88/details')

    const html = renderToStaticMarkup(element)
    expect(html).toContain('data-testid="game-detail"')
    expect(html).toContain('data-id="88"')
    expect(html).toContain('Game 88')
  })
})
