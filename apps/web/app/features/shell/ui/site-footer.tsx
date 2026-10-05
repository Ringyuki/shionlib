import { Divider, Inline, Link, Stack, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { repositoryUrl, sitePaths } from '../shell'

type SiteFooterProps = {
  version: string
  year: number
}

export function SiteFooter({ version, year }: SiteFooterProps) {
  const t = useTranslations('shell.footer')
  const locale = useLocale()
  const paths = sitePaths(locale)
  const links = [
    { key: 'help', to: paths.help },
    { key: 'uploadRules', to: paths.uploadRules },
    { key: 'friendLinks', to: paths.friendLinks },
  ] as const
  return (
    <Stack as="footer" gap="md" className="mt-16 pb-14">
      <Divider />
      <Inline gap="md" align="center" justify="between">
        <Inline as="nav" gap="lg" align="center" aria-label={t('label')}>
          {links.map(link => (
            <Link key={link.key} asChild tone="neutral">
              <RouterLink to={link.to}>
                <Text as="span" size="sm" tone="muted">
                  {t(link.key)}
                </Text>
              </RouterLink>
            </Link>
          ))}
          <Link tone="neutral" href={repositoryUrl} target="_blank" rel="noreferrer">
            <Text as="span" size="sm" tone="muted">
              GitHub
            </Text>
          </Link>
        </Inline>
        <Text size="xs" tone="faint">
          {t('copyright', { year })} · {t('version', { version })}
        </Text>
      </Inline>
    </Stack>
  )
}
