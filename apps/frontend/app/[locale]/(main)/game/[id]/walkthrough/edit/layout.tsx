import { hasLocale } from 'next-intl'
import { routing } from '@/i18n/routing'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { WalkthroughEditHeader } from '@/components/game/walkthrough/edit/EditHeader'
import { Button } from '@/components/shionui/Button'
import Link from 'next/link'
import { Undo2 } from 'lucide-react'

interface WalkthroughEditLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string; id: string }>
}

export default async function WalkthroughEditLayout({
  children,
  params,
}: WalkthroughEditLayoutProps) {
  const t = await getTranslations('Components.Game.Walkthrough.EditLayout')
  const { locale, id } = await params
  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <WalkthroughEditHeader />
          <Link href={`/game/${id}/walkthrough`}>
            <Button
              intent="secondary"
              appearance="ghost"
              size="sm"
              renderIcon={<Undo2 className="size-4" />}
            >
              {t('backToWalkthrough')}
            </Button>
          </Link>
        </div>
      </div>
      {children}
    </div>
  )
}
