import { Pencil } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/shionui/Button'
import { getDocBySlug } from '@/libs/docs/getDocs'
import { useLocale } from 'next-intl'
import { useTranslations } from 'next-intl'

const EDIT_BASE_URL = 'https://github.com/Ringyuki/shionlib-frontend/edit/main/contents'

export const DocFooter = ({ slug }: { slug: string }) => {
  const locale = useLocale()
  const t = useTranslations('Components.Docs.Content.DocFooter')
  const { slug: realSlug } = getDocBySlug(slug, locale)
  return (
    <Link href={`${EDIT_BASE_URL}/${locale}/${realSlug}.mdx`} target="_blank">
      <Button
        intent="primary"
        appearance="ghost"
        showRipple={false}
        renderIcon={<Pencil className="size-4" />}
      >
        <span className="inline-block max-w-50 truncate">{t('edit')}</span>
      </Button>
    </Link>
  )
}
