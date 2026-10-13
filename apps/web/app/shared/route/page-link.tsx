import type { AnchorHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'

type PageLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  prefetch?: LinkProps['prefetch']
}

export function PageLink({ href, prefetch = 'intent', ...anchor }: PageLinkProps) {
  return <Link {...anchor} to={href} prefetch={prefetch} />
}
