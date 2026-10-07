import { Carousel, IconButton, Inline, Stack, Text } from '@hina-ui/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'use-intl'
import { GameTile, type GameSummary } from '~/features/game'
import { sitePaths } from '~/features/shell'
import type { Block } from '../home'
import { useCarouselArrows } from '../use-carousel-arrows'
import { BlockFailure } from './block-failure'
import { SectionHeader } from './section-header'

export function MonthReleases({ month, block }: { month: number; block: Block<GameSummary[]> }) {
  const t = useTranslations('home')
  const locale = useLocale()
  const format = useFormatter()
  const { carousel, canPrev, canNext, follow, prev, next } = useCarouselArrows()
  const title = t('releases', {
    month: format.dateTime(new Date(Date.UTC(2000, month - 1, 1)), {
      month: 'long',
      timeZone: 'UTC',
    }),
  })
  return (
    <Stack as="section" gap="md">
      <SectionHeader
        heading={title}
        controls={
          (canPrev || canNext) && (
            <Inline gap="xs" align="center" wrap={false}>
              <IconButton
                variant="soft"
                size="sm"
                pill
                label={t('previous')}
                disabled={!canPrev}
                onClick={prev}
              >
                <ChevronLeft />
              </IconButton>
              <IconButton
                variant="soft"
                size="sm"
                pill
                label={t('next')}
                disabled={!canNext}
                onClick={next}
              >
                <ChevronRight />
              </IconButton>
            </Inline>
          )
        }
        more={{ label: t('allReleases'), to: sitePaths(locale).releases }}
      />
      {!block.ok ? (
        <BlockFailure />
      ) : block.data.length === 0 ? (
        <Text tone="muted">{t('noReleases')}</Text>
      ) : (
        <Carousel
          ref={carousel}
          arrows={false}
          onReady={follow}
          onSelect={follow}
          items={block.data}
          getKey={game => game.id}
          slidesToScroll="auto"
          gap="md"
          itemClass="basis-36 sm:basis-40"
          label={title}
        >
          {({ item }) => <GameTile game={item} dated="day" />}
        </Carousel>
      )}
    </Stack>
  )
}
