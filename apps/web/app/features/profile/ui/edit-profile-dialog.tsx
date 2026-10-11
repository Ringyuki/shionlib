import { AlertDialog, Dialog, Form, Inline, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { ImageCropDialog } from '~/shared/ui/image-crop-dialog'
import { usePictureCrop } from '~/shared/ui/use-picture-crop'
import { pictureShapes, type PictureKind, type Profile } from '../profile'
import { bioForm } from '../profile.schema'
import { useProfileDraft } from '../use-profile-draft'
import { useProfileEdit } from '../use-profile-edit'
import { EditProfileFields } from './edit-profile-fields'

type EditProfileDialogProps = {
  profile: Profile
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProfileDialog({ profile, open, onOpenChange }: EditProfileDialogProps) {
  const t = useTranslations('profile.edit')
  const kit = useFormKit()
  const editing = useProfileDraft(open, profile)
  const command = useProfileEdit()
  const form = useFormErrors(command.failure)
  const crop = usePictureCrop()
  const [kind, setKind] = useState<PictureKind>('avatar')
  const [discarding, setDiscarding] = useState(false)
  return (
    <>
      <Dialog
        title={t('title')}
        size="lg"
        open={open}
        onOpenChange={next => {
          if (!next && editing.changed) {
            setDiscarding(true)
          } else {
            onOpenChange(next)
          }
        }}
        renderContent={({ submitting }) => (
          <Form
            ref={form}
            values={{ bio: editing.draft.bio }}
            rules={bioForm(kit)}
            onSubmit={async () => {
              const outcome = await command.save(editing.edit)
              if (outcome.ok) {
                toast.success(t('saved'))
                onOpenChange(false)
              }
            }}
          >
            <EditProfileFields
              name={profile.name}
              editing={editing}
              locked={submitting}
              onPick={(picked, file) => {
                setKind(picked)
                crop.pick(file)
              }}
            />
          </Form>
        )}
        renderFooter={({ close, submitting }) => (
          <Inline gap="sm" justify="end" wrap={false} className="w-full">
            <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
              {t('cancel')}
            </Button>
            <Button
              loading={submitting}
              disabled={!editing.changed}
              onClick={() => form.current?.submit()}
            >
              {t('save')}
            </Button>
          </Inline>
        )}
      />
      <ImageCropDialog
        heading={t(`crop.${kind}`)}
        picture={crop.picture}
        open={crop.open}
        onOpenChange={crop.onOpenChange}
        shape={pictureShapes[kind]}
        onCrop={file => {
          editing.pick(kind, file)
          return Promise.resolve(true)
        }}
      />
      <AlertDialog
        title={t('discard.title')}
        confirmText={t('discard.confirm')}
        cancelText={t('discard.cancel')}
        tone="danger"
        open={discarding}
        onOpenChange={setDiscarding}
        onConfirm={() => onOpenChange(false)}
      />
    </>
  )
}
