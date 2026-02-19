import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const requestFactory = vi.fn(() => ({ get }))

  const CharacterScalarEdit = vi.fn(({ data }: { data: { id?: number } }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'character-scalar-edit',
        'data-id': String(data?.id ?? 0),
      },
      'cs',
    ),
  )

  const DeveloperScalarEdit = vi.fn(({ data }: { data: { id?: number } }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'developer-scalar-edit',
        'data-id': String(data?.id ?? 0),
      },
      'ds',
    ),
  )

  const GameCharacter = vi.fn(({ characters }: { characters: unknown[] }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'game-characters',
        'data-count': String(characters.length),
      },
      'gc',
    ),
  )

  const CommentContent = vi.fn(({ game_id, comments }: { game_id: string; comments: unknown[] }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'game-comments',
        'data-game-id': game_id,
        'data-count': String(comments.length),
      },
      'cc',
    ),
  )

  const Character = vi.fn(({ id, initRelations }: { id: number; initRelations: unknown[] }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'game-edit-character',
        'data-id': String(id),
        'data-count': String(initRelations.length),
      },
      'ec',
    ),
  )

  const Cover = vi.fn(({ covers }: { covers: unknown[] }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'game-edit-cover',
        'data-count': String(covers.length),
      },
      'cover',
    ),
  )

  const Developer = vi.fn(({ id, initRelations }: { id: number; initRelations: unknown[] }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'game-edit-developer',
        'data-id': String(id),
        'data-count': String(initRelations.length),
      },
      'ed',
    ),
  )

  const GameImageEditComponent = vi.fn(({ images }: { images: unknown[] }) =>
    React.createElement(
      'section',
      {
        'data-testid': 'game-edit-image',
        'data-count': String(images.length),
      },
      'img',
    ),
  )

  const Scalar = vi.fn(({ data }: { data: { id?: number } }) =>
    React.createElement(
      'section',
      { 'data-testid': 'game-edit-scalar', 'data-id': String(data?.id ?? 0) },
      's',
    ),
  )

  return {
    get,
    requestFactory,
    CharacterScalarEdit,
    DeveloperScalarEdit,
    GameCharacter,
    CommentContent,
    Character,
    Cover,
    Developer,
    GameImageEditComponent,
    Scalar,
  }
})

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

vi.mock('@/components/character/edit/Scalar', () => ({
  CharacterScalarEdit: hoisted.CharacterScalarEdit,
}))
vi.mock('@/components/developer/edit/Scalar', () => ({
  DeveloperScalarEdit: hoisted.DeveloperScalarEdit,
}))
vi.mock('@/components/game/description/GameCharacter', () => ({
  GameCharacter: hoisted.GameCharacter,
}))
vi.mock('@/components/common/comment/CommentContent', () => ({
  CommentContent: hoisted.CommentContent,
}))
vi.mock('@/components/game/edit/Character', () => ({ Character: hoisted.Character }))
vi.mock('@/components/game/edit/Cover', () => ({ Cover: hoisted.Cover }))
vi.mock('@/components/game/edit/Developer', () => ({ Developer: hoisted.Developer }))
vi.mock('@/components/game/edit/Image', () => ({ Image: hoisted.GameImageEditComponent }))
vi.mock('@/components/game/edit/Scalar', () => ({ Scalar: hoisted.Scalar }))

