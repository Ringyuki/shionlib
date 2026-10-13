import type { AnchorHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router'
import { navigatesHere } from './in-page'
import { usePositionHold } from './use-in-page-navigate'

type InPageLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  prefetch?: LinkProps['prefetch']
}

export function InPageLink({ href, prefetch = 'intent', onClick, ...anchor }: InPageLinkProps) {
  const hold = usePositionHold()
  return (
    <Link
      {...anchor}
      to={href}
      prefetch={prefetch}
      preventScrollReset
      onClick={event => {
        onClick?.(event)
        if (navigatesHere(event, anchor.target)) {
          hold(href)
        }
      }}
    />
  )
}
