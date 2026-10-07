import { toast } from '@hina-ui/react'
import { useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle, type GameHeader } from '~/features/game'
import { sitePaths } from '~/features/shell'
import { useUploadManager, type UploadTarget } from '~/features/upload'
import { resourceDraft, type Resource, type ResourceFile } from './resource'
import type { UploadValues } from './resource.schema'

export function useStartUpload() {
  const t = useTranslations('resource')
  const locale = useLocale()
  const navigate = useNavigate()
  const manager = useUploadManager()
  const start = (target: UploadTarget, label: string, files: readonly File[]) => {
    manager?.add(
      target,
      label,
      files.map(file => ({ file })),
    )
  }
  const announce = (target: UploadTarget, label: string, files: readonly File[]) => {
    start(target, label, files)
    toast.success(t('uploadStarted'))
  }
  return {
    create(game: GameHeader, values: UploadValues) {
      const target = { kind: 'create', gameId: game.id, resource: resourceDraft(values) } as const
      start(target, gameTitle(game, locale), values.files)
      void navigate(sitePaths(locale).uploading)
    },
    append(resource: Resource, files: readonly File[]) {
      announce(
        { kind: 'append', resourceId: resource.id },
        resource.files?.[0]?.file_name ?? '',
        files,
      )
    },
    replace(file: ResourceFile, replacement: File, reason: string) {
      const trimmed = reason.trim()
      const target = {
        kind: 'replace',
        fileId: file.id,
        ...(trimmed === '' ? {} : { reason: trimmed }),
      } as const
      announce(target, file.file_name, [replacement])
    },
  }
}
