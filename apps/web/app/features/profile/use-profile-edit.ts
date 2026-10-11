import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { ProfileEdit } from './profile.schema'
import type { profileEditAction } from './profile.server'

export function useProfileEdit() {
  const command = useCommand(
    useFetcher<typeof profileEditAction>(),
    href('/resources/profile/edit'),
    { multipart: true },
  )
  const save = (edit: ProfileEdit) => {
    const form = new FormData()
    for (const [field, value] of Object.entries(edit)) {
      if (value !== undefined) {
        form.append(field, value)
      }
    }
    return command.run(form)
  }
  return { save, failure: command.failure }
}
