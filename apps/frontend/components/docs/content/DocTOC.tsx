'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { TextQuote } from 'lucide-react'
import { useScrollToElem } from '@/hooks/useScrollToElem'

interface TOCItem {
  id: string
  text: string
  level: number
}

export const DocTOC = () => {
  const t = useTranslations('Components.Docs.Content.DocTOC')
  const [headings, setHeadings] = useState<TOCItem[]>([])
  const [activeId, setActiveId] = useState('')
  const scrollToHeading = useScrollToElem()

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll('article h1, article h2, article h3'),
    ).map(element => ({
      id: element.id,
      text: element.textContent || '',
      level: Number(element.tagName.charAt(1)),
    }))
    setHeadings(elements)

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: '0px 0px -80% 0px' },
    )

    document.querySelectorAll('article h1, article h2, article h3').forEach(heading => {
      observer.observe(heading)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <nav className="sticky top-18 md:top-24">
      <h2 className="mb-4 text-sm font-semibold flex items-center gap-2">
        <TextQuote className="size-4.5" />
        {t('title')}
      </h2>
      <ul className="space-y-2 break-words">
        {headings.map(heading => (
          <li key={heading.id} style={{ paddingLeft: `${(heading.level - 1) * 1}rem` }}>
            <a
              href={`#${heading.id}`}
              onClick={e => {
                e.preventDefault()
                scrollToHeading(heading.id)
              }}
              className={`block py-1 text-sm transition-all duration-200 hover:text-primary-500 ${
                activeId === heading.id
                  ? 'font-medium text-primary-500'
                  : 'text-default-600 dark:text-default-400'
              }`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
