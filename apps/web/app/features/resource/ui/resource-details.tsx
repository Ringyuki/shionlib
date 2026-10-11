import { Divider, Grid, Stack } from '@hina-ui/react'
import { Fragment } from 'react'
import { useTranslations } from 'use-intl'
import {
  ArchiveSection,
  CheckSection,
  DiscSections,
  FactsPart,
  earlierCheck,
  type Inspection,
} from '~/features/inspection'
import type { Resource } from '../resource'
import { fileGroups, type FileGroup } from '../resource-page'
import { FileFacts } from './file-facts'

type ResourceDetailsProps = {
  resource: Resource
  inspections: readonly Inspection[]
}

export function ResourceDetails({ resource, inspections }: ResourceDetailsProps) {
  return (
    <Stack gap="xl">
      {fileGroups(resource.files ?? [], inspections).map((group, index) => (
        <Fragment key={group.files[0]?.id}>
          {index > 0 && <Divider />}
          <GroupFacts group={group} />
        </Fragment>
      ))}
    </Stack>
  )
}

function GroupFacts({ group: { files, inspection } }: { group: FileGroup }) {
  const t = useTranslations('resource.page.details')
  const withDiscs = (inspection?.discs ?? []).length > 0
  const check = <CheckSection inspection={inspection} earlier={earlierCheck(files)} />
  return (
    <Grid className="items-start gap-x-12 gap-y-8 md:grid-cols-2">
      <Stack gap="xl">
        <FactsPart heading={t('file')}>
          <Stack gap="lg">
            {files.map(file => (
              <FileFacts key={file.id} file={file} />
            ))}
          </Stack>
        </FactsPart>
        <ArchiveSection inspection={inspection} />
        {withDiscs && check}
      </Stack>
      <Stack gap="xl">
        {!withDiscs && check}
        <DiscSections inspection={inspection} />
      </Stack>
    </Grid>
  )
}
