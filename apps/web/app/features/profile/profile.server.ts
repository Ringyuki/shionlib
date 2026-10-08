import { redirect, type LoaderFunctionArgs } from 'react-router'

export function legacyProfileRedirect({ params }: LoaderFunctionArgs) {
  return redirect(`/${params.lang ?? ''}/user/${params.id ?? ''}`, 301)
}
