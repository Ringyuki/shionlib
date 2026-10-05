import * as v from 'valibot'
import { readCookie } from '~/shared/http/cookie'
import { sidebarCookie, sidebarModes, type SidebarMode } from './shell'

const mode = v.fallback(v.picklist(sidebarModes), 'expanded')

const historyState = v.fallback(v.record(v.string(), v.unknown()), {})

const scrollTop = v.pipe(v.string(), v.toNumber(), v.finite())

export function sidebarModeFrom(cookieHeader: string): SidebarMode {
  return v.parse(mode, readCookie(cookieHeader, sidebarCookie))
}

export function historyStateOf(value: unknown): Record<string, unknown> {
  return v.parse(historyState, value)
}

export function scrollTopOf(value: string | null | undefined): number | undefined {
  const parsed = v.safeParse(scrollTop, value)
  return parsed.success ? parsed.output : undefined
}
