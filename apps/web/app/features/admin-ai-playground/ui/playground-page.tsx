import { Alert, Form, Grid, Panel, Stack } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { GatewayFrame } from '~/features/admin-ai'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { targetLabel, type Choices } from '../admin-ai-playground'
import { paramsForm } from '../admin-ai-playground.schema'
import { usePlayground } from '../use-playground'
import { LanePanel } from './lane-panel'
import { MessageBox } from './message-box'
import { ParamFields } from './param-fields'
import { TargetFields } from './target-fields'

type AiPlaygroundPageProps = {
  choices: Choices
  editable: boolean
}

const columns = ['', 'xl:grid-cols-1', 'xl:grid-cols-2', 'xl:grid-cols-3'] as const

export function AiPlaygroundPage({ choices, editable }: AiPlaygroundPageProps) {
  const t = useTranslations('adminAiPlayground')
  const issue = useTranslations('adminAiPlayground.issue')
  const kit = useFormKit()
  const playground = usePlayground(choices)
  const form = useFormErrors(undefined)
  const [message, setMessage] = useState('')
  const { lanes, params } = playground
  const usable = editable && lanes.length > 0
  return (
    <GatewayFrame tab="playground">
      <Stack gap="lg">
        <Alert tone="info" open={!editable}>
          {t('readOnly')}
        </Alert>
        <Alert tone="warning" open={editable && lanes.length === 0}>
          {t('nothing')}
        </Alert>
        <Form
          ref={form}
          values={params}
          rules={paramsForm(kit, issue)}
          onSubmit={() => {
            const text = message.trim()
            if (usable && !playground.busy && text !== '') {
              playground.send(text)
              setMessage('')
            }
          }}
        >
          <Grid gap="none" className="items-start gap-6 lg:grid-cols-[21.25rem_minmax(0,1fr)]">
            <Panel title={t('setup')}>
              <Stack gap="md">
                <TargetFields choices={choices} playground={playground} disabled={!editable} />
                <ParamFields playground={playground} disabled={!editable || playground.busy} />
              </Stack>
            </Panel>
            <Stack gap="md" className="min-w-0">
              <Grid gap="md" className={columns[lanes.length]}>
                {lanes.map((lane, index) => (
                  <LanePanel
                    key={`${index}-${lane.target.kind}-${lane.target.id}`}
                    heading={targetLabel(choices, lane.target)}
                    exchanges={lane.exchanges}
                    pending={playground.pendingAt(index)}
                  />
                ))}
              </Grid>
              <MessageBox
                value={message}
                disabled={!usable}
                busy={playground.busy}
                started={lanes.some(lane => lane.exchanges.length > 0)}
                onChange={setMessage}
                onRestart={playground.restart}
                onSend={() => void form.current?.submit()}
              />
            </Stack>
          </Grid>
        </Form>
      </Stack>
    </GatewayFrame>
  )
}
