import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { friendLinkLogoAction } from './admin-friend-link.server'

export function useLogoUpload() {
  const command = useCommand(
    useFetcher<typeof friendLinkLogoAction>(),
    href('/resources/admin/friend-links/logo'),
    { multipart: true, revalidate: false },
  )
  const upload = async (logo: File) => {
    const form = new FormData()
    form.append('logo', logo)
    const outcome = await command.run(form)
    return outcome.ok ? outcome.result : undefined
  }
  return { upload, uploading: command.pending }
}
