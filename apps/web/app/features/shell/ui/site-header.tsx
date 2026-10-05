import { Inline, SidebarTrigger } from '@hina-ui/react'
import { Upload } from 'lucide-react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { SearchPalette, type SearchShortcut } from '~/features/search'
import { BrandLogo, Wordmark } from '~/shared/ui/brand'
import { navSections, sitePaths } from '../shell'
import { LocaleMenu } from './locale-menu'
import { ThemeMenu } from './theme-menu'
import { navIcons } from './nav-icons'

type SiteHeaderProps = {
  viewerId: number | null
}

export function SiteHeader({ viewerId }: SiteHeaderProps) {
  const t = useTranslations('shell')
  const locale = useLocale()
  const paths = sitePaths(locale)
  const entries = navSections(locale, viewerId)
    .flatMap(section => section.entries)
    .filter(entry => entry.key !== 'home')
  const shortcuts: SearchShortcut[] = [
    ...entries.map(entry => ({
      id: entry.key,
      label: t(`nav.${entry.key}`),
      to: entry.to,
      icon: navIcons[entry.key],
    })),
    { id: 'upload', label: t('upload'), to: paths.upload, icon: Upload },
  ]
  return (
    <>
      <SidebarTrigger />
      <Link to={paths.home} aria-label="Shionlib" className="lg:hidden">
        <Inline gap="sm" align="center" className="flex-nowrap">
          <BrandLogo className="size-7" />
          <Wordmark size="sm" className="max-sm:hidden" />
        </Inline>
      </Link>
      <SearchPalette shortcuts={shortcuts} />
      <Inline gap="xs" align="center" className="md:ms-auto">
        <ThemeMenu />
        <LocaleMenu />
      </Inline>
    </>
  )
}
