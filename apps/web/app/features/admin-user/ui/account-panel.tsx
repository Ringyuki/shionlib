import { Form, FormField, Grid, Inline, Input, Panel, Select, Text, toast } from '@hina-ui/react'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { useMessages, useTranslations } from 'use-intl'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { contentLimits, languages, type UserDetail } from '../admin-user'
import {
  contentLimitFrom,
  languageFrom,
  profileForm,
  type ProfileValues,
} from '../admin-user.schema'
import { useUserChange } from '../use-user-change'

type AccountPanelProps = {
  detail: UserDetail
  manageable: boolean
  punishable: boolean
  onResetPassword: () => void
}

function valuesOf(detail: UserDetail): ProfileValues {
  return {
    name: detail.name,
    email: detail.email,
    language: languageFrom(detail.lang) ?? 'zh',
    contentLimit: contentLimitFrom(detail.content_limit) ?? 1,
  }
}

export function AccountPanel(props: AccountPanelProps) {
  const { detail, manageable, punishable, onResetPassword } = props
  const t = useTranslations('adminUser.account')
  const limits = useMessages().settings.site.contentLimits
  const kit = useFormKit()
  const [values, setValues] = useState(() => valuesOf(detail))
  const change = useUserChange()
  const form = useFormErrors(change.failure)
  return (
    <Panel title={t('title')}>
      <Form
        ref={form}
        values={values}
        rules={profileForm(kit)}
        disabled={!manageable}
        onSubmit={async () => {
          const outcome = await change.run({ action: 'profile', id: detail.id, ...values })
          if (outcome.ok) {
            toast.success(t('saved'))
          }
        }}
      >
        <Grid gap="md" className="sm:grid-cols-2">
          <FormField name="name" label={t('name')}>
            <Input value={values.name} onValueChange={name => setValues({ ...values, name })} />
          </FormField>
          <FormField name="email" label={t('email')}>
            <Input
              type="email"
              value={values.email}
              onValueChange={email => setValues({ ...values, email })}
            />
          </FormField>
          <FormField name="language" label={t('language')}>
            <Select
              value={values.language}
              options={languages.map(language => ({
                value: language,
                label: t(`languages.${language}`),
              }))}
              onValueChange={value =>
                setValues({
                  ...values,
                  language: languages.find(language => language === value) ?? values.language,
                })
              }
            />
          </FormField>
          <FormField name="contentLimit" label={t('contentLimit')}>
            <Select
              value={values.contentLimit}
              options={contentLimits.map(limit => ({ value: limit, label: limits[limit].label }))}
              onValueChange={value =>
                setValues({
                  ...values,
                  contentLimit: contentLimits.find(limit => limit === value) ?? values.contentLimit,
                })
              }
            />
          </FormField>
        </Grid>
        <Inline gap="sm" align="center" justify="between">
          <Button type="submit" loading={change.pending} disabled={!manageable}>
            {t('save')}
          </Button>
          <Button
            variant="outline"
            tone="neutral"
            icon={<KeyRound />}
            disabled={!punishable}
            onClick={onResetPassword}
          >
            {t('resetPassword')}
          </Button>
        </Inline>
        {!manageable && (
          <Text as="span" size="sm" tone="muted">
            {t('locked')}
          </Text>
        )}
      </Form>
    </Panel>
  )
}
