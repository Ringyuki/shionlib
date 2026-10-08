import { Button, Container, Result } from '@hina-ui/react'
import { isRouteErrorResponse, Link, useRevalidator } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { ErrorDetails, failureOf } from './error-details'

type ErrorPageProps = {
  error: unknown
}

export function ErrorPage({ error }: ErrorPageProps) {
  const t = useTranslations('site')
  const locale = useLocale()
  const { revalidate, state } = useRevalidator()
  const status = isRouteErrorResponse(error) ? error.status : 500
  const [title, description] =
    status === 404
      ? [t('notFoundTitle'), t('notFoundDescription')]
      : status === 401
        ? [t('signInTitle'), t('signInDescription')]
        : status === 403
          ? [t('forbiddenTitle'), t('forbiddenDescription')]
          : [t('errorTitle'), failureOf(error)?.message ?? t('errorDescription')]
  return (
    <Container size="sm" className="py-24">
      <Result
        status={status >= 500 ? 'error' : 'warning'}
        title={title}
        description={description}
        actions={
          <>
            {status >= 500 && (
              <Button loading={state === 'loading'} onClick={() => void revalidate()}>
                {t('retry')}
              </Button>
            )}
            <Button asChild variant="soft">
              <Link to={`/${locale}`}>{t('backHome')}</Link>
            </Button>
          </>
        }
      >
        <ErrorDetails error={error} />
      </Result>
    </Container>
  )
}
