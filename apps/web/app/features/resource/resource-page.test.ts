import { describe, expect, it } from 'vitest'
import {
  changedValues,
  digestsOf,
  eventChanges,
  eventFiles,
  fileGroups,
  headlineOf,
  resourcePath,
  resourceTabAt,
} from './resource-page'
import { resourceTabFrom } from './resource-page.schema'

type Inspections = Parameters<typeof fileGroups>[1]

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

  it('lists the checksums a file has, the one computed by the check first', () => {
    expect(digestsOf({ hash_algorithm: 'blake3', file_hash: 'b3', sha256: 'computed' })).toEqual([
      { name: 'SHA-256', value: 'computed' },
      { name: 'BLAKE3', value: 'b3' },
    ])
    expect(digestsOf({ hash_algorithm: 'sha256', file_hash: 'uploaded', sha256: null })).toEqual([
      { name: 'SHA-256', value: 'uploaded' },
    ])
    expect(digestsOf({ hash_algorithm: 'blake3', file_hash: 'b3', sha256: null })).toEqual([
      { name: 'BLAKE3', value: 'b3' },
    ])
  })
})

describe('fileGroups', () => {
  const inspected = (id: number): Inspections[number] => ({
    id,
    status: 'ready',
    archive: {
      format: 'rar5',
      solid: false,
      volumes: 2,
      recovery: false,
      recovery_percent: 0,
      name_encoding: '',
      unsupported: false,
    },
    files: 1,
    folders: 0,
    size: 1,
    disc_files: 0,
    truncated: false,
    verified: true,
    scan: {
      engine: '',
      signatures_at: null,
      scanned: 0,
      skipped: null,
      limit: 0,
      detections: null,
      at: null,
      cleared_at: null,
    },
    discs: null,
    created: '2026-10-11T00:00:00.000Z',
  })

  it('keeps the volumes of one archive together and every other file by itself', () => {
    const files = [
      { name: 'game.part1.rar', inspection_id: 7 },
      { name: 'bonus.zip', inspection_id: 8 },
      { name: 'game.part2.rar', inspection_id: 7 },
      { name: 'old.7z', inspection_id: null },
      { name: 'older.7z', inspection_id: null },
      { name: 'swept.7z', inspection_id: 99 },
    ]
    const groups = fileGroups(files, [inspected(7), inspected(8)])
    expect(groups.map(group => group.files.map(file => file.name))).toEqual([
      ['game.part1.rar', 'game.part2.rar'],
      ['bonus.zip'],
      ['old.7z'],
      ['older.7z'],
      ['swept.7z'],
    ])
    expect(groups.map(group => group.inspection?.id)).toEqual([
      7,
      8,
      undefined,
      undefined,
      undefined,
    ])
  })
})
