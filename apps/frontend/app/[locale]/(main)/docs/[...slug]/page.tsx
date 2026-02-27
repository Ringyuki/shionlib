import { getDocBySlug, getAdjacentDocs } from '@/libs/docs/getDocs'
import { createGenerateMetadata } from '@/libs/seo/metadata'
import { DocTOC } from '@/components/docs/content/DocTOC'
import { DocHeader } from '@/components/docs/content/DocHeader'
import { DocNav } from '@/components/docs/content/DocNav'
import { Mdx } from '@/components/docs/content/MDX'
import { DocFooter } from '@/components/docs/content/DocFooter'
import { notFound } from 'next/navigation'
import { DocsFrontmatter } from '@/interfaces/contents/docs.interface'

export const dynamicParams = false

interface DocsPageProps {
  params: Promise<{ locale: string; slug: string[] }>
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { locale, slug } = await params
  const { prev, next } = getAdjacentDocs(slug.join('/'), locale)
  let frontmatter: DocsFrontmatter
  let content: string
  try {
    const { frontmatter: _frontmatter, content: _content } = getDocBySlug(slug.join('/'), locale)
    frontmatter = _frontmatter
    content = _content
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      notFound()
    }
    throw error
  }
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
    }
  },
)
