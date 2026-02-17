import { GameResourcesItem } from '@/interfaces/user/uploads.interface'
import { ResourceItem } from './ResourceItem'
import { ContentLimit } from '@/interfaces/user/user.interface'
import { OnGoing } from './OnGoing'

interface UploadsContentProps {
  resources: GameResourcesItem[]
  content_limit?: ContentLimit
  is_current_user?: boolean
  has_on_going_session?: boolean
}

export const UploadsContent = ({
  resources,
  content_limit,
  is_current_user,
  has_on_going_session,
}: UploadsContentProps) => {
  return (
    <div className="flex flex-col gap-6">
      {is_current_user && has_on_going_session && <OnGoing />}
      {resources.map(resource => (
        <ResourceItem key={resource.id} resource={resource} content_limit={content_limit} />
      ))}
    </div>
  )
}
