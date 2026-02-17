import { GameDetail as GameDetailType } from '@/interfaces/game/game.interface'
import { BookOpenText } from 'lucide-react'
import { getPreferredContent } from './helpers/getPreferredContent'
import { useTranslations, useLocale } from 'next-intl'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
} from '@/components/shionui/Select'
import { useEffect, useState } from 'react'
import { BBCodeContent } from '@/components/common/content/BBCode'

interface GameDescriptionProps {
  game: GameDetailType
}

export const GameDescription = ({ game }: GameDescriptionProps) => {
  const t = useTranslations('Components.Game.Description.GameDetail')
  const locale = useLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'

  const { intro, language, disable_languages } = getPreferredContent(game, 'intro', lang)

  const [selectedIntroLanguage, setSelectedIntroLanguage] = useState(language)
  const [selectedIntro, setSelectedIntro] = useState(intro)

  useEffect(() => {
    setSelectedIntro(game[`intro_${selectedIntroLanguage}` as keyof GameDetailType] as string)
  }, [selectedIntroLanguage, game])

  return (
    <>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <BookOpenText />
        <span>{t('introduction')}</span>
        <Select onValueChange={setSelectedIntroLanguage} value={selectedIntroLanguage}>
          <SelectTrigger className="font-normal font-mono! text-xs ml-2">
            <SelectValue placeholder={t('introduction')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('chooseLanguage')}</SelectLabel>
              <SelectItem value="jp" disabled={disable_languages.includes('jp')}>
                日本語
              </SelectItem>
              <SelectItem value="zh" disabled={disable_languages.includes('zh')}>
                简体中文
              </SelectItem>
              <SelectItem value="en" disabled={disable_languages.includes('en')}>
                English
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </h2>
      <BBCodeContent content={selectedIntro} className="text-sm break-words" />
    </>
  )
}
