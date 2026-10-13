import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router'
import { defaultLocale } from '~/shared/i18n/locale'
import { isLocale } from '~/shared/i18n/locale.schema'
import { keepWithinPages, requestedPage } from '~/shared/route/paging'
import { idParam } from '~/shared/route/params'
import { readForm, routeAction, routeLoader } from '~/shared/route/route.server'
import { openingTab, profilePath, uploadsPageSize } from './profile'
import { profileEdit } from './profile.schema'
import { loadProfile, loadUploads, saveProfile } from './profile.use-cases'

export function legacyProfileRedirect({ params }: LoaderFunctionArgs) {
  return redirect(`/${params.lang ?? ''}/user/${params.id ?? ''}`, 301)
}

export async function uploadsLoader(args: LoaderFunctionArgs) {
  const id = idParam(args.params.id)
  const page = requestedPage(args.url)
  const uploads = await routeLoader(args, api => loadUploads(api, id, page))
  if (uploads.total === 0 && !uploads.own) {
    const opening = openingTab(await routeLoader(args, api => loadProfile(api, id)))
    if (opening !== undefined && opening !== 'uploads') {
      const locale = isLocale(args.params.lang) ? args.params.lang : defaultLocale
      throw redirect(profilePath(locale, id, opening))
    }
  }
  keepWithinPages(args.url, uploads.total, uploadsPageSize)
  return uploads
}

export async function profileEditAction(args: ActionFunctionArgs) {
  const edit = await readForm(args, profileEdit)
  return routeAction(args, api => saveProfile(api, edit))
}
