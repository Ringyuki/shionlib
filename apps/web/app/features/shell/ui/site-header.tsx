import { Button, Inline, SearchInput, SidebarTrigger } from '@hina-ui/react'
import { Search } from 'lucide-react'
import { Form, Link, useSearchParams } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { sitePaths } from '../shell'
import { BrandLogo, Wordmark } from './brand'
import { LocaleMenu } from './locale-menu'

export function SiteHeader() {
  const t = useTranslations('shell')
  const locale = useLocale()
  const paths = sitePaths(locale)
  const [params] = useSearchParams()
  return (
    <>
      <SidebarTrigger />
      <Link to={paths.home} aria-label="Shionlib" className="lg:hidden">
        <Inline gap="sm" align="center" className="flex-nowrap">
          <BrandLogo className="size-7" />
          <Wordmark className="h-4 max-sm:hidden" />
        </Inline>
      </Link>
      <Form
        method="get"
        action={paths.search}
        role="search"
        className="w-full max-w-md max-md:hidden"
      >
        <SearchInput
          name="q"
          defaultValue={params.get('q') ?? ''}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
        />
      </Form>
      <Inline gap="xs" align="center" className="ms-auto">
        <Button asChild variant="ghost" tone="neutral" iconOnly className="md:hidden">
          <Link to={paths.search} aria-label={t('search')}>
            <Search />
          </Link>
        </Button>
        <LocaleMenu />
      </Inline>
    </>
  )
}
