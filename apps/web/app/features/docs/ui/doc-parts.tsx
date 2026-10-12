import {
  CodeBlock,
  Image,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hina-ui/react'
import { Ellipsis } from 'lucide-react'
import type { MDXComponents } from 'mdx/types'
import { isValidElement, type ComponentProps } from 'react'
import { Link as RouterLink } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { isSitePath, sitePath } from '../docs'
import { pictureSizeFrom } from '../docs.schema'

function DocLink({ href = '', children }: ComponentProps<'a'>) {
  const locale = useLocale()
  if (isSitePath(href)) {
    return (
      <Link asChild>
        <RouterLink to={sitePath(locale, href)} prefetch="intent">
          {children}
        </RouterLink>
      </Link>
    )
  }
  if (href.startsWith('#') || href.startsWith('mailto:')) {
    return <Link href={href}>{children}</Link>
  }
  return (
    <Link href={href} target="_blank" rel="noreferrer">
      {children}
    </Link>
  )
}

function CodeSample({ children }: ComponentProps<'pre'>) {
  const code = isValidElement<ComponentProps<'code'>>(children) ? children.props : undefined
  const lang = code?.className?.replace('language-', '')
  return <CodeBlock code={String(code?.children ?? '').trimEnd()} lang={lang} />
}

function DocTable({ children }: ComponentProps<'table'>) {
  return (
    <Table variant="secondary" hover={false}>
      {children}
    </Table>
  )
}

function DocImage({ src, alt = '', width, height }: ComponentProps<'img'>) {
  const size = pictureSizeFrom({ width, height })
  return (
    <Image
      src={src}
      alt={alt}
      ratio={size === undefined ? undefined : size.width / size.height}
      style={size === undefined ? undefined : { maxWidth: size.width }}
      preview
    />
  )
}

function MenuMark() {
  const t = useTranslations('docs')
  return <Ellipsis role="img" aria-label={t('menu')} className="inline size-4 align-[-0.15em]" />
}

export const docParts: MDXComponents = {
  a: DocLink,
  pre: CodeSample,
  img: DocImage,
  table: DocTable,
  thead: TableHeader,
  tbody: TableBody,
  tr: TableRow,
  th: TableHead,
  td: TableCell,
  Ellipsis: MenuMark,
}
