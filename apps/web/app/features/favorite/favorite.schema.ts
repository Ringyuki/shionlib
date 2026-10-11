import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

export const membershipChangeCommand = v.object({
  listId: id,
  gameId: id,
  included: v.boolean(),
  note: v.optional(v.string()),
})

export type MembershipChange = v.InferOutput<typeof membershipChangeCommand>

const listFields = { name: v.string(), description: v.string(), isPrivate: v.boolean() }

export const listCreationCommand = v.object({ gameId: v.optional(id), ...listFields })

export type ListCreation = v.InferOutput<typeof listCreationCommand>

export const listEditCommand = v.object({ listId: id, ...listFields })

export type ListEdit = v.InferOutput<typeof listEditCommand>

export const listRemovalCommand = v.object({ listId: id })

export type ListRemoval = v.InferOutput<typeof listRemovalCommand>

export function listForm(kit: FormKit) {
  return v.object({
    name: kit.text('CreateFavoriteInputBody', 'name'),
    description: kit.text('CreateFavoriteInputBody', 'description'),
    isPrivate: v.boolean(),
  })
}

export type ListValues = v.InferInput<ReturnType<typeof listForm>>
