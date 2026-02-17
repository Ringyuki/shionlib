import { getDocBySlug, getAdjacentDocs } from '@/libs/docs/getDocs'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { DocTOC } from '@/components/docs/content/DocTOC'
import { DocHeader } from '@/components/docs/content/DocHeader'
import { DocNav } from '@/components/docs/content/DocNav'
import { Mdx } from '@/components/docs/content/MDX'
import { DocFooter } from '@/components/docs/content/DocFooter'

export const dynamicParams = false

interface DocsPageProps {
  params: Promise<{ locale: string; slug: string[] }>
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { locale, slug } = await params
  const { prev, next } = getAdjacentDocs(slug.join('/'), locale)
  const { frontmatter, content } = getDocBySlug(slug.join('/'), locale)
  return (
    <div className="flex w-full min-w-0">
      <div className="flex-1 min-w-0 flex flex-col gap-4 px-0 md:px-4">
        <DocHeader frontmatter={frontmatter} />
        <article className="shionlib-prose min-w-0">
          <Mdx source={content} />
        </article>
        <DocFooter slug={slug.join('/')} />
        <DocNav prev={prev} next={next} />
      </div>
      <div className="w-64 hidden lg:block">
        <DocTOC />
      </div>
    </div>
  )
}

export const generateMetadata = createGenerateMetadata(
  async ({ locale, slug }: { locale: string; slug: string[] }) => {
    const realSlug = slug.join('/')
    const { frontmatter } = getDocBySlug(realSlug, locale)
    const title = frontmatter.title || ''
    return {
      path: `/docs/${realSlug}`,
      title,
      description: frontmatter.description || '',
      images: [`/og?l=${locale}&t=${encodeURIComponent(title)}`],
    }
  },
)
