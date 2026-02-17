import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/shionui/DropdownMenu'
import { Button } from '@/components/shionui/Button'
import { Ellipsis } from 'lucide-react'
import { Delete } from './Delete'
import { Edit } from './Edit'

interface MoreActionsProps {
  creator_id: number
  comment_id: number
  showDeleteBtn?: boolean
  showEditBtn?: boolean
  onEdited?: () => void
}

export const MoreActions = ({
  creator_id,
  comment_id,
  showDeleteBtn = true,
  showEditBtn = true,
  onEdited,
}: MoreActionsProps) => {
  return (
    (showDeleteBtn || showEditBtn) && (
      <DropdownMenu>
        <DropdownMenuTrigger suppressHydrationWarning asChild>
          <span>
            <Button intent="secondary" size="icon" appearance="ghost" renderIcon={<Ellipsis />} />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={e => e.stopPropagation()}>
          {showEditBtn && (
            <Edit creator_id={creator_id} comment_id={comment_id} onEdited={onEdited} />
          )}
          {showDeleteBtn && <Delete comment_id={comment_id} creator_id={creator_id} />}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  )
}
