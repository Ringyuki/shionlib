import { Button, Container, Result } from '@hina-ui/react'
import { isRouteErrorResponse, Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'

type ErrorPageProps = {
  error: unknown
}

export function ErrorPage({ error }: ErrorPageProps) {
  const t = useTranslations('site')
  const locale = useLocale()
  const status = isRouteErrorResponse(error) ? error.status : 500
  const [title, description] =
    status === 404
      ? [t('notFoundTitle'), t('notFoundDescription')]
      : status === 401
        ? [t('signInTitle'), t('signInDescription')]
        : status === 403
          ? [t('forbiddenTitle'), t('forbiddenDescription')]
          : [t('errorTitle'), t('errorDescription')]
  return (
    <Container size="sm" className="py-24">
      <Result
        status={status >= 500 ? 'error' : 'warning'}
        title={title}
        description={description}
        actions={
          <Button asChild variant="soft">
            <Link to={`/${locale}`}>{t('backHome')}</Link>
          </Button>
        }
      />
    </Container>
  )
}
