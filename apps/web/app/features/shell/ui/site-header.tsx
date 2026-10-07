import { Inline, SidebarTrigger } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale } from 'use-intl'
import { SearchPalette } from '~/features/search'
import { UploadTray } from '~/features/upload'
import { BrandLogo, Wordmark } from '~/shared/ui/brand'
import { sitePaths } from '../shell'
import { LocaleMenu } from './locale-menu'
import { ThemeMenu } from './theme-menu'

export function SiteHeader() {
  const paths = sitePaths(useLocale())
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
        <UploadTray />
        <ThemeMenu />
        <LocaleMenu />
      </Inline>
    </>
  )
}
