import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

export const keyCommand = v.variant('action', [
  v.object({ action: v.literal('create'), name: v.string() }),
  v.object({ action: v.literal('remove'), id }),
])

export type KeyChange = v.InferOutput<typeof keyCommand>

export function keyForm(kit: FormKit) {
  return v.object({ name: kit.text('CreateKeyInputBody', 'name') })
}

export type KeyValues = v.InferInput<ReturnType<typeof keyForm>>