describe('app/[locale]/(main) scalar/game-edit pages (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('renders character/developer scalar edit pages', async () => {
    hoisted.get
      .mockResolvedValueOnce({ data: { id: 11 } })
      .mockResolvedValueOnce({ data: { id: 22 } })

    const characterModule =
      await import('../../../app/[locale]/(main)/character/[id]/edit/scalar/page')
    const developerModule =
      await import('../../../app/[locale]/(main)/developer/[id]/edit/scalar/page')

    const c = await characterModule.default({ params: Promise.resolve({ id: '11' }) })
    const d = await developerModule.default({ params: Promise.resolve({ id: '22' }) })

    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/edit/character/11/scalar')
    expect(hoisted.get).toHaveBeenNthCalledWith(2, '/edit/developer/22/scalar')

    expect(renderToStaticMarkup(c)).toContain('data-testid="character-scalar-edit"')
    expect(renderToStaticMarkup(c)).toContain('data-id="11"')
    expect(renderToStaticMarkup(d)).toContain('data-testid="developer-scalar-edit"')
    expect(renderToStaticMarkup(d)).toContain('data-id="22"')
  })

  it('renders game characters/comments pages with fetched data', async () => {
    hoisted.get
      .mockResolvedValueOnce({ data: { characters: [{ id: 1 }, { id: 2 }] } })
      .mockResolvedValueOnce({ data: { items: [{ id: 1 }] } })

    const charactersModule = await import('../../../app/[locale]/(main)/game/[id]/characters/page')
    const commentsModule = await import('../../../app/[locale]/(main)/game/[id]/comments/page')

    const characters = await charactersModule.default({ params: Promise.resolve({ id: '9' }) })
    const comments = await commentsModule.default({ params: Promise.resolve({ id: '9' }) })

    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/game/9/characters')
    expect(hoisted.get).toHaveBeenNthCalledWith(2, '/comment/game/9', {
      params: {
        page: 1,
        pageSize: 50,
      },
    })

    expect(renderToStaticMarkup(characters)).toContain('data-testid="game-characters"')
    expect(renderToStaticMarkup(characters)).toContain('data-count="2"')
    expect(renderToStaticMarkup(comments)).toContain('data-testid="game-comments"')
    expect(renderToStaticMarkup(comments)).toContain('data-game-id="9"')
    expect(renderToStaticMarkup(comments)).toContain('data-count="1"')
  })

  it('renders all game edit sub-pages', async () => {
    hoisted.get
      .mockResolvedValueOnce({ data: [{ id: 1 }] })
      .mockResolvedValueOnce({ data: [{ id: 2 }] })
      .mockResolvedValueOnce({ data: [{ id: 3 }] })
      .mockResolvedValueOnce({ data: [{ id: 4 }] })
      .mockResolvedValueOnce({ data: { id: 77 } })

    const characterEditModule =
      await import('../../../app/[locale]/(main)/game/[id]/edit/character/page')
    const coverEditModule = await import('../../../app/[locale]/(main)/game/[id]/edit/cover/page')
    const developerEditModule =
      await import('../../../app/[locale]/(main)/game/[id]/edit/developer/page')
    const imageEditModule = await import('../../../app/[locale]/(main)/game/[id]/edit/image/page')
    const scalarEditModule = await import('../../../app/[locale]/(main)/game/[id]/edit/scalar/page')

    const ec = await characterEditModule.default({ params: Promise.resolve({ id: 5 as any }) })
    const cv = await coverEditModule.default({ params: Promise.resolve({ id: '5' }) })
    const ed = await developerEditModule.default({ params: Promise.resolve({ id: 5 as any }) })
    const img = await imageEditModule.default({ params: Promise.resolve({ id: '5' }) })
    const sc = await scalarEditModule.default({ params: Promise.resolve({ id: '5' }) })

    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/edit/game/5/characters')
    expect(hoisted.get).toHaveBeenNthCalledWith(2, '/edit/game/5/cover')
    expect(hoisted.get).toHaveBeenNthCalledWith(3, '/edit/game/5/developers')
    expect(hoisted.get).toHaveBeenNthCalledWith(4, '/edit/game/5/image')
    expect(hoisted.get).toHaveBeenNthCalledWith(5, '/edit/game/5/scalar')

    expect(renderToStaticMarkup(ec)).toContain('data-testid="game-edit-character"')
    expect(renderToStaticMarkup(cv)).toContain('data-testid="game-edit-cover"')
    expect(renderToStaticMarkup(ed)).toContain('data-testid="game-edit-developer"')
    expect(renderToStaticMarkup(img)).toContain('data-testid="game-edit-image"')
    expect(renderToStaticMarkup(sc)).toContain('data-testid="game-edit-scalar"')
  })
})
