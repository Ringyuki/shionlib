const MIN_CONTAIN_LEN = 3

type FinalCharacter = {
  name_jp?: string
  name_en?: string
  name_zh?: string
  aliases?: string[]
  [k: string]: any
}

type RawVNDBCharacter = {
  name?: string | null
  original?: string | null
  aliases?: string[] | null
  [k: string]: any
}

const has = (s?: string | null): s is string => !!(s && String(s).trim())
const norm = (s?: string | null) =>
  (s ?? '')
    .normalize('NFKC')
    .replace(/（.*?）|\(.*?\)/g, '')
    .replace(/[・·•\s_\-’'".,，、:：;；~～]/g, '')
    .toLowerCase()
    .trim()

const containsLoose = (a: string, b: string) =>
  a.length >= MIN_CONTAIN_LEN && b.length >= MIN_CONTAIN_LEN && (a.includes(b) || b.includes(a))

const collectFinalKeys = (c: FinalCharacter) => {
  const arr = [c.name_jp, c.name_en, c.name_zh, ...(c.aliases ?? [])].filter(has)
  const raw = arr.map(norm)
  return new Set(raw)
}

const collectRawKeys = (r: RawVNDBCharacter) => {
  const keys: Array<{ key: string; weight: number }> = []
  if (has(r.name)) keys.push({ key: norm(r.name!), weight: 3 })
  if (has(r.original)) keys.push({ key: norm(r.original!), weight: 3 })
  for (const al of r.aliases ?? []) {
    if (has(al)) keys.push({ key: norm(al), weight: 2 })
  }

  const best = new Map<string, number>()
  for (const { key, weight } of keys) {
    if (!key) continue
    best.set(key, Math.max(best.get(key) ?? 0, weight))
  }
  return Array.from(best.entries()).map(([key, weight]) => ({ key, weight }))
}

export const createCharacterMatcher = (finalCharactersData: FinalCharacter[]) => {
  const index = new Map<string, FinalCharacter[]>()

  const finalItemsWithKeys = finalCharactersData.map(item => {
    const keys = collectFinalKeys(item)
    for (const k of keys) {
      if (!k) continue
      const bucket = index.get(k)
      if (bucket) bucket.push(item)
      else index.set(k, [item])
    }
    return { item, keys }
  })

  const match = (rawChar: RawVNDBCharacter): FinalCharacter | undefined => {
    const rawKeys = collectRawKeys(rawChar)
    const score = new Map<FinalCharacter, { s: number; bestKeyLen: number }>()

    for (const { key, weight } of rawKeys) {
      const bucket = index.get(key)
      if (!bucket) continue
      for (const cand of bucket) {
        const prev = score.get(cand) ?? { s: 0, bestKeyLen: 0 }
        const next = { s: prev.s + weight, bestKeyLen: Math.max(prev.bestKeyLen, key.length) }
        score.set(cand, next)
      }
    }

    if (score.size > 0) {
      let best: FinalCharacter | undefined
      let bestS = -1
      let bestLen = -1
      for (const [cand, v] of score.entries()) {
        if (v.s > bestS || (v.s === bestS && v.bestKeyLen > bestLen)) {
          best = cand
          bestS = v.s
          bestLen = v.bestKeyLen
        }
      }
      return best
    }

    let looseBest: { cand: FinalCharacter; hitLen: number } | undefined
    for (const { item, keys } of finalItemsWithKeys) {
      for (const a of keys) {
        for (const { key: b } of rawKeys) {
          if (!a || !b) continue
          if (containsLoose(a, b)) {
            const hitLen = Math.min(a.length, b.length)
            if (!looseBest || hitLen > looseBest.hitLen) {
              looseBest = { cand: item, hitLen }
            }
          }
        }
      }
    }
    return looseBest?.cand
  }

  return match
}
