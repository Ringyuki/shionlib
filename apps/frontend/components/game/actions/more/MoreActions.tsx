import { Button } from '@/components/shionui/Button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shionui/Tooltip'
import { useTranslations } from 'next-intl'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/shionui/DropdownMenu'
import { AddToRecentUpdate } from './AddToRecentUpdate'
import { RemoveFromRecentUpdate } from './RemoveFromRecentUpdate'

interface MoreActionsProps {
  game_id: number
}

export const MoreActions = ({ game_id }: MoreActionsProps) => {
  const t = useTranslations('Components.Game.Actions.More.MoreActions')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              intent="neutral"
              appearance="ghost"
              renderIcon={<MoreHorizontal />}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <AddToRecentUpdate game_id={game_id} />
            <RemoveFromRecentUpdate game_id={game_id} />
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipTrigger>
      <TooltipContent>
        <span>{t('more')}</span>
      </TooltipContent>
    </Tooltip>
  )
}
