import {
  Card,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Inline,
  Stack,
  Text,
  Time,
} from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { browserOf, type UploadFailure } from '../admin-upload'
import { Copyable, useErrorText } from './upload-error'

function FailureCard({ failure }: { failure: UploadFailure }) {
  const t = useTranslations('adminUpload')
  const errorText = useErrorText()
  const browser = browserOf(failure.user_agent)
  const browserName =
    browser === undefined
      ? undefined
      : t('browserValue', { name: browser.name, version: browser.version })
  const attempts = failure.attempts ?? []
  const reason =
    failure.stage === 'submit' && failure.reason === 'rejected' ? 'submitRejected' : failure.reason
  const fromApi = failure.error.name === 'ApiError'
  return (
    <Card padded={false} className="overflow-hidden">
      <Inline gap="sm" align="center" className="bg-subtle px-4 py-2.5 text-sm">
        <Time value={failure.at} format="time" tooltip={false} className="tabular-nums" />
        <Text as="span" size="sm" tone="muted">
          {failure.chunk === null
            ? t(`failureStage.${failure.stage}`)
            : `${t(`failureStage.${failure.stage}`)} · ${t('chunkNumber', { number: failure.chunk + 1 })}`}
        </Text>
      </Inline>
      <DescriptionList
        orientation="horizontal"
        className="px-4 py-3 text-sm [--hn-dl-term-width:4.5rem]"
      >
        <DescriptionTerm>{t('failure.hint')}</DescriptionTerm>
        <DescriptionDetails>{t(`reason.${reason}`)}</DescriptionDetails>
        <DescriptionTerm>{t('failure.error')}</DescriptionTerm>
        <DescriptionDetails>
          <Stack gap="none">
            <Text as="span" size="inherit" className={fromApi ? undefined : 'font-mono break-all'}>
              {errorText(failure.error)}
            </Text>
            {fromApi && failure.error.request_id === null && (
              <Text as="span" size="xs" tone="muted">
                {t('noRequestId')}
              </Text>
            )}
          </Stack>
        </DescriptionDetails>
        {failure.error.request_id !== null && (
          <>
            <DescriptionTerm>{t('failure.request')}</DescriptionTerm>
            <DescriptionDetails>
              <Copyable text={failure.error.request_id} label={t('copy')} />
            </DescriptionDetails>
          </>
        )}
        {failure.error.ray !== null && (
          <>
            <DescriptionTerm>{t('failure.ray')}</DescriptionTerm>
            <DescriptionDetails>
              <Copyable text={failure.error.ray} label={t('copy')} />
            </DescriptionDetails>
          </>
        )}
        {attempts.length > 0 && (
          <>
            <DescriptionTerm>{t('failure.retries')}</DescriptionTerm>
            <DescriptionDetails>
              <Stack gap="xs">
                {attempts.map(attempt => (
                  <Inline
                    key={attempt.at}
                    gap="md"
                    align="baseline"
                    wrap={false}
                    className="border-line border-t pt-1 text-xs first:border-t-0 first:pt-0"
                  >
                    <Time
                      value={attempt.at}
                      format="time"
                      tooltip={false}
                      className="text-muted shrink-0 tabular-nums"
                    />
                    <Text as="span" size="xs" className="w-24 shrink-0">
                      {t(`wait.${attempt.wait}`)}
                    </Text>
                    <Text as="span" size="xs" className="font-mono break-all">
                      {errorText(attempt.error)}
                    </Text>
                  </Inline>
                ))}
              </Stack>
            </DescriptionDetails>
          </>
        )}
        <DescriptionTerm>{t('failure.browser')}</DescriptionTerm>
        <DescriptionDetails>
          <Text as="span" size="inherit" className="font-mono">
            {failure.client}
          </Text>
          {browser !== undefined && browserName !== undefined && (
            <Text as="span" size="inherit">
              {` · ${browser.system === undefined ? browserName : t('browserOn', { browser: browserName, system: browser.system })}`}
            </Text>
          )}
        </DescriptionDetails>
        <DescriptionTerm>{t('failure.ip')}</DescriptionTerm>
        <DescriptionDetails className="font-mono break-all">{failure.ip}</DescriptionDetails>
      </DescriptionList>
    </Card>
  )
}

export function UploadFailures({
  failures,
  beforeLog,
}: {
  failures: UploadFailure[]
  beforeLog: boolean
}) {
  const t = useTranslations('adminUpload')
  if (failures.length === 0) {
    return (
      <Stack gap="none">
        <Text as="span" size="sm" tone="muted">
          {t('noFailures')}
        </Text>
        {beforeLog && (
          <Text as="span" size="xs" tone="faint">
            {t('failuresSince')}
          </Text>
        )}
      </Stack>
    )
  }
  return (
    <Stack gap="sm">
      {failures.map(failure => (
        <FailureCard key={failure.id} failure={failure} />
      ))}
    </Stack>
  )
}
