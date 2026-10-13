import { Badge, Inline, SidebarTrigger, Text } from '@hina-ui/react'
import { Bell } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { SearchPalette } from '~/features/search'
import { UploadIndicator } from '~/features/upload'
import { BrandLogo, Wordmark } from '~/shared/ui/brand'
import { Button } from '~/shared/ui/button'
import { sitePaths } from '../shell'
import { LocaleMenu } from './locale-menu'
import { ThemeMenu } from './theme-menu'

type SiteHeaderProps = {
  area: ReactNode
  unread: number
}

export function SiteHeader({ area, unread }: SiteHeaderProps) {
  const t = useTranslations('shell')
  const paths = sitePaths(useLocale())
  if (area !== undefined) {
    return (
      <>
        <SidebarTrigger />
        <Text as="span" weight="semibold" className="lg:hidden">
          {area}
        </Text>
        <SearchPalette />
        <Inline gap="xs" align="center" className="md:ms-auto">
          <Badge content={unread} tone="accent" label={t('unreadCount', { count: unread })}>
            <Button asChild variant="ghost" tone="neutral" iconOnly aria-label={t('nav.messages')}>
              <Link to={paths.messages} prefetch="intent">
                <Bell aria-hidden />
              </Link>
            </Button>
          </Badge>
          <ThemeMenu />
        </Inline>
      </>
    )
  }
  return (
    <>
      <SidebarTrigger />
      <Link to={paths.home} aria-label="Shionlib" className="lg:hidden">
        <Inline gap="sm" align="center" className="flex-nowrap">
          <BrandLogo className="size-7" />
          <Wordmark size="sm" className="max-sm:hidden" />
        </Inline>
      </Link>
      <SearchPalette />
      <Inline gap="xs" align="center" className="md:ms-auto">
        <UploadIndicator to={paths.uploading} />
        <ThemeMenu />
        <LocaleMenu />
      </Inline>
    </>
  )
}
