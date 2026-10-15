import { Dialog, Form, FormField, RadioGroup, Stack, Text, Textarea } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { lengthOf } from '~/shared/form/form-kit'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { Button } from '~/shared/ui/button'
import { flushEnd } from '~/shared/ui/flush'
import { useOpenState } from '~/shared/ui/use-open-state'
import { useWalkthroughFormat } from '../use-walkthrough-format'
import { placements, type Formatted, type Placement } from '../walkthrough-format'
import { formatForm, type FormatValues } from '../walkthrough-format.schema'
import { FormatProgress } from './format-progress'

type FormatDialogProps = {
  gameId: number
  filled: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onFormatted: (formatted: Formatted, placement: Placement) => void
}

const blank: FormatValues = { text: '', placement: 'append' }

const { max } = lengthOf('FormatWalkthroughInputBody', 'text')

export function FormatDialog({
  gameId,
  filled,
  open,
  onOpenChange,
  onFormatted,
}: FormatDialogProps) {
  const t = useTranslations('walkthrough.format')
  const shared = useTranslations('walkthrough')
  const kit = useFormKit()
  const [values, setValues] = useOpenState(open, () => blank)
  const [working, setWorking] = useOpenState(open, () => false)
  const [task, setTask] = useState<{ id: string; since: number }>()
  const format = useWalkthroughFormat(gameId, task?.id, {
    onDone: formatted => {
      setTask(undefined)
      onFormatted(formatted, values.placement)
      onOpenChange(false)
    },
    onFailed: () => {
      setTask(undefined)
      setWorking(false)
    },
  })
  const form = useFormErrors(format.failure)
  const stop = () => {
    setTask(undefined)
    setWorking(false)
  }
  return (
    <Dialog
      size="xl"
      title={t('title')}
      description={t('description')}
      open={open}
      onOpenChange={next => {
        if (!next) {
          setTask(undefined)
        }
        onOpenChange(next)
      }}
      renderContent={() =>
        working ? (
          <FormatProgress since={task?.since} />
        ) : (
          <Form
            ref={form}
            values={values}
            rules={formatForm(kit)}
            onSubmit={async () => {
              const outcome = await format.begin(values.text)
              if (outcome.ok) {
                setTask({ id: outcome.result.id, since: Date.now() })
                setWorking(true)
              }
            }}
          >
            <Stack gap="none" className="gap-1.5">
              <FormField name="text" label={t('source')} required>
                <Textarea
                  value={values.text}
                  rows={filled ? 11 : 15}
                  spellCheck={false}
                  onValueChange={text => setValues({ ...values, text })}
                />
              </FormField>
              <Text size="xs" tone="muted" className="text-end tabular-nums">
                {t('count', { count: [...values.text].length, max })}
              </Text>
            </Stack>
            {filled && (
              <FormField name="placement" label={t('placement')}>
                <RadioGroup
                  value={values.placement}
                  options={placements.map(value => ({ value, label: t(value) }))}
                  onValueChange={chosen =>
                    setValues({
                      ...values,
                      placement: placements.find(each => each === chosen) ?? 'append',
                    })
                  }
                />
              </FormField>
            )}
          </Form>
        )
      }
      renderFooter={({ close, submitting }) =>
        working ? (
          <Button variant="ghost" tone="neutral" className={flushEnd.md} onClick={stop}>
            {shared('cancel')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" tone="neutral" disabled={submitting} onClick={close}>
              {shared('cancel')}
            </Button>
            <Button loading={submitting} onClick={() => void form.current?.submit()}>
              {t('start')}
            </Button>
          </>
        )
      }
    />
  )
}
