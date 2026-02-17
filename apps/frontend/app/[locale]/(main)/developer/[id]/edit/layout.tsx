import { hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { Button } from '@/components/shionui/Button'
import Link from 'next/link'
import { Undo2 } from 'lucide-react'

interface DeveloperEditLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string; id: string }>
}

export default async function DeveloperEditLayout({ children, params }: DeveloperEditLayoutProps) {
  const t = await getTranslations('Components.Developer.Edit.EditLayout')
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  return (
    <div className="w-full my-4">
      <div className="w-full flex flex-col gap-4 shadow-content-strong bg-card-soft rounded-md p-4">
        <div className="w-full flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold">{t('edit')}</h2>
            <Link href={`/developer/${id}`}>
              <Button
                intent="secondary"
                appearance="ghost"
                size="sm"
                renderIcon={<Undo2 className="size-4" />}
              >
                {t('backToDeveloper')}
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(async ({ id }: { id: string }) => {
  const t = await getTranslations('Pages.Developer.Edit.EditLayout')
  return {
    title: t('title'),
    path: `/developer/${id}/edit`,
    robots: {
      index: false,
      follow: false,
    },
  }
})
