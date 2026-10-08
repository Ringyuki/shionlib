import type { AnchorHTMLAttributes } from 'react'
import { Link } from 'react-router'
import { keepScroll } from '../shell'

type InPageLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string }

export function InPageLink({ href, ...anchor }: InPageLinkProps) {
  return <Link {...anchor} to={href} state={keepScroll} preventScrollReset prefetch="intent" />
}
