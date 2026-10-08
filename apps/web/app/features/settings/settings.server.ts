import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { defaultLocale } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { readCommand, readUpload, routeAction } from '~/shared/route/route.server'
import { firstSection, sectionPath } from './settings'
import { bioCommand, nameCommand } from './settings.schema'
import { nameTaken, rename, saveBio, uploadAvatar, uploadCover } from './settings.use-cases'

export function firstSectionRedirect({ params }: LoaderFunctionArgs) {
  return redirect(sectionPath(isLocale(params.lang) ? params.lang : defaultLocale, firstSection))
}

export async function avatarAction(args: ActionFunctionArgs) {
  const file = await readUpload(args, 'avatar')
  return routeAction(args, api => uploadAvatar(api, file))
}

export async function coverAction(args: ActionFunctionArgs) {
  const file = await readUpload(args, 'cover')
  return routeAction(args, api => uploadCover(api, file))
}

export async function nameCheckAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, nameCommand)
  return routeAction(args, api => nameTaken(api, change))
}

export async function nameAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, nameCommand)
  return routeAction(args, api => rename(api, change))
}

export async function bioAction(args: ActionFunctionArgs) {
  const change = await readCommand(args, bioCommand)
  return routeAction(args, api => saveBio(api, change))
}
