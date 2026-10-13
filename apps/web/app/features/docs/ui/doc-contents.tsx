import {
  Anchor,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DisclosureIcon,
  Stack,
  Text,
} from '@hina-ui/react'
import { useId } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { SideColumn } from '~/shared/ui/side-column'
import type { Section } from '../docs-content'
import { docColumns } from './doc-columns'

type ContentsProps = {
  sections: readonly Section[]
}

export function ContentsRail({ sections }: ContentsProps) {
  const t = useTranslations('docs')
  const title = useId()
  return (
    <SideColumn className={docColumns.rail}>
      <Stack as="aside" gap="sm" aria-labelledby={title}>
        <Text as="h2" id={title} size="sm" tone="muted" weight="medium">
          {t('contents')}
        </Text>
        <Anchor items={[...sections]} label={t('contents')} />
      </Stack>
    </SideColumn>
  )
}

export function ContentsFold({ sections }: ContentsProps) {
  const t = useTranslations('docs')
  return (
    <Card padded={false} className={docColumns.fold}>
      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            tone="neutral"
            icon={<DisclosureIcon direction="end" />}
            className="h-11 w-full justify-start"
          >
            {t('contents')}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Anchor items={[...sections]} label={t('contents')} className="px-3.5 pb-3" />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
