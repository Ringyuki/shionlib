import { UploadPage } from '~/features/resource'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/upload'

export { uploadPageLoader as loader } from '~/features/resource/resource.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.resource.uploadTitle, indexable: false })
}

export default function Upload({ loaderData }: Route.ComponentProps) {
  return (
    <UploadPage
      game={loaderData.game}
      allowance={loaderData.allowance}
      mode={loaderData.mode}
      composer={loaderData.composer}
    />
  )
}
