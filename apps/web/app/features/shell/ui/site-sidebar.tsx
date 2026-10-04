import { CloseButton, cn, Flex, Inline, ScrollArea, Stack } from '@hina-ui/react'
import { Link } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { sitePaths, type NavSection, type SidebarMode } from '../shell'
import { useDesktop } from '../use-desktop'
import { AccountMenu } from './account-menu'
import { BrandLogo, Wordmark } from '~/shared/ui/brand'
import { SidebarSection } from './sidebar-section'
import { UploadAction } from './upload-action'

type SiteSidebarProps = {
  sections: NavSection[]
  viewer: Schema<'UserMeDTO'> | null
  mode: SidebarMode
  onClose: () => void
}

export function SiteSidebar({ sections, viewer, mode, onClose }: SiteSidebarProps) {
  const t = useTranslations('shell')
  const locale = useLocale()
  const desktop = useDesktop()
  const rail = desktop && mode === 'rail'
  return (
    <Stack
      as="aside"
      gap="none"
      data-state={rail ? 'rail' : 'expanded'}
      className={cn(
        'h-full min-h-0 overflow-hidden',
        desktop
          ? 'hn-sidebar border-line bg-surface w-64 border-e data-[state=rail]:w-[69px]'
          : 'w-full',
      )}
    >
      <Flex
        align="center"
        gap="sm"
        className={cn(
          'border-line box-content h-14 shrink-0 border-b',
          desktop ? 'ps-[1.125rem] pe-3' : '',
        )}
      >
        <Link to={sitePaths(locale).home} aria-label="Shionlib" className="min-w-0">
          <Inline gap="sm" align="center" className="flex-nowrap">
            <BrandLogo />
            <Flex
              as="span"
              aria-hidden={rail || undefined}
              data-collapsed={rail ? '' : undefined}
              className="hn-sidebar-label"
            >
              <Wordmark />
            </Flex>
          </Inline>
        </Link>
        {!desktop && <CloseButton className="ms-auto" onClick={onClose} />}
      </Flex>
      <Stack gap="none" className={cn('shrink-0 pt-3', desktop && 'px-3')}>
        <UploadAction rail={rail} />
      </Stack>
      <ScrollArea shadow={false} className="min-h-0 flex-1">
        <Stack
          as="nav"
          gap="lg"
          aria-label={t('navigation')}
          className={cn('py-4', desktop && 'px-3')}
        >
          {sections.map(section => (
            <SidebarSection key={section.key} section={section} rail={rail} />
          ))}
        </Stack>
      </ScrollArea>
      <Stack gap="none" className={cn('border-line shrink-0 border-t py-2', desktop && 'px-3')}>
        <AccountMenu viewer={viewer} rail={rail} />
      </Stack>
    </Stack>
  )
}
