import { Dialog, Form, FormField, Input, Textarea, type FormHandle } from '@hina-ui/react'
import { useRef } from 'react'
import { useTranslations } from 'use-intl'
import { admit } from '~/features/upload'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import type { Resource } from '../resource'
import { updatePatchForm, type UpdatePatchValues } from '../resource-composition.schema'
import { useAllowance } from '../use-allowance'
import { useResourceIssue } from '../use-resource-issue'
import { useStartUpload } from '../use-start-upload'
import { UploadFilesField } from './upload-files-field'

type UpdatePatchDialogProps = {
  resource: Resource
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UpdatePatchDialog({ resource, open, onOpenChange }: UpdatePatchDialogProps) {
  const t = useTranslations('resource')
  const issue = useResourceIssue()
  const kit = useFormKit()
  const form = useRef<FormHandle>(null)
  const allowance = useAllowance(open)
  const start = useStartUpload()
  const [values, setValues] = useOpenState<UpdatePatchValues>(open, () => ({
    files: [],
    patchVersion: '',
    note: '',
  }))
  const admission = admit(allowance, values.files)
  return (
    <Dialog
      title={t('composition.update.title')}
      description={t('composition.update.description')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={({ close }) => (
        <Form
          ref={form}
          values={values}
          rules={updatePatchForm(kit, issue)}
          onSubmit={() => {
            const [patch] = values.files
            if (patch !== undefined && admission === undefined) {
              start.rebuild(resource, patch, values.patchVersion, values.note)
              close()
            }
          }}
        >
          <UploadFilesField
            allowance={allowance}
            admission={admission}
            multiple={false}
            files={values.files}
            onFilesChange={files => setValues({ ...values, files })}
          />
          <FormField name="patchVersion" label={t('composition.update.patchVersion')}>
            <Input
              value={values.patchVersion}
              onValueChange={patchVersion => setValues({ ...values, patchVersion })}
              placeholder={t('patchVersionExample')}
              maxLength={lengthOf('RebuildCompositionInputBody', 'patch_version').max}
              className="sm:w-44"
            />
          </FormField>
          <FormField
            name="note"
            label={t('composition.update.note')}
            description={t('optionalHint', lengthOf('RebuildCompositionInputBody', 'note'))}
          >
            <Textarea
              value={values.note}
              onValueChange={note => setValues({ ...values, note })}
              autosize={{ minRows: 2, maxRows: 6 }}
            />
          </FormField>
        </Form>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" onClick={close}>
            {t('cancel')}
          </Button>
          <Button disabled={admission !== undefined} onClick={() => void form.current?.submit()}>
            {t('composition.update.start')}
          </Button>
        </>
      )}
    />
  )
}
