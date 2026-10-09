import * as v from 'valibot'
import { readCookie } from '~/shared/http/cookie'
import { sidebarCookie, sidebarModes, type SidebarMode } from './shell'

const mode = v.fallback(v.picklist(sidebarModes), 'expanded')

export function sidebarModeFrom(cookieHeader: string): SidebarMode {
  return v.parse(mode, readCookie(cookieHeader, sidebarCookie))
}
