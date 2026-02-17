import { hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { EditTabsNav } from '@/components/game/edit/EditTabsNav'
import { getTranslations } from 'next-intl/server'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { Button } from '@/components/shionui/Button'
import Link from 'next/link'
import { Undo2 } from 'lucide-react'

interface EditLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string; id: string }>
}

export default async function EditLayout({ children, params }: EditLayoutProps) {
  const t = await getTranslations('Components.Game.Edit.EditLayout')
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">{t('edit')}</h2>
          <Link href={`/game/${id}`}>
            <Button
              intent="secondary"
              appearance="ghost"
              size="sm"
              renderIcon={<Undo2 className="size-4" />}
            >
              {t('backToGame')}
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>
      <EditTabsNav />
      {children}
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(async ({ id }: { id: string }) => {
  const t = await getTranslations('Pages.Game.Edit.EditLayout')
  return {
    title: t('title'),
    path: `/game/${id}/edit`,
    robots: {
      index: false,
      follow: false,
    },
  }
})
