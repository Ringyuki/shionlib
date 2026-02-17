import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/shionui/Dialog'
import { GameCharacterRelation } from '@/interfaces/game/game.interface'
import { useTranslations } from 'next-intl'
import { GameCharacterItemTrigger } from './GameCharacterItemTrigger'
import { GameCharacterItemContent } from './GameCharacterItemContent'

interface GameCharacterDialogProps {
  character: GameCharacterRelation
  name: string
  excess_names: string[]
  intro: string
  extra_info: { key: string; value: string }[]
}

export const GameCharacterDialog = ({
  character,
  name,
  excess_names,
  intro,
  extra_info,
}: GameCharacterDialogProps) => {
  const t = useTranslations('Components.Game.Description.GameCharacterItem')

  return (
    <Dialog>
      <DialogTrigger>
        <GameCharacterItemTrigger character={character} name={name} />
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl"
      >
        <DialogTitle>{t('characterDetailDialogTitle')}</DialogTitle>
        <GameCharacterItemContent
          character={character}
          name={name}
          excess_names={excess_names}
          intro={intro}
          extra_info={extra_info}
        />
      </DialogContent>
    </Dialog>
  )
}
