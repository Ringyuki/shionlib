import { AppShell, Container, ScrollTop, type AppShellHandle } from '@hina-ui/react'
import { useRef, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { navSections, type SidebarMode } from '../shell'
import { useMainScrollRestore } from '../use-main-scroll-restore'
import { useShellState } from '../use-shell-state'
import { SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { SiteSidebar } from './site-sidebar'

type SiteShellProps = {
  viewer: Schema<'UserMeDTO'> | null
  sidebar: SidebarMode
  version: string
  children: ReactNode
}

export const mainScrollKey = 'main'

export function SiteShell({ viewer, sidebar, version, children }: SiteShellProps) {
  const locale = useLocale()
  const t = useTranslations('shell')
  const shell = useRef<AppShellHandle>(null)
  const state = useShellState(sidebar)
  useMainScrollRestore(shell, mainScrollKey)
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
            sections={navSections(locale, viewer?.id ?? null)}
            viewer={viewer}
            mode={state.mode}
            onClose={state.closeMobile}
          />
        }
        header={<SiteHeader viewerId={viewer?.id ?? null} />}
      >
        <Container size="xl" className="px-4 py-6 sm:px-6 lg:py-8">
          {children}
          <SiteFooter version={version} />
        </Container>
      </AppShell>
      <ScrollTop target={() => shell.current?.mainViewport} label={t('scrollTop')} />
    </>
  )
}
