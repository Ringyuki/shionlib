import { UploadList, loadUploads, uploadsPageSize } from '~/features/profile'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/user.uploads'

export async function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  const page = requestedPage(args.request)
  const uploads = await routeLoader(args, api => loadUploads(api, id, page))
  keepWithinPages(args.request, uploads.total, uploadsPageSize)
  return uploads
}

export default function UserUploadsRoute({ loaderData, matches }: Route.ComponentProps) {
  const [, , site, , user] = matches
  return (
    <UploadList
      uploads={loaderData}
      own={site.loaderData.viewer?.id === user.loaderData.profile.id}
    />
  )
}
