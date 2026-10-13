import { Image, Inline, Stack, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { shownPicture } from '../profile-draft'
import type { ProfileDraft } from '../use-profile-draft'
import { PicturePicker } from './picture-picker'

type EditBackgroundProps = {
  editing: ProfileDraft
  locked: boolean
  onPick: (file: File) => void
}

export function EditBackground({ editing, locked, onPick }: EditBackgroundProps) {
  const t = useTranslations('profile.edit.background')
  const background = shownPicture(editing.draft.background, editing.base.background)
  return (
    <Stack gap="sm">
      <Stack gap="xs">
        <Text size="sm" weight="medium">
          {t('label')}
        </Text>
        <Text size="sm" tone="muted">
          {t('hint')}
        </Text>
      </Stack>
      <Inline gap="md" align="center">
        {background !== undefined && (
          <Image
            src={background}
            alt={t('current')}
            ratio={16 / 9}
            fit="cover"
            className="w-40 shrink-0 rounded-lg"
          />
        )}
        <Inline gap="sm">
          <PicturePicker
            label={t(background === undefined ? 'upload' : 'change')}
            disabled={locked}
            onPick={onPick}
            className="w-auto"
          />
          {background !== undefined && (
            <Button
              variant="outline"
              tone="neutral"
              disabled={locked}
              onClick={() => editing.remove('background')}
            >
              {t('remove')}
            </Button>
          )}
        </Inline>
      </Inline>
    </Stack>
  )
}
