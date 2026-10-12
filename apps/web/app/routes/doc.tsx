import { DocPage } from '~/features/docs'
import type { Route } from './+types/doc'

export { docLoader as loader } from '~/features/docs/docs.server'

export function meta({ loaderData }: Route.MetaArgs) {
  if (loaderData === undefined) {
    return []
  }
  return [
    { title: `${loaderData.doc.title} | Shionlib` },
    { name: 'description', content: loaderData.doc.description },
  ]
}

export default function DocRoute({ loaderData }: Route.ComponentProps) {
  return (
    <DocPage
      doc={loaderData.doc}
      shelf={loaderData.shelf}
      previous={loaderData.previous}
      next={loaderData.next}
    />
  )
}
