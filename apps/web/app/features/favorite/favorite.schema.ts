import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

export const membershipChangeCommand = v.object({ listId: id, gameId: id, included: v.boolean() })

export type MembershipChange = v.InferOutput<typeof membershipChangeCommand>

export const listCreationCommand = v.object({
  gameId: id,
  name: v.string(),
  description: v.string(),
  isPrivate: v.boolean(),
})

export type ListCreation = v.InferOutput<typeof listCreationCommand>

export function listCreationForm(kit: FormKit) {
  return v.object({
    name: kit.text('CreateFavoriteInputBody', 'name'),
    description: kit.text('CreateFavoriteInputBody', 'description'),
    isPrivate: v.boolean(),
  })
}

export type ListCreationValues = v.InferInput<ReturnType<typeof listCreationForm>>
