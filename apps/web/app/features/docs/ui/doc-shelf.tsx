import { NavLink, Select, Stack, Text } from '@hina-ui/react'
import { useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { PageLink } from '~/shared/route/page-link'
import { SideColumn } from '~/shared/ui/side-column'
import { docPath, grouped, sameDoc, type DocLink, type DocRef } from '../docs'

type DocShelfProps = {
  shelf: readonly DocLink[]
  current: DocRef
}

const keyOf = (doc: DocRef) => `${doc.category}/${doc.name}`

export function DocShelf({ shelf, current }: DocShelfProps) {
  const t = useTranslations('docs')
  const locale = useLocale()
  const navigate = useNavigate()
  const groups = grouped(shelf)
  return (
    <>
      <Select
        aria-label={t('shelf')}
        value={keyOf(current)}
        onValueChange={value => {
          const doc = shelf.find(entry => keyOf(entry) === value)
          if (doc !== undefined) {
            void navigate(docPath(locale, doc))
          }
        }}
        options={groups.map(group => ({
          label: t(`category.${group.category}`),
          options: group.docs.map(doc => ({ value: keyOf(doc), label: doc.title })),
        }))}
        className="@3xl:hidden"
      />
      <SideColumn className="@max-3xl:hidden">
        <Stack as="nav" gap="md" aria-label={t('shelf')}>
          {groups.map(group => (
            <Stack
              key={group.category}
              gap="xs"
              role="group"
              aria-label={t(`category.${group.category}`)}
            >
              <Text as="span" size="xs" weight="medium" tone="faint" className="px-2.5">
                {t(`category.${group.category}`)}
              </Text>
              {group.docs.map(doc => (
                <NavLink
                  key={doc.name}
                  as={PageLink}
                  href={docPath(locale, doc)}
                  active={sameDoc(doc, current)}
                  className="h-auto min-h-9 py-1.5 whitespace-normal"
                >
                  {doc.title}
                </NavLink>
              ))}
            </Stack>
          ))}
        </Stack>
      </SideColumn>
    </>
  )
}
