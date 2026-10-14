import * as v from 'valibot'
import type { FormKit } from '~/shared/form/form-kit'

const id = v.pipe(v.number(), v.safeInteger(), v.minValue(1))

const fields = {
  name: v.string(),
  url: v.string(),
  description: v.string(),
  logo: v.nullable(v.string()),
  visible: v.boolean(),
}

export const linkCommand = v.variant('action', [
  v.object({ action: v.literal('create'), ...fields }),
  v.object({ action: v.literal('update'), id, ...fields }),
  v.object({ action: v.literal('visible'), id, visible: v.boolean() }),
  v.object({ action: v.literal('remove'), id }),
  v.object({ action: v.literal('reorder'), ids: v.array(id) }),
])

export type LinkChange = v.InferOutput<typeof linkCommand>

export const logoCommand = v.object({ logo: v.instance(File) })

export function linkForm(kit: FormKit) {
  return v.object({
    name: kit.text('CreateFriendLinkInputBody', 'name'),
    url: kit.text('CreateFriendLinkInputBody', 'url'),
    description: kit.text('CreateFriendLinkInputBody', 'description'),
  })
}
