import { Alert, FormField, Inline, Listbox, Stack, Tag, Text } from '@hina-ui/react'
import { useMessages, useTranslations } from 'use-intl'
import type { GameHeader } from '~/features/game'
import { GamePicker } from '~/features/search'
import { labelOf } from '~/shared/i18n/labels'
import { useBytes } from '~/shared/i18n/use-bytes'
import { Button } from '~/shared/ui/button'
import { onlyDiscs, usableBases, type CompositionBase } from '../resource-composition'
import { editionText } from '../resource-info'
import { UploadGame } from './upload-game'

type CompositionBaseProps = {
  game: GameHeader | null
  bases: CompositionBase[]
  chosen: number | undefined
  onChoose: (resourceId: number) => void
  onGame: (gameId: number | undefined) => void
  onUpload: () => void
}

export function CompositionBaseStep({
  game,
  bases,
  chosen,
  onChoose,
  onGame,
  onUpload,
}: CompositionBaseProps) {
  const t = useTranslations('resource')
  const none = game !== null && usableBases(bases).length === 0
  return (
    <Stack gap="lg">
      <FormField name="game" label={t('composition.game')} required>
        {game === null ? (
          <GamePicker onPick={onGame} />
        ) : (
          <UploadGame game={game} onChange={() => onGame(undefined)} />
        )}
      </FormField>
      {game !== null && bases.length > 0 && (
        <FormField name="base" label={t('composition.base')} required>
          <Listbox
            aria-label={t('composition.base')}
            maxHeight="none"
            options={bases.map(base => ({
              value: base.resource_id,
              label: base.name,
              disabled: base.reason !== null,
              base,
            }))}
            value={chosen ?? null}
            onValueChange={value => {
              if (typeof value === 'number') {
                onChoose(value)
              }
            }}
            renderOption={({ option }) => <BaseOption base={option.base} />}
          />
        </FormField>
      )}
      <Alert
        tone="info"
        open={none}
        actions={
          <Button variant="outline" size="sm" onClick={onUpload}>
            {t('composition.noBase.upload')}
          </Button>
        }
      >
        {t(onlyDiscs(bases) ? 'composition.noBase.discs' : 'composition.noBase.other')}
      </Alert>
    </Stack>
  )
}

function BaseOption({ base }: { base: CompositionBase }) {
  const t = useTranslations('resource.composition')
  const labels = useMessages()
  const bytes = useBytes()
  const edition = editionText(base, value => labelOf(labels.resource.editionName, value))
  return (
    <Stack gap="xs" className="min-w-0 py-1">
      <Text weight="medium" className="break-all">
        {base.name}
      </Text>
      <Inline gap="xs" align="center" className="gap-y-1">
        {(base.language ?? []).map(language => (
          <Tag key={language} size="sm" variant="outline">
            {labelOf(labels.game.language, language)}
          </Tag>
        ))}
        {edition !== '' && <Tag size="sm">{edition}</Tag>}
        {base.form !== null && <Tag size="sm">{labelOf(labels.resource.formName, base.form)}</Tag>}
        <Text as="span" size="sm" tone="muted" className="tabular-nums">
          {t('baseMeta', {
            size: bytes(base.size),
            creator: base.creator.name,
            downloads: base.downloads,
          })}
        </Text>
      </Inline>
      {base.reason !== null && (
        <Text size="sm" tone="muted">
          {t(`unusable.${base.reason}`)}
        </Text>
      )}
    </Stack>
  )
}
