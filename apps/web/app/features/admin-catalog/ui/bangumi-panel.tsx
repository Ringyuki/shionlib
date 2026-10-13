import {
  CopyButton,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Inline,
  Link,
  Panel,
  Stack,
  Text,
  Time,
} from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useTranslations } from 'use-intl'
import { adminPaths, StatusLine } from '~/features/admin'
import { browserApiUrl } from '~/shared/api/browser'
import { Button } from '~/shared/ui/button'
import { bangumiState, type Authorization } from '../admin-catalog'

type BangumiPanelProps = {
  authorization: Authorization
  editable: boolean
}

const tones = { authorized: 'success', pending: 'warning', unset: 'neutral' } as const

export function BangumiPanel({ authorization, editable }: BangumiPanelProps) {
  const t = useTranslations('adminCatalog.bangumi')
  const state = bangumiState(authorization)
  return (
    <Panel
      title={t('title')}
      description={t('hint')}
      actions={
        <Button
          as="a"
          href={browserApiUrl('/admin/bangumi/authorization/start', {
            returnTo: adminPaths.catalog,
          })}
          size="sm"
          variant={state === 'authorized' ? 'outline' : 'solid'}
          tone={state === 'authorized' ? 'neutral' : 'accent'}
          disabled={!editable || state === 'unset'}
        >
          {t(state === 'authorized' ? 'again' : 'authorize')}
        </Button>
      }
    >
      <Stack gap="md">
        <StatusLine tone={tones[state]} label={t(`state.${state}`)} />
        <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:6rem]">
          <DescriptionTerm>{t('callback')}</DescriptionTerm>
          <DescriptionDetails>
            <Inline gap="xs" align="center">
              <Text as="span" size="inherit" className="font-mono break-all">
                {authorization.callback_url}
              </Text>
              <CopyButton text={authorization.callback_url} label={t('copyCallback')} size="sm" />
            </Inline>
          </DescriptionDetails>
          <DescriptionTerm>{t('expires')}</DescriptionTerm>
          <DescriptionDetails>
            {authorization.expires_at === null ? (
              t('noToken')
            ) : (
              <Time value={authorization.expires_at} format="datetime" tooltip={false} />
            )}
          </DescriptionDetails>
        </DescriptionList>
        <Text as="span" size="sm" tone="muted">
          {t.rich(editable ? 'steps' : 'readOnly', {
            settings: chunks => (
              <Link asChild>
                <RouterLink to={adminPaths.settings}>{chunks}</RouterLink>
              </Link>
            ),
          })}
        </Text>
      </Stack>
    </Panel>
  )
}
