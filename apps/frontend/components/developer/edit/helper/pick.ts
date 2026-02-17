import { DeveloperFields } from '@/interfaces/edit/permisson.interface'
import { DeveloperScalar } from '@/interfaces/edit/scalar.interface'

export const pick = (
  obj: DeveloperScalar,
  permissionFields: DeveloperFields,
): Partial<DeveloperScalar> => {
  const allowed = new Set(
    Object.keys(permissionFields).filter(k => permissionFields[k as keyof DeveloperFields]),
  )

  const result: Partial<DeveloperScalar> = {}
  for (const key of Object.keys(obj) as Array<keyof DeveloperScalar>) {
    if (allowed.has(key as string)) {
      ;(
        result as Record<keyof DeveloperScalar, DeveloperScalar[keyof DeveloperScalar] | undefined>
      )[key] = obj[key]
    }
  }

  return result
}
