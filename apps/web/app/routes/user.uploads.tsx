import { UploadList } from '~/features/profile'
import type { Route } from './+types/user.uploads'

export { uploadsLoader as loader } from '~/features/profile/profile.server'

export default function UserUploadsRoute({ loaderData }: Route.ComponentProps) {
  return <UploadList uploads={loaderData} />
}
