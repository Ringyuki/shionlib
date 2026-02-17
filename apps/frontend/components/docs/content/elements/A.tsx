import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { ReactNode } from 'react'

export const A = ({ href, children }: { href: string; children: ReactNode }) => {
  const isExternal = href.startsWith('http')
  return (
    <Link
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="text-primary-500 hover:text-primary-600 transition-colors inline-flex items-center gap-1"
    >
      {children}
      {isExternal && <ExternalLink className="size-4 mt-0.75" />}
    </Link>
  )
}
