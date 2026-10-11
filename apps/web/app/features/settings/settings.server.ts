import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { defaultLocale } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { readCommand, routeAction } from '~/shared/route/route.server'
import { firstSection, sectionPath } from './settings'
import { nameCommand } from './settings.schema'
import { nameTaken, rename } from './settings.use-cases'

export function firstSectionRedirect({ params }: LoaderFunctionArgs) {
  return redirect(sectionPath(isLocale(params.lang) ? params.lang : defaultLocale, firstSection))
}

export async function nameCheckAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, nameCommand)
  return routeAction(args, api => nameTaken(api, change))
}

export async function nameAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, nameCommand)
  return routeAction(args, api => rename(api, change))
}
