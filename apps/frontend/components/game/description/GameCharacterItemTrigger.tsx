import { GameCharacterRelation, GameCharacterRole } from '@/interfaces/game/game.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { AudioLines } from 'lucide-react'
import { Badge } from '@/components/shionui/Badge'
import { roleBadgeColorMap } from './helpers/roleBadgeColorMap'
import { useTranslations } from 'next-intl'

interface GameCharacterItemTriggerProps {
  character: GameCharacterRelation
  name: string
}

export const GameCharacterItemTrigger = ({ character, name }: GameCharacterItemTriggerProps) => {
  const t = useTranslations('Components.Game.Description.GameCharacterItem')
  const roleMap: { [key in GameCharacterRole]: string } = {
    main: t('roleMain'),
    primary: t('rolePrimary'),
    side: t('roleSide'),
    appears: t('roleAppears'),
  } as const
  return (
    <>
      <div className="relative rounded-md border-2 border-muted overflow-hidden w-full aspect-[3/4] cursor-pointer bg-card hover:opacity-80 transition-all duration-200">
        {character.character.image && (
          <FadeImage
            src={character.image || character.character.image}
            alt={name}
            aspectRatio="3 / 4"
            imageClassName="object-cover object-top"
          />
        )}
        <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
          {t('noImage')}
        </div>
        <div className="absolute bottom-0 h-1/3 sm:h-1/4 left-0 w-full bg-gradient-to-t from-black/60 to-transparent">
          <div className="w-full h-full flex flex-col gap-1 justify-end items-start p-2 text-white">
            <div className="font-bold">{name}</div>
            {character.actor && (
              <div className="text-sm flex items-center gap-1">
                <AudioLines className="size-3" />
                <span>{character.actor}</span>
              </div>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 p-2">
          {character.role && (
            <div className="text-sm flex items-center gap-1">
              <Badge className={roleBadgeColorMap[character.role]}>{roleMap[character.role]}</Badge>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
