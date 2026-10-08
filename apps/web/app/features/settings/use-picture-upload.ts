import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { avatarAction, coverAction } from './settings.server'

const actions = {
  avatar: href('/resources/settings/avatar'),
  cover: href('/resources/settings/cover'),
} as const

export function usePictureUpload(kind: keyof typeof actions) {
  const command = useCommand(
    useFetcher<typeof avatarAction | typeof coverAction>(),
    actions[kind],
    { multipart: true },
  )
  const upload = (file: File) => {
    const form = new FormData()
    form.append(kind, file)
    return command.run(form)
  }
  return { upload, pending: command.pending }
}
