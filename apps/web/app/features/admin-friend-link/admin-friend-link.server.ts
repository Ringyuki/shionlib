import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import { readCommand, readForm, routeAction, routeLoader } from '~/shared/route/route.server'
import { linkCommand, logoCommand } from './admin-friend-link.schema'
import { changeLink, loadLinks, uploadLogo } from './admin-friend-link.use-cases'

export function friendLinksLoader(args: LoaderFunctionArgs) {
  return routeLoader(args, loadLinks)
}

export async function friendLinkAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, linkCommand)
  return routeAction(args, api => changeLink(api, change))
}

export async function friendLinkLogoAction(args: ActionFunctionArgs) {
  const { logo } = await readForm(args, logoCommand)
  return routeAction(args, api => uploadLogo(api, logo))
}
