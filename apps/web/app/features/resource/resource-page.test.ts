import { describe, expect, it } from 'vitest'
import {
  changedValues,
  eventChanges,
  eventFiles,
  hashName,
  headlineOf,
  resourcePath,
  resourceTabAt,
} from './resource-page'
import { resourceTabFrom } from './resource-page.schema'

describe('addresses', () => {
  const pathOf = (tab: Parameters<typeof resourcePath>[2]) => resourcePath('zh', 12, tab)

  it('puts the contents at the address of the resource and every other tab under it', () => {
    expect(resourcePath('zh', 12)).toBe('/zh/resource/12')
    expect(resourcePath('ja', 12, 'comments')).toBe('/ja/resource/12/comments')
  })

  it('tells the open tab from the address', () => {
    expect(resourceTabAt('/zh/resource/12', pathOf)).toBe('contents')
    expect(resourceTabAt('/zh/resource/12/history', pathOf)).toBe('history')
    expect(resourceTabAt('/zh/resource/12/comments', pathOf)).toBe('comments')
    expect(resourceTabAt('/zh/resource/123/details', pathOf)).toBe('contents')
  })

  it('accepts only the names of tabs', () => {
    expect(resourceTabFrom('details')).toBe('details')
    expect(resourceTabFrom('files')).toBeUndefined()
  })
})

describe('headlineOf', () => {
  it('names the resource after its first file and counts the others', () => {
    expect(headlineOf([{ file_name: 'game.part1.rar' }, { file_name: 'game.part2.rar' }])).toEqual({
      name: 'game.part1.rar',
      others: 1,
    })
    expect(headlineOf([{ file_name: 'game.7z' }])).toEqual({ name: 'game.7z', others: 0 })
    expect(headlineOf([])).toEqual({ name: '', others: 0 })
  })
})

describe('what an event carries', () => {
  it('reads missing lists as empty', () => {
    expect(eventFiles({ files: null })).toEqual([])
    expect(eventChanges({ changes: null })).toEqual([])
    expect(changedValues(null)).toEqual([])
    expect(changedValues(['win'])).toEqual(['win'])
  })

  it('writes the name of a checksum the way its tools do', () => {
    expect(hashName('sha256')).toBe('SHA-256')
    expect(hashName('blake3')).toBe('BLAKE3')
  })
})
