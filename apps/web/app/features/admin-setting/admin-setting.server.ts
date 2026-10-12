import { data, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { readCommand, routeAction, routeLazyLoader, routeLoader } from '~/shared/route/route.server'
import { settingCommand, settingNameFrom } from './admin-setting.schema'
import { loadHistory, loadSettings, saveSettings } from './admin-setting.use-cases'

export function settingsLoader(args: LoaderFunctionArgs) {
  return routeLoader(args, loadSettings)
}

export async function settingAction(args: ActionFunctionArgs) {
  const save = await readCommand(args, settingCommand)
  return routeAction(args, api => saveSettings(api, save))
}

export function settingHistoryLoader(args: LoaderFunctionArgs) {
  const name = settingNameFrom(args.url.searchParams.get('name'))
  if (name === undefined) {
    throw data(null, { status: 404 })
  }
  return routeLazyLoader(args, api => loadHistory(api, name))
}
