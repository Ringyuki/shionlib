import { NavLink, Select, Stack } from '@hina-ui/react'
import { Download, KeyRound, Link2, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { useLocation } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { InPageLink } from '~/shared/route/in-page-link'
import { useInPageNavigate } from '~/shared/route/use-in-page-navigate'
import { SideColumn } from '~/shared/ui/side-column'
import { sectionAt, sectionPath, sections } from '../settings'
import { sectionFrom } from '../settings.schema'

const icons = {
  personal: UserRound,
  security: ShieldCheck,
  connections: Link2,
  download: Download,
  site: SlidersHorizontal,
  'api-keys': KeyRound,
} as const

export function SectionNav() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const stay = useInPageNavigate()
  const { pathname } = useLocation()
  const current = sectionAt(pathname, locale)
  return (
    <>
      <Select
        aria-label={t('sectionsLabel')}
        value={current}
        onValueChange={value => {
          const section = sectionFrom(value)
          if (section !== undefined) {
            stay(sectionPath(locale, section))
          }
        }}
        options={sections.map(section => ({ value: section, label: t(`section.${section}`) }))}
        className="lg:hidden"
      />
      <SideColumn className="max-lg:hidden">
        <Stack as="nav" gap="xs" aria-label={t('sectionsLabel')}>
          {sections.map(section => {
            const Icon = icons[section]
            return (
              <NavLink
                key={section}
                as={InPageLink}
                href={sectionPath(locale, section)}
                active={section === current}
                icon={<Icon />}
              >
                {t(`section.${section}`)}
              </NavLink>
            )
          })}
        </Stack>
      </SideColumn>
    </>
  )
}
