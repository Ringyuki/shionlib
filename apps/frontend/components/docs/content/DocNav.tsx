'use client'

import { DocsMetadata } from '@/interfaces/contents/docs.interface'
import { Button } from '@/components/shionui/Button'
import { useRouter } from '@/i18n/navigation.client'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface DocNavProps {
  prev: DocsMetadata | null
  next: DocsMetadata | null
}

export const DocNav = ({ prev, next }: DocNavProps) => {
  const router = useRouter()
  const t = useTranslations('Components.Docs.Content.DocNav')

  return (
    <div className="flex min-w-0 flex-wrap justify-between gap-2 border-t border-border pt-4">
      <Button
        intent="primary"
        appearance="ghost"
        onClick={() => router.push(`/docs/${prev?.slug.split('/').join('/')}`)}
        renderIcon={<ChevronLeftIcon />}
        disabled={!prev}
      >
        <span className="inline-block max-w-50 truncate">{prev?.title || t('prev')}</span>
      </Button>
      <Button
        intent="primary"
        appearance="ghost"
        onClick={() => router.push(`/docs/${next?.slug.split('/').join('/')}`)}
        renderIcon={<ChevronRightIcon />}
        iconPosition="right"
        disabled={!next}
      >
        <span className="inline-block max-w-50 truncate">{next?.title || t('next')}</span>
      </Button>
    </div>
  )
}
