import {
  Avatar,
  FileUpload,
  Image,
  Inline,
  Panel,
  Stack,
  toast,
  useImageResolver,
} from '@hina-ui/react'
import { ImageUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import type { Viewer } from '~/features/viewer'
import { ImageCropDialog } from '~/shared/ui/image-crop-dialog'
import { usePictureCrop } from '~/shared/ui/use-picture-crop'
import { pictureShapes, type PictureKind } from '../settings'
import { usePictureUpload } from '../use-picture-upload'

export function PicturePanels({ viewer }: { viewer: Viewer }) {
  const t = useTranslations('settings.personal')
  const uploads = { avatar: usePictureUpload('avatar'), cover: usePictureUpload('cover') }
  const crop = usePictureCrop()
  const [kind, setKind] = useState<PictureKind>('avatar')
  const resolveImage = useImageResolver()
  const picker = (picked: PictureKind, label: string) => (
    <FileUpload
      aria-label={label}
      variant="button"
      list={false}
      accept="image/*"
      value={null}
      loading={uploads[picked].pending}
      icon={<ImageUp />}
      onReject={() => toast.danger(t('notImage'))}
      onValueChange={file => {
        if (file instanceof File) {
          setKind(picked)
          crop.pick(file)
        }
      }}
    >
      {label}
    </FileUpload>
  )
  return (
    <>
      <Panel title={t('avatar')} description={t('avatarHint')}>
        <Inline gap="lg" align="center" wrap={false}>
          <Avatar
            src={viewer.avatar === null ? undefined : resolveImage(viewer.avatar, 'image')}
            name={viewer.name}
            alt=""
            className="size-16 text-xl"
          />
          {picker('avatar', t('changeAvatar'))}
        </Inline>
      </Panel>
      <Panel title={t('cover')} description={t('coverHint')}>
        <Stack gap="md" align="start">
          {viewer.cover !== null && (
            <Image
              src={viewer.cover}
              alt=""
              fit="cover"
              className="h-32 w-full rounded-xl sm:h-40"
            />
          )}
          {picker('cover', t('changeCover'))}
        </Stack>
      </Panel>
      <ImageCropDialog
        heading={t(kind === 'avatar' ? 'cropAvatar' : 'cropCover')}
        picture={crop.picture}
        open={crop.open}
        onOpenChange={crop.onOpenChange}
        shape={pictureShapes[kind]}
        onCrop={async file => {
          const outcome = await uploads[kind].upload(file)
          if (outcome.ok) {
            toast.success(t('pictureSaved'))
          }
          return outcome.ok
        }}
      />
    </>
  )
}
