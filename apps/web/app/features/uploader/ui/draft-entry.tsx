import { Link, Stack, Time } from '@hina-ui/react'
import { Clock, FileArchive, Gamepad2 } from 'lucide-react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gamePath, gameTitle } from '~/features/game'
import { CompositionDraft, CompositionTag } from '~/features/resource'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { Draft } from '../uploader'
import { EntryShell } from './entry-shell'
import { Fact } from './fact'
import { FileLine } from './file-line'
import { StageTag } from './stage-tag'

export function DraftEntry({ draft }: { draft: Draft }) {
  const t = useTranslations('uploader.list')
  const bytes = useBytes()
  const locale = useLocale()
  const { composition, game } = draft
  const { patch } = composition
  const named = composition.file_name !== ''
  return (
    <EntryShell
      as="article"
      files={
        <FileLine
          name={named ? composition.file_name : (patch?.name ?? composition.base.name)}
          size={
            named
              ? t('estimate', { size: bytes(composition.estimated_size) })
              : bytes(patch?.size ?? 0)
          }
          state={<CompositionTag status="draft" />}
        />
      }
      notice={
        <Stack className="col-span-2 ps-6">
          <CompositionDraft composition={composition} />
        </Stack>
      }
      stage={<StageTag stage="uploading" />}
      controlSlots={0}
      controls={null}
      facts={
        <>
          {game !== null && (
            <Fact icon={Gamepad2}>
              <Link asChild tone="neutral">
                <RouterLink to={gamePath(locale, game.id)}>{gameTitle(game, locale)}</RouterLink>
              </Link>
            </Fact>
          )}
          {patch !== null && <Fact icon={FileArchive}>{t('patch', { name: patch.name })}</Fact>}
          <Fact icon={Clock}>
            {t.rich('updated', {
              time: () => <Time value={composition.updated} format="relative" />,
            })}
          </Fact>
        </>
      }
    />
  )
}
