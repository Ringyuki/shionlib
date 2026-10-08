import { NavLink, Select, Stack } from '@hina-ui/react'
import { Download, Link2, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { InPageLink, keepScroll } from '~/features/shell'
import { sectionAt, sectionPath, sections } from '../settings'
import { sectionFrom } from '../settings.schema'

const icons = {
  personal: UserRound,
  security: ShieldCheck,
  connections: Link2,
  download: Download,
  site: SlidersHorizontal,
} as const

export function SectionNav() {
  const t = useTranslations('settings')
  const locale = useLocale()
  const navigate = useNavigate()
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
            void navigate(sectionPath(locale, section), { state: keepScroll })
          }
        }}
        options={sections.map(section => ({ value: section, label: t(`section.${section}`) }))}
        className="lg:hidden"
      />
      <Stack as="nav" gap="xs" aria-label={t('sectionsLabel')} className="max-lg:hidden">
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
    </>
  )
}
