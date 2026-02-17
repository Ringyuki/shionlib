'use client'

import { GameCharacterRelation, GameCharacterGenderMap } from '@/interfaces/game/game.interface'
import { getPreferredCharacterContent } from './helpers/getPreferredContent'
import { useLocale } from 'next-intl'
import { GameCharacterDialog } from './GameCharacterDialog'
import { GameCharacterDrawer } from './GameCharacterDrawer'
import { useMedia } from 'react-use'

interface GameCharacterItemProps {
  character: GameCharacterRelation
}

export const GameCharacterItem = ({ character }: GameCharacterItemProps) => {
  const locale = useLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const isMobile = useMedia('(max-width: 1024px)', false)

  const { name } = getPreferredCharacterContent(character.character, 'name', lang)
  const all_names = [
    character.character.name_jp,
    character.character.name_zh,
    character.character.name_en,
  ]
  const excess_names = all_names.filter(t => t !== name).filter(t => !!t)
  const { intro } = getPreferredCharacterContent(character.character, 'intro', lang)

  const extra_info_actual = [
    { key: 'gender', value: GameCharacterGenderMap[character.character.gender?.[0] ?? 'a'] },
    { key: 'blood_type', value: character.character.blood_type },
    { key: 'height', value: character.character.height },
    { key: 'weight', value: character.character.weight },
    { key: 'bust', value: character.character.bust },
    { key: 'waist', value: character.character.waist },
    { key: 'hips', value: character.character.hips },
    { key: 'cup', value: character.character.cup },
    { key: 'age', value: character.character.age },
    { key: 'birthday', value: character.character.birthday.join('/') },
  ]
  const extra_info = extra_info_actual
    .map(info => ({
      key: info.key,
      value: info.value,
    }))
    .filter(info => !!info.value)

  return isMobile ? (
    <GameCharacterDrawer
      character={character}
      name={name}
      excess_names={excess_names as string[]}
      intro={intro}
      extra_info={extra_info as { key: string; value: string }[]}
    />
  ) : (
    <GameCharacterDialog
      character={character}
      name={name}
      excess_names={excess_names as string[]}
      intro={intro}
      extra_info={extra_info as { key: string; value: string }[]}
    />
  )
}
