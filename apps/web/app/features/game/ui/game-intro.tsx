import { Section, SegmentedControl, Text } from '@hina-ui/react'
import { useState } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { introIn, writtenIntros, type GameDetails, type IntroLanguage } from '../game'
import { introLanguageFrom } from '../game.schema'

export function GameIntro({ details }: { details: GameDetails }) {
  const t = useTranslations('game')
  const locale = useLocale()
  const written = writtenIntros(details, locale)
  const [chosen, setChosen] = useState<IntroLanguage | undefined>(undefined)
  const language = chosen !== undefined && written.includes(chosen) ? chosen : written[0]
  const choose = (value: string | number) => setChosen(introLanguageFrom(value))
  return (
    <Section title={t('info.intro')}>
      {written.length > 1 && language !== undefined && (
        <SegmentedControl
          aria-label={t('info.introLanguage')}
          size="sm"
          value={language}
          onValueChange={choose}
          options={written.map(value => ({ value, label: t(`introLanguage.${value}`) }))}
          className="self-start"
        />
      )}
      {language === undefined ? (
        <Text tone="muted">{t('info.noIntro')}</Text>
      ) : (
        <BBCodeText source={introIn(details, language)} />
      )}
    </Section>
  )
}
