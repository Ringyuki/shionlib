import type { ActionFunctionArgs } from 'react-router'
import { readCommand, routeAction } from '~/shared/route/route.server'
import { issueLinkCommand } from './download.schema'
import { issueDownloadLink } from './download.use-cases'

export async function downloadLinkAction(args: ActionFunctionArgs) {
  const request = await readCommand(args, issueLinkCommand)
  return routeAction(args, api => issueDownloadLink(api, request))
}
