import { GameCharacter } from '../interfaces/game.interface'
import { GameDeveloper } from '../interfaces/game.interface'

// dedupe characters in-place by v_id/b_id, merging fields when duplicates found
export const dedupeCharactersInPlace = (items: GameCharacter[]) => {
  if (!items.length) return
  const indexByKey = new Map<string, number>()
  const result: GameCharacter[] = []

  const getKeys = (c: GameCharacter): string[] => {
    const keys: string[] = []
    if (c.v_id) keys.push(`v:${c.v_id}`)
    if (c.b_id) keys.push(`b:${c.b_id}`)
    const nameKey = formatString(c.name_en || c.name_jp || c.name_zh)
    if (!c.v_id && !c.b_id && nameKey) keys.push(`n:${nameKey}`)
    return keys.filter(Boolean)
  }

  for (const curr of items) {
    const keys = getKeys(curr)
    let existingIdx = -1
    for (const k of keys) {
      const idx = indexByKey.get(k)
      if (idx !== undefined) {
        existingIdx = idx
        break
      }
    }
    if (existingIdx >= 0) {
      const target = result[existingIdx]
      mergeCharacterFields(target, curr)
      for (const k of keys) indexByKey.set(k, existingIdx)
    } else {
      const idx = result.length
      result.push({ ...curr })
      for (const k of keys) indexByKey.set(k, idx)
    }
  }

  items.length = 0
  items.push(...result)
}

// dedupe developers in-place by v_id/b_id/name
export const dedupeDevelopersInPlace = (items: GameDeveloper[]) => {
  if (!items.length) return
  const indexByKey = new Map<string, number>()
  const result: GameDeveloper[] = []

  const getKeys = (d: GameDeveloper): string[] => {
    const keys: string[] = []
    if (d.v_id) keys.push(`v:${d.v_id}`)
    if (d.b_id) keys.push(`b:${d.b_id}`)
    const nameKey = formatString(d.name)
    if (nameKey) keys.push(`n:${nameKey}`)
    return keys.filter(Boolean)
  }

  for (const curr of items) {
    const keys = getKeys(curr)
    let existingIdx = -1
    for (const k of keys) {
      const idx = indexByKey.get(k)
      if (idx !== undefined) {
        existingIdx = idx
        break
      }
    }
    if (existingIdx >= 0) {
      const target = result[existingIdx]
      mergeDeveloperFields(target, curr)
      for (const k of keys) indexByKey.set(k, existingIdx)
    } else {
      const idx = result.length
      result.push({ ...curr })
      for (const k of keys) indexByKey.set(k, idx)
    }
  }

  items.length = 0
  items.push(...result)
}

const mergeCharacterFields = (target: GameCharacter, incoming: GameCharacter) => {
  const pick = <K extends keyof GameCharacter>(k: K) => {
    if (incoming[k] === undefined || incoming[k] === null) return
    const v = incoming[k]
    if (Array.isArray(v)) {
      const existing = Array.isArray(target[k] as any) ? ([...(target[k] as any)] as any[]) : []
      const merged = [...existing, ...v].filter((x, i, self) => self.indexOf(x) === i)
      ;(target as any)[k] = merged
    } else if ((target as any)[k] === undefined || (target as any)[k] === null) {
      ;(target as any)[k] = v
    }
  }
  const keys: (keyof GameCharacter)[] = [
    'b_id',
    'v_id',
    'image',
    'actor',
    'role',
    'name_jp',
    'name_zh',
    'name_en',
    'aliases',
    'intro_jp',
    'intro_zh',
    'intro_en',
    'gender',
    'blood_type',
    'height',
    'weight',
    'bust',
    'waist',
    'hips',
    'cup',
    'age',
    'birthday',
  ]
  for (const k of keys) pick(k)
}

const formatString = (str: string | undefined) => {
  if (!str) return ''
  return str
    .replace(/[\n\r\t]/g, '')
    .replace(/\s*/g, '')
    .trim()
    .toLowerCase()
}

const mergeDeveloperFields = (target: GameDeveloper, incoming: GameDeveloper) => {
  const pick = <K extends keyof GameDeveloper>(k: K) => {
    if (incoming[k] === undefined || incoming[k] === null) return
    const v = incoming[k]
    if (Array.isArray(v)) {
      const existing = Array.isArray(target[k] as any) ? ([...(target[k] as any)] as any[]) : []
      const merged = [...existing, ...v].filter((x, i, self) => self.indexOf(x) === i)
      ;(target as any)[k] = merged
    } else if ((target as any)[k] === undefined || (target as any)[k] === null) {
      ;(target as any)[k] = v
    }
  }
  const keys: (keyof GameDeveloper)[] = [
    'b_id',
    'v_id',
    'name',
    'aliases',
    'logo',
    'intro_jp',
    'intro_zh',
    'intro_en',
    'extra_info',
  ]
  for (const k of keys) pick(k)
}
