import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
  DrawerHeader,
} from '@/components/shionui/Drawer'
import { GameCharacterRelation } from '@/interfaces/game/game.interface'
import { useTranslations } from 'next-intl'
import { GameCharacterItemTrigger } from './GameCharacterItemTrigger'
import { GameCharacterItemContent } from './GameCharacterItemContent'

interface GameCharacterDrawerProps {
  character: GameCharacterRelation
  name: string
  excess_names: string[]
  intro: string
  extra_info: { key: string; value: string }[]
}

export const GameCharacterDrawer = ({
  character,
  name,
  excess_names,
  intro,
  extra_info,
}: GameCharacterDrawerProps) => {
  const t = useTranslations('Components.Game.Description.GameCharacterItem')

  return (
    <Drawer>
      <DrawerTrigger>
        <GameCharacterItemTrigger character={character} name={name} />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('characterDetailDialogTitle')}</DrawerTitle>
        </DrawerHeader>
        <GameCharacterItemContent
          character={character}
          name={name}
          excess_names={excess_names}
          intro={intro}
          extra_info={extra_info}
          className="overflow-auto px-4 pb-4"
        />
      </DrawerContent>
    </Drawer>
  )
}
