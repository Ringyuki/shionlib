import { AppShell, Container, Flex, ScrollTop, Stack, type AppShellHandle } from '@hina-ui/react'
import { useRef, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import type { Schema } from '~/shared/api/types'
import { BackdropSlot } from '~/shared/ui/backdrop'
import { navSections, type ShellArea, type SidebarMode } from '../shell'
import { useShellState } from '../use-shell-state'
import { NavigationProgress } from './navigation-progress'
import { clearOfFooter, SiteFooter } from './site-footer'
import { SiteHeader } from './site-header'
import { SiteSidebar } from './site-sidebar'

type SiteShellProps = {
  viewer: Schema<'UserMeDTO'> | null
  sidebar: SidebarMode
  unread: number
  area?: ShellArea<ReactNode>
  sidebarEnd?: (rail: boolean) => ReactNode
  children: ReactNode
}

export const mainScrollKey = 'main'

export function SiteShell({ viewer, sidebar, unread, area, sidebarEnd, children }: SiteShellProps) {
  const locale = useLocale()
  const t = useTranslations('shell')
  const shell = useRef<AppShellHandle>(null)
  const state = useShellState(sidebar)
  const [backdrop, setBackdrop] = useState<HTMLElement | null>(null)
  return (
    <>
      <NavigationProgress />
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
            area={area}
            viewer={viewer}
            mode={state.mode}
            end={sidebarEnd}
            onClose={state.closeMobile}
          />
        }
        header={<SiteHeader area={area?.title} unread={unread} />}
      >
        <BackdropSlot value={backdrop}>
          <Flex aria-hidden className="sticky top-0 h-0 max-md:hidden">
            <Flex
              ref={setBackdrop}
              className="absolute inset-x-0 top-0 h-[calc(100dvh-var(--hn-app-shell-header-h))] overflow-hidden"
            />
          </Flex>
          <Flex className="relative min-h-full flex-col">
            <Container size="xl" className="flex flex-1 flex-col px-4 pt-6 sm:px-6 lg:pt-8">
              <Stack gap="none" className="flex-1">
                {children}
              </Stack>
            </Container>
            {area === undefined ? (
              <Flex className="bg-canvas mt-10">
                <Container size="xl" className="px-4 pt-6 pb-6 sm:px-6 lg:pb-8">
                  <SiteFooter />
                </Container>
              </Flex>
            ) : (
              <Flex className="h-6 shrink-0 lg:h-8" />
            )}
          </Flex>
        </BackdropSlot>
      </AppShell>
      <ScrollTop
        target={() => shell.current?.mainViewport}
        label={t('scrollTop')}
        offset={{ y: 'var(--clear-of-footer)' }}
        className={clearOfFooter}
      />
    </>
  )
}
