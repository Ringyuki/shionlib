import { UploadPage } from '~/features/resource'
import type { Route } from './+types/upload'

export { uploadPageLoader as loader } from '~/features/resource/resource.server'

export default function Upload({ loaderData }: Route.ComponentProps) {
  return <UploadPage game={loaderData.game} allowance={loaderData.allowance} />
}
