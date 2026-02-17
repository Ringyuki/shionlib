import { DeveloperRelation } from '@/interfaces/game/game.interface'
import { Button } from '@/components/shionui/Button'
import { Link } from '@/i18n/navigation'
import { Building2 } from 'lucide-react'

interface GameDeveloperProps {
  developers: DeveloperRelation[]
}

export const GameDeveloper = async ({ developers }: GameDeveloperProps) => {
  return (
    developers.length > 0 && (
      <div className="flex gap-2 items-center text-gray-500 font-light">
        <Building2 className="size-4" />
        {developers.map(d => (
          <Button
            key={d.developer.id}
            className="hover:text-primary p-0 pl-1 pr-1 h-auto"
            appearance="ghost"
            intent="neutral"
            size="sm"
          >
            <Link href={`/developer/${d.developer.id}`}>
              {d.developer.name || d.developer.aliases?.[0]}
            </Link>
          </Button>
        ))}
      </div>
    )
  )
}
