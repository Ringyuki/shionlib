import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  Inline,
  Stack,
  Text,
  useImageResolver,
} from '@hina-ui/react'
import { ChevronDown } from 'lucide-react'
import { useLocale, useMessages, useTranslations } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { walkthroughPath, type WalkthroughSummary } from '../walkthrough'

type GuidePickerProps = {
  gameId: number
  summaries: readonly WalkthroughSummary[]
  shown: WalkthroughSummary
}

export function GuidePicker({ gameId, summaries, shown }: GuidePickerProps) {
  const t = useTranslations('walkthrough')
  const languages = useMessages().walkthrough.language
  const locale = useLocale()
  const resolveImage = useImageResolver()
  const stay = useInPageNavigate()
  const picture = ({ creator }: WalkthroughSummary) =>
    creator.avatar === null ? undefined : resolveImage(creator.avatar, 'image')
  const facts = (summary: WalkthroughSummary) =>
    summary.lang === null
      ? t('summary', { count: summary.route_count, date: new Date(summary.updated) })
      : t('summaryIn', {
          language: labelOf(languages, summary.lang),
          count: summary.route_count,
          date: new Date(summary.updated),
        })
  return (
    <DropdownMenu
      label={t('label')}
      align="start"
      content={
        <DropdownMenuRadioGroup
          value={String(shown.id)}
          onValueChange={value => {
            const chosen = summaries.find(summary => String(summary.id) === value)
            if (chosen !== undefined && chosen.id !== shown.id) {
              stay(walkthroughPath(locale, gameId, chosen.id))
            }
          }}
        >
          {summaries.map(summary => (
            <DropdownMenuRadioItem
              key={summary.id}
              value={String(summary.id)}
              textValue={summary.creator.name}
            >
              <Inline as="span" gap="none" align="center" wrap={false} className="gap-2.5 py-1">
                <Avatar
                  name={summary.creator.name}
                  alt=""
                  src={picture(summary)}
                  className="size-7 text-xs"
                />
                <Stack as="span" gap="none" className="min-w-0">
                  <Text as="span" size="sm" weight="medium" className="text-inherit">
                    {summary.creator.name}
                  </Text>
                  <Text as="span" size="xs" tone="muted">
                    {facts(summary)}
                  </Text>
                </Stack>
              </Inline>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      }
    >
      <Button
        variant="outline"
        tone="neutral"
        size="sm"
        trailing={<ChevronDown />}
        className="h-9 max-w-full ps-1.5"
      >
        <Avatar size="sm" name={shown.creator.name} alt="" src={picture(shown)} />
        <Text as="span" size="sm" weight="medium" truncate className="text-inherit">
          {shown.creator.name}
        </Text>
      </Button>
    </DropdownMenu>
  )
}
