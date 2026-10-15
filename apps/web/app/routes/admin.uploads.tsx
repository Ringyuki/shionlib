import { UploadsPage } from '~/features/admin-upload'
import type { Route } from './+types/admin.uploads'
import { pageMeta } from '~/shared/seo/seo'

export { uploadsLoader as loader } from '~/features/admin-upload/admin-upload.server'

export function meta(args: Route.MetaArgs) {
  const [, , , , admin] = args.matches
  return pageMeta(args, {
    title: admin.loaderData.messages.adminUpload.title,
    indexable: false,
  })
}

export default function AdminUploads({ loaderData }: Route.ComponentProps) {
  return <UploadsPage {...loaderData} />
}
