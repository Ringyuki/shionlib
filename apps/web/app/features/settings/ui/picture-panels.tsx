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
import { useTranslations } from 'use-intl'
import type { Viewer } from '~/features/viewer'
import { usePictureUpload } from '../use-picture-upload'

export function PicturePanels({ viewer }: { viewer: Viewer }) {
  const t = useTranslations('settings.personal')
  const avatar = usePictureUpload('avatar')
  const cover = usePictureUpload('cover')
  const resolveImage = useImageResolver()
  const send = async (upload: (file: File) => ReturnType<typeof avatar.upload>, file: File) => {
    const outcome = await upload(file)
    if (outcome.ok) {
      toast.success(t('pictureSaved'))
    }
  }
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
          <FileUpload
            aria-label={t('changeAvatar')}
            variant="button"
            list={false}
            accept="image/*"
            value={null}
            loading={avatar.pending}
            icon={<ImageUp />}
            onReject={() => toast.danger(t('notImage'))}
            onValueChange={file => {
              if (file instanceof File) {
                void send(avatar.upload, file)
              }
            }}
          >
            {t('changeAvatar')}
          </FileUpload>
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
          <FileUpload
            aria-label={t('changeCover')}
            variant="button"
            list={false}
            accept="image/*"
            value={null}
            loading={cover.pending}
            icon={<ImageUp />}
            onReject={() => toast.danger(t('notImage'))}
            onValueChange={file => {
              if (file instanceof File) {
                void send(cover.upload, file)
              }
            }}
          >
            {t('changeCover')}
          </FileUpload>
        </Stack>
      </Panel>
    </>
  )
}
