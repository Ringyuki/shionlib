import { Grid, Stack } from '@hina-ui/react'
import type { Doc, DocLink } from '../docs'
import { DocShelf } from './doc-shelf'
import { DocView } from './doc-view'

type DocPageProps = {
  doc: Doc
  shelf: readonly DocLink[]
  previous: DocLink | undefined
  next: DocLink | undefined
}

export function DocPage({ doc, shelf, previous, next }: DocPageProps) {
  return (
    <Stack className="@container">
      <Grid className="items-start gap-6 @3xl:grid-cols-[14rem_minmax(0,1fr)] @3xl:gap-8 @5xl:grid-cols-[14rem_minmax(0,1fr)_11rem]">
        <DocShelf shelf={shelf} current={doc} />
        <DocView doc={doc} previous={previous} next={next} />
      </Grid>
    </Stack>
  )
}
