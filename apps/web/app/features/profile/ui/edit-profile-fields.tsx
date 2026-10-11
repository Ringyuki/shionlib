import { FormField, Link, Stack, Text, Textarea } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '~/features/shell'
import { lengthOf } from '~/shared/form/form-kit'
import type { PictureKind } from '../profile'
import type { ProfileDraft } from '../use-profile-draft'
import { EditBackground } from './edit-background'
import { EditPictures } from './edit-pictures'

type EditProfileFieldsProps = {
  name: string
  editing: ProfileDraft
  locked: boolean
  onPick: (kind: PictureKind, file: File) => void
}

export function EditProfileFields({ name, editing, locked, onPick }: EditProfileFieldsProps) {
  const t = useTranslations('profile.edit')
  const locale = useLocale()
  const { draft } = editing
  return (
    <Stack gap="lg">
      <EditPictures name={name} editing={editing} locked={locked} onPick={onPick} />
      <FormField
        name="bio"
        label={t('bio')}
        description={t('bioCount', {
          count: [...draft.bio].length,
          max: lengthOf('UpdateBioInputBody', 'bio').max,
        })}
      >
        <Textarea
          value={draft.bio}
          onValueChange={editing.setBio}
          autosize={{ minRows: 3, maxRows: 8 }}
        />
      </FormField>
      <EditBackground
        editing={editing}
        locked={locked}
        onPick={file => onPick('background', file)}
      />
      <Text size="sm" tone="muted">
        {t.rich('account', {
          link: chunks => (
            <Link asChild>
              <RouterLink to={sitePaths(locale).settings}>{chunks}</RouterLink>
            </Link>
          ),
        })}
      </Text>
    </Stack>
  )
}
