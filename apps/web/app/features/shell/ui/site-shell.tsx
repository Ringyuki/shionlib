import { AppShell, Container, ScrollTop, Stack, type AppShellHandle } from '@hina-ui/react'
import { useRef, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { useFrame } from '~/shared/route/frame'
import { navSections, type SidebarMode } from '../shell'
import { useShellState } from '../use-shell-state'
import { clearOfFooter, SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { SiteSidebar } from './site-sidebar'

type SiteShellProps = {
  viewer: Schema<'UserMeDTO'> | null
  sidebar: SidebarMode
  unread: number
  children: ReactNode
}

export const mainScrollKey = 'main'

export function SiteShell({ viewer, sidebar, unread, children }: SiteShellProps) {
  const locale = useLocale()
  const t = useTranslations('shell')
  const shell = useRef<AppShellHandle>(null)
  const state = useShellState(sidebar)
  const canvas = useFrame() === 'canvas'
  return (
    <>
      <AppShell
        ref={shell}
        restoreKey={mainScrollKey}
        collapsible="rail"
        sidebar={state.mode}
        onSidebarChange={state.changeMode}
        mobileOpen={state.mobileOpen}
        onMobileOpenChange={state.setMobileOpen}
        sidebarContent={
          <SiteSidebar
            sections={navSections(locale, viewer?.id ?? null, unread)}
            viewer={viewer}
            mode={state.mode}
            onClose={state.closeMobile}
          />
        }
        header={<SiteHeader />}
      >
        {canvas ? (
          <Stack gap="none" className="min-h-full">
            {children}
          </Stack>
        ) : (
          <Container size="xl" className="flex min-h-full flex-col px-4 py-6 sm:px-6 lg:py-8">
            <Stack gap="none" className="flex-1">
              {children}
            </Stack>
            <SiteFooter />
          </Container>
        )}
      </AppShell>
      {!canvas && (
        <ScrollTop
          target={() => shell.current?.mainViewport}
          label={t('scrollTop')}
          offset={{ y: 'var(--clear-of-footer)' }}
          className={clearOfFooter}
        />
      )}
    </>
  )
}
