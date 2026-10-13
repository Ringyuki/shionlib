import { Dialog, FormField, Input, Select, Stack, Switch, toast } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { categories, useCategoryLabel, type Category } from '~/features/admin'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { blocked, fallbackCategory } from '../admin-comment'
import { useCommentChange } from '../use-comment-change'

type BlockDialogProps = {
  ids: number[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

type Values = { category: Category; reason: string; notify: boolean }

const blank: Values = { category: fallbackCategory, reason: '', notify: true }

export function BlockDialog({ ids, open, onOpenChange, onDone }: BlockDialogProps) {
  const t = useTranslations('adminComment')
  const shared = useTranslations('admin')
  const label = useCategoryLabel()
  const [values, setValues] = useOpenState(open, () => blank)
  const [count] = useOpenState(open, () => ids.length)
  const change = useCommentChange()
  return (
    <Dialog
      title={t('bulk.blockTitle', { count })}
      description={t('verdictHint.3')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={() => (
        <Stack gap="md">
          <FormField label={t('pane.category')}>
            <Select
              value={values.category}
              options={categories.map(category => ({ value: category, label: label(category) }))}
              onValueChange={value =>
                setValues({
                  ...values,
                  category: categories.find(category => category === value) ?? values.category,
                })
              }
            />
          </FormField>
          <FormField label={t('pane.reason')}>
            <Input
              value={values.reason}
              placeholder={t('pane.reasonPlaceholder')}
              onValueChange={reason => setValues({ ...values, reason })}
            />
          </FormField>
          <Switch
            checked={values.notify}
            onCheckedChange={notify => setValues({ ...values, notify })}
          >
            {t('pane.notify')}
          </Switch>
        </Stack>
      )}
      renderFooter={({ close }) => (
        <>
          <Button variant="ghost" tone="neutral" disabled={change.pending} onClick={close}>
            {shared('cancel')}
          </Button>
          <Button
            tone="danger"
            loading={change.pending}
            onClick={async () => {
              const outcome = await change.run({
                action: 'review',
                ids,
                status: blocked,
                ...values,
              })
              if (outcome.ok) {
                onOpenChange(false)
                onDone()
                toast.success(t('bulk.blocked', { count: ids.length }))
              }
            }}
          >
            {t('verdict.3')}
          </Button>
        </>
      )}
    />
  )
}
