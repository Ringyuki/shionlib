import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'

export const assignCommand = v.object({
  id: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  manual: v.boolean(),
  pages: v.array(v.string()),
})

export type Assignment = v.InferOutput<typeof assignCommand>

export const lookupCommand = v.object({ address: v.string() })

export type Lookup = v.InferOutput<typeof lookupCommand>

export function addressForm(kit: FormKit) {
  return v.object({ address: kit.text('AdminPatchPageLookupInputBody', 'address') })
}

export type AddressValues = v.InferInput<ReturnType<typeof addressForm>>
