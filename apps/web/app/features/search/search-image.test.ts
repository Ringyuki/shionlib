import { describe, expect, it } from 'vitest'
import {
  cropFrame,
  gameOf,
  listedSightings,
  pastedImage,
  shotWidthRem,
  urlsOf,
  type ImageFindings,
} from './search-image'

const screen = { width: 1920, height: 1080 }

describe('cropFrame', () => {
  it('frames a face in a portrait with room around it', () => {
    const frame = cropFrame({ left: 0.694, top: 0.234, right: 0.829, bottom: 0.487 }, screen)
    expect(frame.width / frame.height).toBeCloseTo(3 / 4, 2)
    expect(frame.height).toBe(Math.round((((0.829 - 0.694) * 1920) / (3 / 4)) * 1.2))
    expect(frame.x + frame.width / 2).toBeCloseTo(((0.694 + 0.829) / 2) * 1920, 0)
  })

  it('keeps the frame inside the picture at its edges', () => {
    const corner = cropFrame({ left: 0, top: 0.9, right: 0.05, bottom: 1 }, screen)
    expect(corner.x).toBe(0)
    expect(corner.y + corner.height).toBe(1080)
    const wide = cropFrame({ left: 0, top: 0, right: 1, bottom: 1 }, screen)
    expect(wide.height).toBe(1080)
    expect(wide.x).toBeGreaterThanOrEqual(0)
    expect(wide.x + wide.width).toBeLessThanOrEqual(1920)
  })

  it('fits a frame into a picture narrower than three quarters of its height', () => {
    const narrow = cropFrame({ left: 0, top: 0, right: 1, bottom: 1 }, { width: 300, height: 1200 })
    expect(narrow.width).toBe(300)
    expect(narrow.height).toBe(400)
  })
})

describe('shotWidthRem', () => {
  it('follows the picture within a limit', () => {
    expect(shotWidthRem(16 / 9)).toBeCloseTo((16 / 9) * 3)
    expect(shotWidthRem(10)).toBe(7.5)
    expect(shotWidthRem(0.1)).toBe(1.5)
  })
})

describe('pastedImage', () => {
  const item = (kind: string, type: string) => {
    const file = new File(['x'], 'pasted', { type })
    return { kind, type, getAsFile: () => file }
  }

  it('takes the first picture of a supported type', () => {
    expect(pastedImage([item('string', 'text/plain'), item('file', 'image/png')])?.type).toBe(
      'image/png',
    )
  })

  it('ignores text and unsupported pictures', () => {
    expect(pastedImage([item('string', 'text/plain'), item('file', 'image/heic')])).toBeUndefined()
  })
})

describe('gameOf', () => {
  it('finds the listed game a sighting matched', () => {
    const games = [{ id: 1 }, { id: 2 }]
    expect(gameOf(games, 2)?.id).toBe(2)
    expect(gameOf(games, null)).toBeUndefined()
    expect(gameOf(null, 1)).toBeUndefined()
  })
})

describe('listedSightings', () => {
  const box = { left: 0, top: 0, right: 1, bottom: 1 }
  const sighting = (name: string, work: string, characterId: number | null) => ({
    box,
    name,
    work,
    unsure: false,
    game_id: null,
    character:
      characterId === null
        ? null
        : {
            id: characterId,
            image: null,
            image_thumb_hash: null,
            name_jp: name,
            name_zh: null,
            name_en: null,
          },
  })

  it('lists each character once and keeps where it was first seen', () => {
    const listed = listedSightings([
      sighting('レナ', '千恋＊万花', 92),
      sighting('朝武安晴', '千恋＊万花', null),
      sighting('レナ・リヒテナウアー', '千恋＊万花', 92),
      sighting('朝武安晴', '千恋＊万花', null),
      sighting('朝武安晴', 'other', null),
    ])
    expect(listed.map(item => item.index)).toEqual([0, 1, 4])
    expect(listedSightings(null)).toEqual([])
  })
})

describe('urlsOf', () => {
  it('lists the object addresses a state holds', () => {
    const findings: ImageFindings = {
      source: { name: 'R', url: 'https://r.test/' },
      games: [],
      unlisted_works: [],
      characters: [],
    }
    const shot = { src: 'blob:shot', ratio: 1 }
    expect(urlsOf({ phase: 'off' })).toEqual([])
    expect(urlsOf({ phase: 'reading', shot })).toEqual(['blob:shot'])
    expect(
      urlsOf({
        phase: 'done',
        shot,
        findings,
        crops: ['blob:a', '', 'blob:b'],
      }),
    ).toEqual(['blob:shot', 'blob:a', 'blob:b'])
  })
})
