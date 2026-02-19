import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const CreateGame = vi.fn(() =>
    React.createElement('section', { 'data-testid': 'create-game' }, 'c'),
  )
  return { CreateGame }
})

vi.mock('@/components/create/Create', () => ({
  CreateGame: hoisted.CreateGame,
}))

describe('app/[locale]/(main)/create/page (unit)', () => {
  it('renders create game entry component', async () => {
    const pageModule = await import('../../../app/[locale]/(main)/create/page')
    const html = renderToStaticMarkup(pageModule.default())

    expect(html).toContain('data-testid="create-game"')
  })
})
