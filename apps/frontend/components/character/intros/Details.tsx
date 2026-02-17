import { GameCharacter } from '@/interfaces/game/game.interface'
import { getTranslations, getLocale } from 'next-intl/server'
import { getPreferredCharacterContent } from '@/components/game/description/helpers/getPreferredContent'
import { BBCodeContent } from '@/components/common/content/BBCode'

interface DetailsProps {
  character: GameCharacter
}

export const Details = async ({ character }: DetailsProps) => {
  const t = await getTranslations('Components.Character.Intros.Details')
  const locale = await getLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { intro } = getPreferredCharacterContent(character, 'intro', lang)

  return (
    <div className="flex flex-col gap-2">
      <BBCodeContent content={intro || t('no_intro')} className="text-sm break-words" />
    </div>
  )
}
