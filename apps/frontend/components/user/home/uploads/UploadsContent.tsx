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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {is_current_user && has_on_going_session && (
        <div className="md:col-span-2">
          <OnGoing />
        </div>
      )}
      {resources.map(resource => (
        <ResourceItem key={resource.id} resource={resource} content_limit={content_limit} />
      ))}
    </div>
  )
}
