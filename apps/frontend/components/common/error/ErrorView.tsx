'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/shionui/Button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/shionui/Card'
import { useRouter, Link } from '@/i18n/navigation.client'

interface ErrorViewProps {
  title?: string
  details?: string
  backText?: string
  showReset?: boolean
  onReset?: () => void
  actionText?: string
}

export default function ErrorView({
  title,
  details,
  backText,
  showReset,
  onReset,
}: ErrorViewProps) {
  const t = useTranslations('Components.Common.Error.ErrorView')
  const router = useRouter()
  return (
    <Card className="w-fit max-w-sm gap-2">
      <CardHeader>
        <CardTitle className="text-xl font-mono! break-all">{title || t('defaultTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 whitespace-pre-wrap wrap-break-word text-sm text-muted-foreground font-mono! flex flex-col gap-1">
          <span>{details || t('defaultDetails')}</span>
          <span>
            {t('hintPrefix')}
            <Link href="/user/settings/site" className="px-1 underline text-primary">
              {t('hintLinkText')}
            </Link>
            {t('hintSuffix')}
          </span>
        </p>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <Button className="w-full" onClick={() => router.back()}>
          {backText || t('back')}
        </Button>
        {showReset ? (
          <Button className="w-full" onClick={onReset}>
            {t('reset')}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  )
}
