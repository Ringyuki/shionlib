import { Dialog, Form, FormField, Input, NumberInput, Switch, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf, rangeOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { blankAd, valuesOf, type AdminAd } from '../admin-ad'
import { adForm } from '../admin-ad.schema'
import { useAdChange } from '../use-ad-change'
import { BannerField, SideField } from './image-fields'
import { LanguageChoices, ScheduleField, SlotChoices } from './placement-fields'

export type Editing = { ad: AdminAd | undefined }

type AdDialogProps = {
  editing: Editing | undefined
  onClose: () => void
}

export function AdDialog({ editing, onClose }: AdDialogProps) {
  const t = useTranslations('adminAd')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const open = editing !== undefined
  const existing = useLast(editing)?.ad
  const [values, setValues] = useOpenState(open, () =>
    editing?.ad === undefined ? blankAd : valuesOf(editing.ad),
  )
  const save = useAdChange()
  const form = useFormErrors(save.failure)
  const weight = rangeOf('AdDraftInput', 'weight')
  return (
    <Dialog
      size="lg"
      title={t(existing === undefined ? 'dialog.create' : 'dialog.edit')}
      open={open}
      onOpenChange={next => {
        if (!next) {
          onClose()
        }
      }}
      renderContent={() => (
        <Form
          ref={form}
          values={values}
          rules={adForm(kit)}
          onSubmit={async () => {
            const outcome = await save.run(
              existing === undefined
                ? { action: 'create', values }
                : { action: 'update', id: existing.id, values },
            )
            if (outcome.ok) {
              onClose()
              toast.success(t(existing === undefined ? 'created' : 'saved'))
            }
          }}
        >
          <FormField name="name" label={t('dialog.name')} required>
            <Input
              value={values.name}
              onValueChange={name => setValues({ ...values, name })}
              maxLength={lengthOf('AdDraftInput', 'name').max}
            />
          </FormField>
          <FormField name="link" label={t('dialog.link')} required>
            <Input
              type="url"
              inputMode="url"
              placeholder="https://"
              value={values.link}
              onValueChange={link => setValues({ ...values, link })}
              maxLength={lengthOf('AdDraftInput', 'link').max}
            />
          </FormField>
          <BannerField values={values} onChange={setValues} />
          <SideField values={values} onChange={setValues} />
          <FormField name="slots" label={t('dialog.slots')}>
            <SlotChoices values={values} onChange={setValues} />
          </FormField>
          <FormField name="languages" label={t('dialog.languages')}>
            <LanguageChoices values={values} onChange={setValues} />
          </FormField>
          <FormField
            name="weight"
            label={t('dialog.weight')}
            description={t('dialog.weightHint', {
              min: String(weight.min),
              max: String(weight.max),
            })}
          >
            <NumberInput
              className="w-30"
              min={weight.min}
              max={weight.max}
              value={values.weight}
              onValueChange={next => setValues({ ...values, weight: next ?? values.weight })}
            />
          </FormField>
          <ScheduleField values={values} onChange={setValues} />
          <Switch
            controlPlacement="end"
            block
            checked={values.enabled}
            onCheckedChange={enabled => setValues({ ...values, enabled })}
          >
            {t('dialog.enabled')}
          </Switch>
        </Form>
      )}
      renderFooter={({ close, submitting }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button loading={submitting} onClick={() => void form.current?.submit()}>
            {t(existing === undefined ? 'dialog.submitCreate' : 'dialog.submitEdit')}
          </Button>
        </>
      )}
    />
  )
}
