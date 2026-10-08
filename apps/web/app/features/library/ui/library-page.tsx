import { Card, Grid, Heading, Inline, PageHeader, Stack } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { conditionsOf, type LibraryContent } from '../library'
import { useLibraryAddress } from '../use-library-address'
import { FilterSheet } from './filter-sheet'
import { LibraryFilters } from './library-filters'
import { LibraryList } from './library-list'

type LibraryPageProps = {
  content: LibraryContent
  filtered: boolean
}

export function LibraryPage({ content, filtered }: LibraryPageProps) {
  const t = useTranslations('library')
  const controls = useLibraryAddress(content)
  const [sheetOpen, setSheetOpen] = useState(false)
  const conditions = conditionsOf(controls.shown, filtered)
  return (
    <Stack gap="lg">
      <PageHeader title={t('title')} />
      <Grid className="items-start gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <LibraryList
          content={content}
          shown={controls.shown}
          conditions={conditions}
          controls={controls}
          filtered={filtered}
          onOpenFilters={() => setSheetOpen(true)}
        />
        <Card
          as="aside"
          aria-labelledby="library-filters"
          className="max-xl:hidden xl:sticky xl:top-6"
        >
          <Stack gap="md">
            <Inline align="center" justify="between" wrap={false}>
              <Heading id="library-filters" level={2} size="sm" weight="semibold">
                {t('filters.title')}
              </Heading>
              <Button
                size="sm"
                variant="link"
                disabled={conditions.length === 0}
                onClick={controls.reset}
              >
                {t('filters.reset')}
              </Button>
            </Inline>
            <LibraryFilters
              address={controls.shown}
              years={content.years}
              filtered={filtered}
              onChange={controls.narrow}
            />
          </Stack>
        </Card>
      </Grid>
      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        address={controls.shown}
        years={content.years}
        filtered={filtered}
        total={content.total}
        resettable={conditions.length > 0}
        onChange={controls.narrow}
        onReset={controls.reset}
      />
    </Stack>
  )
}
