import { Avatar, Flex, Image, Inline, Stack, useImageResolver } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import type { PictureKind } from '../profile'
import { shownPicture } from '../profile-draft'
import type { ProfileDraft } from '../use-profile-draft'
import { PicturePicker } from './picture-picker'

type EditPicturesProps = {
  name: string
  editing: ProfileDraft
  locked: boolean
  onPick: (kind: PictureKind, file: File) => void
}

export function EditPictures({ name, editing, locked, onPick }: EditPicturesProps) {
  const t = useTranslations('profile.edit')
  const resolveImage = useImageResolver()
  const { base, draft } = editing
  const cover = shownPicture(draft.cover, base.cover)
  const avatar = shownPicture(draft.avatar, base.avatar)
  return (
    <Stack gap="none">
      {cover === undefined ? (
        <Flex aria-hidden className="bg-subtle aspect-3/1 rounded-lg" />
      ) : (
        <Image src={cover} alt={t('cover.current')} ratio={3} fit="cover" className="rounded-lg" />
      )}
      <Inline align="start" justify="between" gap="md">
        <Avatar
          src={avatar === undefined ? undefined : resolveImage(avatar, 'image')}
          name={name}
          alt={t('avatar.current')}
          className="ring-surface ms-4 -mt-10 size-20 text-[1.75rem] ring-4"
        />
        <Inline gap="sm" className="mt-3">
          <PicturePicker
            label={t(cover === undefined ? 'cover.upload' : 'cover.change')}
            disabled={locked}
            onPick={file => onPick('cover', file)}
            className="w-auto"
          />
          {cover !== undefined && (
            <Button
              variant="outline"
              tone="neutral"
              disabled={locked}
              onClick={() => editing.remove('cover')}
            >
              {t('cover.remove')}
            </Button>
          )}
          <PicturePicker
            label={t(avatar === undefined ? 'avatar.upload' : 'avatar.change')}
            disabled={locked}
            onPick={file => onPick('avatar', file)}
            className="w-auto"
          />
        </Inline>
      </Inline>
    </Stack>
  )
}
