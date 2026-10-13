import { FormField, Grid, Input, RadioGroup, Select, Switch } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { categories, useCategoryLabel } from '~/features/admin'
import { blocked, verdicts } from '../admin-comment'
import type { ReviewValues } from '../admin-comment.schema'

type CommentFieldsProps = {
  values: ReviewValues
  onValuesChange: (values: ReviewValues) => void
}

export function CommentFields({ values, onValuesChange }: CommentFieldsProps) {
  const t = useTranslations('adminComment')
  const label = useCategoryLabel()
  return (
    <>
      <FormField name="status">
        <RadioGroup
          aria-label={t('pane.review')}
          orientation="horizontal"
          block
          value={values.status}
          options={verdicts.map(verdict => ({
            value: verdict,
            label: t(`verdict.${verdict}`),
            description: t(`verdictHint.${verdict}`),
          }))}
          onValueChange={value =>
            onValuesChange({
              ...values,
              status: verdicts.find(verdict => verdict === value) ?? null,
            })
          }
        />
      </FormField>
      {values.status === blocked && (
        <>
          <Grid gap="md" className="sm:grid-cols-[12.5rem_minmax(0,1fr)]">
            <FormField name="category" label={t('pane.category')}>
              <Select
                value={values.category}
                options={categories.map(category => ({ value: category, label: label(category) }))}
                onValueChange={value =>
                  onValuesChange({
                    ...values,
                    category: categories.find(category => category === value) ?? values.category,
                  })
                }
              />
            </FormField>
            <FormField name="reason" label={t('pane.reason')}>
              <Input
                value={values.reason}
                placeholder={t('pane.reasonPlaceholder')}
                onValueChange={reason => onValuesChange({ ...values, reason })}
              />
            </FormField>
          </Grid>
          <FormField name="notify">
            <Switch
              checked={values.notify}
              onCheckedChange={notify => onValuesChange({ ...values, notify })}
            >
              {t('pane.notify')}
            </Switch>
          </FormField>
        </>
      )}
    </>
  )
}
