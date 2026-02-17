import { RelationChanges, ScalarChanges } from '../interfaces/undo.interface'

export const extractRelationId = (
  changes: RelationChanges | ScalarChanges | null | undefined,
): number[] => {
  if (!changes || (changes as any).relation === undefined) return []
  const c = changes as RelationChanges
  const pool = [c.before, c.after, c.added, c.removed].filter(Boolean) as any[][]
  console.log('pool', pool)
  const ids: number[] = []
  for (const arr of pool) {
    console.log('arr', arr)
    for (const item of arr) if (typeof item?.id === 'number') ids.push(item.id)
  }
  return Array.from(new Set(ids))
}

export const extractRelationKey = (
  changes: RelationChanges | ScalarChanges | null | undefined,
): string[] => {
  if (!changes || (changes as any).relation === undefined) return []
  const c = changes as RelationChanges
  const pool = [c.before, c.after, c.added, c.removed].filter(Boolean) as any[][]
  const keys: string[] = []
  for (const arr of pool) {
    for (const item of arr) {
      if (typeof item?.id === 'number') {
        keys.push(`id:${item.id}`)
      } else if (c.relation === 'links') {
        keys.push(`link:${item?.url ?? ''}|${item?.label ?? ''}|${item?.name ?? ''}`)
      } else if (c.relation === 'covers') {
        keys.push(
          `cover:${item?.url ?? ''}|${item?.type ?? ''}|${JSON.stringify(item?.dims ?? null)}`,
        )
      } else {
        keys.push(JSON.stringify(item ?? null))
      }
    }
  }
  return Array.from(new Set(keys))
}
