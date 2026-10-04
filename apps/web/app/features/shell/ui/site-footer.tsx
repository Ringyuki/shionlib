import { Divider, Inline, Link, Stack, Text } from '@hina-ui/react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { repositoryUrl, sitePaths } from '../shell'

export function SiteFooter({ version }: { version: string }) {
  const t = useTranslations('shell.footer')
  const locale = useLocale()
  const paths = sitePaths(locale)
  const links = [
    { key: 'help', to: paths.help },
    { key: 'uploadRules', to: paths.uploadRules },
    { key: 'friendLinks', to: paths.friendLinks },
  ] as const
  return (
    <Stack as="footer" gap="md" aria-label={t('label')} className="mt-12">
      <Divider />
      <Inline gap="md" align="center">
        <Inline as="nav" gap="md" align="center">
          {links.map(link => (
            <Link key={link.key} asChild tone="neutral">
              <RouterLink to={link.to}>
                <Text as="span" size="sm" className="text-inherit">
                  {t(link.key)}
                </Text>
              </RouterLink>
            </Link>
          ))}
          <Link tone="neutral" href={repositoryUrl} target="_blank" rel="noreferrer">
            <Text as="span" size="sm" className="text-inherit">
              GitHub
            </Text>
          </Link>
        </Inline>
        <Text size="xs" tone="faint">
          {t('version', { version })}
        </Text>
      </Inline>
    </Stack>
  )
}
