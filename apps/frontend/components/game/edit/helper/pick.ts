import { GameFields } from '@/interfaces/edit/permisson.interface'
import { GameScalar } from '@/interfaces/edit/scalar.interface'

export const pick = (obj: GameScalar, permissionFields: GameFields): Partial<GameScalar> => {
  const allowed = new Set(
    Object.keys(permissionFields).filter(k => permissionFields[k as keyof GameFields]),
  )

  const result: Partial<GameScalar> = {}
  for (const key of Object.keys(obj) as Array<keyof GameScalar>) {
    if (allowed.has(key as string)) {
      ;(result as Record<keyof GameScalar, GameScalar[keyof GameScalar] | undefined>)[key] =
        obj[key]
    }
  }

  return result
}
