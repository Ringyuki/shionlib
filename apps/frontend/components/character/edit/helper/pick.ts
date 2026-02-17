import { CharacterFields } from '@/interfaces/edit/permisson.interface'
import { CharacterScalar } from '@/interfaces/character/character-scalar.interface'

export const pick = (
  obj: CharacterScalar,
  permissionFields: CharacterFields,
): Partial<CharacterScalar> => {
  const allowed = new Set(
    Object.keys(permissionFields).filter(k => permissionFields[k as keyof CharacterFields]),
  )

  const result: Partial<CharacterScalar> = {}
  for (const key of Object.keys(obj) as Array<keyof CharacterScalar>) {
    if (allowed.has(key as string)) {
      ;(
        result as Record<keyof CharacterScalar, CharacterScalar[keyof CharacterScalar] | undefined>
      )[key] = obj[key]
    }
  }

  return result
}
