import { Alert, Empty, Grid, Spinner, Stack, Text } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import type { Composition, InputPhase } from '../resource-composition'
import type { CompositionEdit } from '../resource-composition.schema'
import { CompositionChanges } from './composition-changes'
import { CompositionFolder } from './composition-folder'

type CompositionFilesProps = {
  composition: Composition
  patch: InputPhase
  pending: boolean
  onPlace: (placement: Pick<CompositionEdit, 'gameDir' | 'patchDir'>) => Promise<boolean>
}

export function CompositionFilesStep({
  composition,
  patch,
  pending,
  onPlace,
}: CompositionFilesProps) {
  const t = useTranslations('resource.composition')
  const [opened, setOpened] = useState<'game' | 'patch' | undefined>(undefined)
  const { plan } = composition
  if (plan === null || patch.name !== 'ready') {
    return (
      <Empty
        icon={<Spinner />}
        title={t(patch.name === 'uploading' ? 'uploadingPatch' : 'readingPatch')}
      />
    )
  }
  const conflicts = plan.conflicts ?? []
  const openWhen = (which: 'game' | 'patch') => (open: boolean) =>
    setOpened(open ? which : undefined)
  return (
    <Stack gap="lg">
      <Grid gap="md" className="sm:grid-cols-2">
        <CompositionFolder
          label={t('gameDir')}
          heading={t('chooseGameDir')}
          hint={t('gameDirHint')}
          path={plan.game_dir}
          dirs={plan.game_dirs}
          open={opened === 'game'}
          pending={pending}
          onOpenChange={openWhen('game')}
          onPick={gameDir => onPlace({ gameDir })}
        />
        <CompositionFolder
          label={t('patchDir')}
          heading={t('choosePatchDir')}
          hint={t('patchDirHint')}
          path={plan.patch_dir}
          dirs={plan.patch_dirs}
          open={opened === 'patch'}
          pending={pending}
          onOpenChange={openWhen('patch')}
          onPick={patchDir => onPlace({ patchDir })}
        />
      </Grid>
      <Alert tone="danger" open={conflicts.length > 0}>
        <Stack gap="xs">
          <Text as="span">{t('conflicts')}</Text>
          {conflicts.slice(0, 5).map(path => (
            <Text key={path} as="span" size="sm" className="break-all">
              {path}
            </Text>
          ))}
        </Stack>
      </Alert>
      <Alert
        tone="warning"
        open={conflicts.length === 0 && plan.adds.files + plan.replaces.files === 0}
      >
        {t('nothing')}
      </Alert>
      <CompositionChanges plan={plan} />
    </Stack>
  )
}
