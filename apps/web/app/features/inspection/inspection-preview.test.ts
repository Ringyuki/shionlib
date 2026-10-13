import { describe, expect, it } from 'vitest'
import { branchKey, entriesById, type Branches } from './inspection'
import { decodeText, lineCount, openedOf } from './inspection-preview'
import { entry, folder } from './inspection-testing'

const base64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes))

describe('decodeText', () => {
  it('reads the bytes in the encoding that is asked for', () => {
    const readme = base64([0x90, 0xe0, 0x96, 0xbe, 0x8f, 0x91])
    expect(decodeText(readme, 'shift_jis')).toBe('説明書')
    expect(decodeText(readme, 'utf-8')).not.toBe('説明書')
    expect(decodeText(base64([0xcb, 0xb5, 0xc3, 0xf7]), 'gbk')).toBe('说明')
    expect(decodeText(base64([0xff, 0xfe, 0x61, 0x00]), 'utf-16le')).toBe('a')
    expect(decodeText('', 'utf-8')).toBe('')
  })
})

describe('lineCount', () => {
  it('counts lines whether or not the last one ends', () => {
    expect(lineCount('')).toBe(0)
    expect(lineCount('one')).toBe(1)
    expect(lineCount('one\r\ntwo\r\n')).toBe(2)
    expect(lineCount('one\n\nthree')).toBe(3)
  })
})

describe('openedOf', () => {
  const cover = entry(4, { name: 'cover.jpg', preview: 'image', parent_id: 2 })
  const back = entry(5, { name: 'back.jpg', preview: 'image', parent_id: 2 })
  const readme = entry(6, { name: 'readme.txt', preview: 'text', parent_id: 2 })
  const tree: Branches = {
    [branchKey(null)]: { entries: [folder(1, 'Game', 1)], total: 1, loading: false },
    [branchKey(1)]: { entries: [folder(2, 'jpg', 3, 1)], total: 1, loading: false },
    [branchKey(2)]: { entries: [cover, back, readme], total: 3, loading: false },
  }

  it('names an entry by the folders above it and gathers the pictures beside it', () => {
    expect(openedOf(tree, entriesById(tree), back)).toEqual({
      entry: back,
      path: 'Game/jpg/back.jpg',
      images: [cover, back],
    })
    expect(openedOf(tree, entriesById(tree), readme).path).toBe('Game/jpg/readme.txt')
  })

  it('takes the folder of a search result from the result itself', () => {
    const found = { ...cover, location: 'Game/jpg' }
    const other = { ...entry(9, { name: 'top.png', preview: 'image' }), location: '' }
    const matches: Branches = {
      [branchKey(null)]: { entries: [found, other], total: 2, loading: false },
    }
    const known = entriesById(matches)
    expect(openedOf(matches, known, found)).toMatchObject({
      path: 'Game/jpg/cover.jpg',
      images: [found, other],
    })
    expect(openedOf(matches, known, other).path).toBe('top.png')
  })
})
