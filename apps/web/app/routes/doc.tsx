import { DocPage, docHead } from '~/features/docs'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/doc'

export { docLoader as loader } from '~/features/docs/docs.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(
    args,
    args.loaderData && docHead(args.loaderData.doc, args.loaderData.authors, lang.loaderData),
  )
}

export default function DocRoute({ loaderData }: Route.ComponentProps) {
  return (
    <DocPage
      doc={loaderData.doc}
      authors={loaderData.authors}
      previous={loaderData.previous}
      next={loaderData.next}
    />
  )
}
