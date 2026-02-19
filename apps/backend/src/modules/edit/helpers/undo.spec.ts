import { extractRelationId, extractRelationKey } from './undo'

describe('undo helpers', () => {
  it('extractRelationId returns empty for null/scalar changes', () => {
    expect(extractRelationId(null)).toEqual([])
    expect(extractRelationId(undefined)).toEqual([])
    expect(extractRelationId({ before: {}, after: {} } as any)).toEqual([])
  })

  it('extractRelationId merges ids from relation pools and deduplicates', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const changes = {
      relation: 'developers',
      before: [{ id: 1 }, { id: 2 }],
      after: [{ id: 2 }, { id: 3 }],
      added: [{ id: 4 }],
      removed: [{ id: 1 }, { id: 'bad' }],
    }

    expect(extractRelationId(changes as any)).toEqual([1, 2, 3, 4])
    expect(logSpy).toHaveBeenCalled()
    logSpy.mockRestore()
  })

  it('extractRelationKey handles id/link/cover/fallback branches', () => {
    const byId = extractRelationKey({
      relation: 'characters',
      before: [{ id: 1 }, { id: 2 }],
      after: [{ id: 2 }],
    } as any)
    expect(byId).toEqual(['id:1', 'id:2'])

    const byLink = extractRelationKey({
      relation: 'links',
      before: [{ url: 'https://a', label: 'A', name: 'site' }],
    } as any)
    expect(byLink).toEqual(['link:https://a|A|site'])

    const byCover = extractRelationKey({
      relation: 'covers',
      before: [{ url: 'https://c', type: 'main', dims: { w: 1, h: 2 } }],
    } as any)
    expect(byCover).toEqual(['cover:https://c|main|{"w":1,"h":2}'])

    const fallback = extractRelationKey({
      relation: 'images',
      before: [{ path: '/a.png' }, { path: '/a.png' }],
    } as any)
    expect(fallback).toEqual(['{"path":"/a.png"}'])
  })
})
