import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLoader } from '~/shared/route/route.server'
import { deleteCommand, editCommand, fileParam, reportCommand } from './resource.schema'
import { deleteResource, editResource, loadFileHistory, reportResource } from './resource.use-cases'

export function fileHistoryLoader(args: LoaderFunctionArgs) {
  const fileId = fileParam(new URL(args.request.url).searchParams.get('file'))
  if (fileId === undefined) {
    throw data(null, { status: 400 })
  }
  return routeLoader(args, api => loadFileHistory(api, fileId))
}

export async function reportResourceAction(args: ActionFunctionArgs) {
  const report = await readCommand(args, reportCommand)
  return routeAction(args, api => reportResource(api, report))
}

export async function editResourceAction(args: ActionFunctionArgs) {
  const edit = await readCommand(args, editCommand)
  return routeAction(args, api => editResource(api, edit))
}

export async function deleteResourceAction(args: ActionFunctionArgs) {
  const deletion = await readCommand(args, deleteCommand)
  return routeAction(args, api => deleteResource(api, deletion))
}
