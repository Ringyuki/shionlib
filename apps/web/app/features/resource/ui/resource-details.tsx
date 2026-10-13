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
import type { Resource, ResourceFile } from '../resource'
import { fileGroups, type FileGroup } from '../resource-page'
import { FileFacts } from './file-facts'
import { InfoFacts } from './info-facts'

type ResourceDetailsProps = {
  resource: Resource
  inspections: readonly Inspection[]
}

export function ResourceDetails({ resource, inspections }: ResourceDetailsProps) {
  const [lead = { files: [], inspection: undefined }, ...rest] = fileGroups(
    resource.files ?? [],
    inspections,
  )
  return (
    <Stack gap="xl">
      <LeadFacts resource={resource} group={lead} />
      {rest.map(group => (
        <Fragment key={group.files[0]?.id}>
          <Divider />
          <GroupFacts group={group} />
        </Fragment>
      ))}
    </Stack>
  )
}

function discsIn(inspection: Inspection | undefined): boolean {
  return (inspection?.discs ?? []).length > 0
}

function FilesPart({ files }: { files: readonly ResourceFile[] }) {
  const t = useTranslations('resource.page.details')
  return (
    <FactsPart heading={t('file')}>
      <Stack gap="lg">
        {files.map(file => (
          <FileFacts key={file.id} file={file} />
        ))}
      </Stack>
    </FactsPart>
  )
}

function LeadFacts({ resource, group }: { resource: Resource; group: FileGroup }) {
  const { files, inspection } = group
  return (
    <Grid className="items-start gap-x-12 gap-y-8 md:grid-cols-2 md:grid-rows-[auto_1fr]">
      <InfoFacts resource={resource} />
      <Stack gap="xl" className="md:row-span-2">
        {files.length > 0 && <FilesPart files={files} />}
        <ArchiveSection inspection={inspection} />
        <CheckSection inspection={inspection} earlier={earlierCheck(files)} />
      </Stack>
      {discsIn(inspection) && (
        <Stack gap="xl" className="md:col-start-1">
          <DiscSections inspection={inspection} />
        </Stack>
      )}
    </Grid>
  )
}

function GroupFacts({ group: { files, inspection } }: { group: FileGroup }) {
  const withDiscs = discsIn(inspection)
  const check = <CheckSection inspection={inspection} earlier={earlierCheck(files)} />
  return (
    <Grid className="items-start gap-x-12 gap-y-8 md:grid-cols-2">
      <Stack gap="xl">
        <FilesPart files={files} />
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
