import type { ReactNode } from 'react'
import { useMatches } from 'react-router'
import type { ShellArea } from './shell'

const areas = new Map<unknown, ShellArea<ReactNode>>()

export function shellAreaHandle(area: ShellArea<ReactNode>): object {
  const handle = {}
  areas.set(handle, area)
  return handle
}

export function useShellArea(): ShellArea<ReactNode> | undefined {
  const loaded = useMatches().find(
    match => match.loaderData !== undefined && areas.has(match.handle),
  )
  return loaded === undefined ? undefined : areas.get(loaded.handle)
}
