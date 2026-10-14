import { createTranslator } from 'use-intl/core'
import { shareImage, type HeadTexts, type PageHead } from '~/shared/seo/seo'
import { breadcrumbs } from '~/shared/seo/structured-data'
import { docPath, docsPath, type Doc, type DocAuthor } from './docs'

export function docHead(doc: Doc, authors: readonly DocAuthor[], texts: HeadTexts): PageHead {
  const { locale, messages } = texts
  const t = createTranslator({ locale, messages, namespace: 'docs' })
  const [author] = authors
  return {
    title: doc.title,
    description: doc.description,
    image: shareImage('/docs', doc.title, {
      title: doc.title,
      description: doc.description,
      category: t(`category.${doc.category}`),
      date: doc.date,
      ...(doc.banner === undefined ? {} : { banner: doc.banner }),
      ...(author === undefined ? {} : { author_name: author.name }),
      ...(author?.avatar ? { author_avatar: author.avatar } : {}),
    }),
    kind: 'article',
    structured: at => [
      {
        '@type': 'Article',
        headline: doc.title,
        description: doc.description,
        datePublished: doc.date,
        mainEntityOfPage: at(docPath(locale, doc)),
        ...(doc.banner === undefined ? {} : { image: doc.banner }),
        ...(author === undefined ? {} : { author: { '@type': 'Person', name: author.name } }),
      },
      breadcrumbs(at, [
        { name: messages.docs.title, path: docsPath(locale) },
        { name: doc.title, path: docPath(locale, doc) },
      ]),
    ],
  }
}
