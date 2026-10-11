import { Button, Inline, Stack, Text, Tree } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import type { Contents } from '../inspection'
import type { Opened } from '../inspection-preview'
import { useEntryTree } from '../use-entry-tree'
import { EntryFacts } from './entry-facts'
import { EntryLoader } from './entry-loader'
import { EntryName } from './entry-name'

type EntryTreeProps = {
  contents: Contents
  onOpen: (opened: Opened) => void
}

export function EntryTree({ contents, onOpen }: EntryTreeProps) {
  const t = useTranslations('inspection.contents')
  const format = useFormatter()
  const tree = useEntryTree(contents, onOpen)
  return (
    <Stack gap="xs">
      <Inline
        gap="sm"
        align="center"
        wrap={false}
        className="border-line border-b py-1.5 ps-8.5 pe-2.5"
        aria-hidden="true"
      >
        <Text as="span" size="xs" tone="faint" className="min-w-0 flex-1">
          {t('name')}
        </Text>
        <Text as="span" size="xs" tone="faint" className="w-22 text-end">
          {t('size')}
        </Text>
        <Text as="span" size="xs" tone="faint" className="w-26 text-end max-sm:hidden">
          {t('modified')}
        </Text>
      </Inline>
      <Tree
        aria-label={t('label')}
        items={tree.items}
        value={null}
        onValueChange={value => {
          if (typeof value === 'number' || typeof value === 'string') {
            tree.choose(value)
          }
        }}
        expanded={tree.expanded}
        onExpandedChange={tree.setExpanded}
        renderNode={({ node, expanded }) => {
          const meaning = tree.meaning(node.value)
          if (meaning?.kind === 'entry') {
            return <EntryName entry={meaning.entry} open={expanded} query={contents.view.query} />
          }
          if (meaning?.kind === 'loading') {
            return (
              <EntryLoader view={contents.view} place={meaning.place} onLoaded={tree.deliver} />
            )
          }
          if (meaning?.kind === 'more') {
            return (
              <Button size="sm" variant="outline" tone="neutral">
                {t('more', { count: format.number(meaning.left) })}
              </Button>
            )
          }
          return null
        }}
        renderTrailing={({ node }) => {
          const meaning = tree.meaning(node.value)
          return meaning?.kind === 'entry' ? <EntryFacts entry={meaning.entry} /> : null
        }}
      />
    </Stack>
  )
}
