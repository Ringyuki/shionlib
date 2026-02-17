import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { calcTextCount } from './helpers/text-count'
import type { DocsMetadata, DocsFrontmatter, Doc } from '@/interfaces/contents/docs.interface'

const getDocsRoot = (locale?: string) => {
  const base = path.join(process.cwd(), 'contents')
  if (locale) {
    const localized = path.join(base, locale)
    if (fs.existsSync(localized) && fs.statSync(localized).isDirectory()) {
      return localized
    }
  }
  return base
}

export const getAllDocs = (locale?: string) => {
  const docs: DocsMetadata[] = []

  const traverseDirectory = (currentPath: string, basePath: string = '') => {
    const files = fs.readdirSync(currentPath)

    files.forEach(file => {
      const filePath = path.join(currentPath, file)
      const stat = fs.statSync(filePath)

      if (stat.isDirectory()) {
        traverseDirectory(filePath, path.join(basePath, file))
      } else if (file.endsWith('.mdx')) {
        const fileContents = fs.readFileSync(filePath, 'utf8')
        const { data } = matter(fileContents)

        const slug = path.join(basePath, file.replace(/\.mdx$/, '')).replace(/\\/g, '/')

        docs.push({
          title: data.title,
          banner: data.banner,
          date: data.date ? new Date(data.date).toISOString() : '',
          description: data.description || '',
          text_count: calcTextCount(fileContents, data),
          slug,
        })
      }
    })
  }

  traverseDirectory(getDocsRoot(locale))
  return docs.sort((a, b) => (a.date > b.date ? -1 : 1))
}

export const getDocBySlug = (slug: string, locale?: string): Doc => {
  const realSlug = slug.replace(/\.mdx$/, '')
  const docsRoot = getDocsRoot(locale)
  let fullPath = path.join(docsRoot, `${realSlug}.mdx`)
  // if the file does not exist in the locale directory, try the root directory
  if (!fs.existsSync(fullPath)) {
    fullPath = path.join(getDocsRoot(undefined), `${realSlug}.mdx`)
  }
  const fileContents = fs.readFileSync(fullPath, 'utf8')
  const { data, content } = matter(fileContents)

  return {
    slug: realSlug,
    content,
    frontmatter: data as DocsFrontmatter,
  }
}

export const getAdjacentDocs = (currentSlug: string, locale?: string) => {
  const docs = getAllDocs(locale)
  const currentIndex = docs.findIndex(doc => doc.slug === currentSlug)

  return {
    prev: currentIndex > 0 ? docs[currentIndex - 1] : null,
    next: currentIndex < docs.length - 1 ? docs[currentIndex + 1] : null,
  }
}
