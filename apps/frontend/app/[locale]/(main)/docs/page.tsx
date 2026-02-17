import { getAllDocs } from '@/libs/docs/getDocs'
import { DocCard } from '@/components/docs/DocCard'
import { Masonry } from '@/components/common/shared/Masonry'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { getTranslations } from 'next-intl/server'

interface DocsPageProps {
  params: Promise<{ locale: string }>
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { locale } = await params
  const docs = getAllDocs(locale)
  return (
    <Masonry
      columnCountBreakpoints={{ default: 1, sm: 2, md: 3, lg: 3 }}
      rowGap={8}
      className="px-4 md:px-0"
    >
      {docs.map(doc => (
        <div key={doc.slug} className="break-inside-avoid">
          <DocCard doc={doc} />
        </div>
      ))}
    </Masonry>
  )
}

export const generateMetadata = createGenerateMetadata(async () => {
  const t = await getTranslations('Docs.Head')
  return {
    title: t('title'),
    path: '/docs',
  }
})
