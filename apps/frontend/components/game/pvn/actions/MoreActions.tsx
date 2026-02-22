'use client'

import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/shionui/DropdownMenu'
import { GamePVNRemove } from './Remove'

interface GamePVNMoreActionsProps {
  gameId: number
  onRemoved: () => void
}

export const GamePVNMoreActions = ({ gameId, onRemoved }: GamePVNMoreActionsProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          className="size-8"
          intent="neutral"
          appearance="ghost"
          renderIcon={<MoreHorizontal />}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <GamePVNRemove gameId={gameId} onRemoved={onRemoved} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
