import { Divider, Flex, Inline, Link, Text } from '@hina-ui/react'
import { Copyright, Heart, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { RiGithubFill, RiTelegram2Fill } from 'react-icons/ri'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { BrandLogo, Wordmark } from '~/shared/ui/brand'
import { contactEmail, repositoryUrl, sitePaths, telegramUrl } from '../shell'

export function SiteFooter() {
  const t = useTranslations('shell.footer')
  const paths = sitePaths(useLocale())
  return (
    <Flex
      as="footer"
      aria-label={t('label')}
      className="mt-16 flex-col items-center gap-4 pb-14 md:flex-row md:justify-between"
    >
      <Inline gap="sm" align="center" wrap={false}>
        <BrandLogo className="size-8" />
        <Inline gap="xs" align="center" wrap={false}>
          <Copyright aria-hidden className="size-3" />
          <Text as="span" size="xs">
            2025
          </Text>
        </Inline>
        <Wordmark size="sm" />
      </Inline>
      <Inline gap="lg" align="center" justify="center">
        <Inline gap="lg" align="center">
          <Link asChild tone="neutral">
            <RouterLink to={paths.friendLinks}>
              <FooterLabel>{t('friendLinks')}</FooterLabel>
            </RouterLink>
          </Link>
          <Link asChild tone="neutral">
            <RouterLink to={paths.sponsor}>
              <FooterLabel icon={<Heart className="text-danger-text size-3 fill-current" />}>
                {t('sponsor')}
              </FooterLabel>
            </RouterLink>
          </Link>
        </Inline>
        <Divider orientation="vertical" className="h-4 max-md:hidden" />
        <Inline gap="lg" align="center">
          <Link tone="neutral" href={repositoryUrl} target="_blank" rel="noreferrer">
            <FooterLabel icon={<RiGithubFill className="size-3" />}>GitHub</FooterLabel>
          </Link>
          <Link tone="neutral" href={telegramUrl} target="_blank" rel="noreferrer">
            <FooterLabel icon={<RiTelegram2Fill className="size-3" />}>Telegram</FooterLabel>
          </Link>
          <Link tone="neutral" href={`mailto:${contactEmail}`}>
            <FooterLabel icon={<MessageCircle className="size-3" />}>{t('contact')}</FooterLabel>
          </Link>
        </Inline>
      </Inline>
    </Flex>
  )
}

function FooterLabel({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <Inline as="span" gap="xs" align="center" wrap={false}>
      {icon}
      <Text as="span" size="sm" className="text-inherit">
        {children}
      </Text>
    </Inline>
  )
}
