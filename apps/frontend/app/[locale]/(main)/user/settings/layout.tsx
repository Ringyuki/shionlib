import { Props } from '@/i18n/types/props'
import { hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { UserSettingsTabsNav } from '@/components/user/settings/TabsNav'
import { createGenerateMetadata } from '@/libs/seo/metadata'

export default async function UserSettingsLayout({ children, params }: Readonly<Props>) {
  const t = await getTranslations('Pages.User.Settings')
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }
  return (
    <div className="w-full my-4">
      <div className="w-full flex flex-col gap-4 shadow-content-strong bg-card-soft rounded-md p-4">
        <div className="w-full flex flex-col gap-4">
          <h2 className="text-2xl font-bold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <UserSettingsTabsNav />
        {children}
      </div>
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(async () => {
  const t = await getTranslations('Pages.User.Settings')
  return {
    title: t('title'),
    path: `/user/settings`,
    robots: {
      index: false,
      follow: false,
    },
  }
})
