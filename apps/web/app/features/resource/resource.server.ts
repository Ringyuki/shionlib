import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import {
  deleteCommand,
  editCommand,
  queryId,
  removeFileCommand,
  renameFileCommand,
  reportCommand,
} from './resource.schema'
import {
  deleteResource,
  editResource,
  loadAllowance,
  loadFileHistory,
  loadUploadPage,
  removeFile,
  renameFile,
  reportResource,
} from './resource.use-cases'

export function fileHistoryLoader(args: LoaderFunctionArgs) {
  const fileId = queryId(args.url.searchParams.get('file'))
  if (fileId === undefined) {
    throw data(null, { status: 400 })
  }
  return routeLazyLoader(args, api => loadFileHistory(api, fileId))
}

export function uploadPageLoader(args: LoaderFunctionArgs) {
  const gameId = queryId(args.url.searchParams.get('game'))
  return routeLoader(args, api => loadUploadPage(api, gameId))
}

export function allowanceLoader(args: LoaderFunctionArgs) {
  return routeLazyLoader(args, loadAllowance)
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

export async function renameFileAction(args: ActionFunctionArgs) {
  const rename = await readCommand(args, renameFileCommand)
  return routeAction(args, api => renameFile(api, rename))
}

export async function removeFileAction(args: ActionFunctionArgs) {
  const removal = await readCommand(args, removeFileCommand)
  return routeAction(args, api => removeFile(api, removal))
}
