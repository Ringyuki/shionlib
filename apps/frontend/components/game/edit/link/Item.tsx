'use client'

import { GameLink } from '@/interfaces/game/game.interface'
import { Badge } from '@/components/shionui/Badge'
import { Link2 } from 'lucide-react'

interface LinkItemProps {
  link: GameLink
  onClick?: () => void
}

export const LinkItem = ({ link, onClick }: LinkItemProps) => {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-md border bg-background cursor-pointer hover:bg-muted/50 transition-colors group"
      onClick={onClick}
    >
      <Link2 className="size-4 text-muted-foreground shrink-0" />
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {link.label && (
            <Badge intent="secondary" appearance="outline" size="sm">
              {link.label}
            </Badge>
          )}
          <span className="text-sm font-medium truncate">{link.name}</span>
        </div>
        <span className="text-xs text-muted-foreground truncate">{link.url}</span>
      </div>
    </div>
  )
}
