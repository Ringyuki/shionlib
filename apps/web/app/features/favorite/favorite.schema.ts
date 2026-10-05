import * as v from 'valibot'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

export const membershipChangeCommand = v.object({ listId: id, gameId: id, included: v.boolean() })

export type MembershipChange = v.InferOutput<typeof membershipChangeCommand>
