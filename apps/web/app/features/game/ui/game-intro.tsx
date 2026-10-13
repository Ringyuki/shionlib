import {
  Button,
  DropdownMenu,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  Heading,
  Inline,
  Section,
  Text,
} from '@hina-ui/react'
import { ChevronDown, Languages } from 'lucide-react'
import { useId, useState } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { BBCodeText } from '~/shared/ui/bbcode-text'
import { flushEnd } from '~/shared/ui/flush'
import { introIn, writtenIntros, type GameDetails, type IntroLanguage } from '../game'
import { introLanguageFrom } from '../game.schema'

export function GameIntro({ details }: { details: GameDetails }) {
  const t = useTranslations('game')
  const locale = useLocale()
  const heading = useId()
  const written = writtenIntros(details, locale)
  const [chosen, setChosen] = useState<IntroLanguage | undefined>(undefined)
  const language = chosen !== undefined && written.includes(chosen) ? chosen : written[0]
  return (
    <Section aria-labelledby={heading}>
      <Inline justify="between" align="center" gap="sm">
        <Heading level={2} id={heading}>
          {t('info.intro')}
        </Heading>
        {written.length > 1 && language !== undefined && (
          <DropdownMenu
            label={t('info.introLanguage')}
            content={
              <DropdownMenuRadioGroup
                value={language}
                onValueChange={value => setChosen(introLanguageFrom(value))}
              >
                {written.map(value => (
                  <DropdownMenuRadioItem key={value} value={value}>
                    {t(`introLanguage.${value}`)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            }
          >
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              icon={<Languages />}
              trailing={<ChevronDown />}
              className={flushEnd.sm}
            >
              {t(`introLanguage.${language}`)}
            </Button>
          </DropdownMenu>
        )}
      </Inline>
      {language === undefined ? (
        <Text tone="muted">{t('info.noIntro')}</Text>
      ) : (
        <BBCodeText source={introIn(details, language)} />
      )}
    </Section>
  )
}
