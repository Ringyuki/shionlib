import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { ImageKind } from './admin-ad'
import type { adImageAction } from './admin-ad.server'

export function useImageUpload(kind: ImageKind) {
  const command = useCommand(
    useFetcher<typeof adImageAction>(),
    href('/resources/admin/ads/image'),
    {
      multipart: true,
      revalidate: false,
    },
  )
  const upload = async (image: File) => {
    const form = new FormData()
    form.append('kind', kind)
    form.append('image', image)
    const outcome = await command.run(form)
    return outcome.ok ? outcome.result : undefined
  }
  return { upload, uploading: command.pending }
}
