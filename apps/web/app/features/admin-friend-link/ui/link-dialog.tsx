import { Dialog, Form, FormField, Input, Switch, Textarea, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { useLast } from '~/shared/ui/use-last'
import { useOpenState } from '~/shared/ui/use-open-state'
import { blankLink, valuesOf, type Link } from '../admin-friend-link'
import { linkForm } from '../admin-friend-link.schema'
import { useLinkChange } from '../use-link-change'
import { LogoField } from './logo-field'

export type Editing = { link: Link | undefined }

type LinkDialogProps = {
  editing: Editing | undefined
  onClose: () => void
}

export function LinkDialog({ editing, onClose }: LinkDialogProps) {
  const t = useTranslations('adminFriendLink')
  const shared = useTranslations('admin')
  const kit = useFormKit()
  const open = editing !== undefined
  const shown = useLast(editing)
  const existing = shown?.link
  const [values, setValues] = useOpenState(open, () =>
    editing?.link === undefined ? blankLink : valuesOf(editing.link),
  )
  const save = useLinkChange()
  const form = useFormErrors(save.failure)
  const description = lengthOf('CreateFriendLinkInputBody', 'description')
  return (
    <Dialog
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
          rules={linkForm(kit)}
          onSubmit={async () => {
            const outcome = await save.run(
              existing === undefined
                ? { action: 'create', ...values }
                : { action: 'update', id: existing.id, ...values },
            )
            if (outcome.ok) {
              onClose()
              toast.success(t(existing === undefined ? 'created' : 'saved'))
            }
          }}
        >
          <FormField name="name" label={t('dialog.name')} required>
            <Input
              placeholder={t('dialog.namePlaceholder')}
              value={values.name}
              onValueChange={name => setValues({ ...values, name })}
              maxLength={lengthOf('CreateFriendLinkInputBody', 'name').max}
            />
          </FormField>
          <FormField name="url" label={t('dialog.url')} required>
            <Input
              type="url"
              inputMode="url"
              placeholder="https://"
              value={values.url}
              onValueChange={url => setValues({ ...values, url })}
              maxLength={lengthOf('CreateFriendLinkInputBody', 'url').max}
            />
          </FormField>
          <FormField name="logo" label={t('dialog.logo')}>
            <LogoField
              name={values.name}
              logo={values.logo}
              disabled={false}
              onChange={logo => setValues({ ...values, logo })}
            />
          </FormField>
          <FormField
            name="description"
            label={t('dialog.description')}
            description={t('dialog.count', {
              count: [...values.description].length,
              max: description.max,
            })}
          >
            <Textarea
              rows={3}
              placeholder={t('dialog.descriptionPlaceholder')}
              value={values.description}
              onValueChange={text => setValues({ ...values, description: text })}
              maxLength={description.max}
            />
          </FormField>
          <Switch
            checked={values.visible}
            onCheckedChange={visible => setValues({ ...values, visible })}
          >
            {t('dialog.visible')}
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
