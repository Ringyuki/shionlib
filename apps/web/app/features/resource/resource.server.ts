import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import {
  deleteCommand,
  editCommand,
  nameQueryFrom,
  queryId,
  removeFileCommand,
  renameFileCommand,
  reportCommand,
} from './resource.schema'
import { composeQueryFrom, compositionCommand } from './resource-composition.schema'
import { runCompositionCommand } from './resource-composition.use-cases'
import {
  deleteResource,
  editResource,
  loadAllowance,
  loadFileHistory,
  loadUploadPage,
  previewName,
  readName,
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
  const { searchParams } = args.url
  const query = { gameId: queryId(searchParams.get('game')), ...composeQueryFrom(searchParams) }
  return routeLoader(args, api => loadUploadPage(api, query))
}

export async function compositionAction(args: ActionFunctionArgs) {
  const command = await readCommand(args, compositionCommand)
  return routeAction(args, api => runCompositionCommand(api, command))
}

export function namePreviewLoader(args: LoaderFunctionArgs) {
  const query = nameQueryFrom(args.url.searchParams.get('q'))
  if (query === undefined) {
    throw data(null, { status: 400 })
  }
  return routeLazyLoader(args, api => previewName(api, query))
}

export function nameReadingLoader(args: LoaderFunctionArgs) {
  const fileName = (args.url.searchParams.get('name') ?? '').trim()
  if (fileName === '') {
    throw data(null, { status: 400 })
  }
  return routeLazyLoader(args, api => readName(api, fileName))
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
