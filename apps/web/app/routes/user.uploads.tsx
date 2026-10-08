import { redirect } from 'react-router'
import { UploadList, lastPage, loadUploads, uploadsSearch } from '~/features/profile'
import { idParam, pageParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/user.uploads'

export async function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  const url = new URL(args.request.url)
  const page = pageParam(url.searchParams.get('page'))
  const uploads = await routeLoader(args, api => loadUploads(api, id, page))
  if (page > lastPage(uploads.total)) {
    throw redirect(`${url.pathname}${uploadsSearch(lastPage(uploads.total))}`)
  }
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
