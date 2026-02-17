'use client'

import * as React from 'react'
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from 'lucide-react'

import { cn } from '@/utils/cn'
import { Button } from './Button'
import { useRouter } from '@/i18n/navigation.client'

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn('mx-auto flex w-full justify-center', className)}
      {...props}
    />
  )
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return (
    <ul
      data-slot="pagination-content"
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    />
  )
}

function PaginationItem({ ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

type PaginationLinkProps = {
  href: string
  isActive?: boolean
  disabled?: boolean
  noRouteChange?: boolean
} & Pick<React.ComponentProps<typeof Button>, 'size' | 'className'> &
  Pick<React.ComponentProps<'button'>, 'onClick'> & {
    children?: React.ReactNode
  }

function PaginationLink({
  className,
  isActive,
  size = 'icon',
  href,
  onClick,
  children,
  disabled,
  noRouteChange,
}: PaginationLinkProps) {
  const router = useRouter()
  return (
    <Button
      appearance={isActive ? 'outline' : 'ghost'}
      size={size}
      disabled={disabled}
      className={cn(className)}
      aria-current={isActive ? 'page' : undefined}
      data-slot="pagination-link"
      data-active={isActive}
      onClick={e => {
        onClick?.(e)
        if (e.defaultPrevented) return
        if (!noRouteChange) {
          router.push(href)
        }
      }}
    >
      {children}
    </Button>
  )
}

function PaginationPrevious({
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to previous page"
      size="default"
      className={cn('gap-1 px-2.5 sm:pl-2.5 flex items-center', className)}
      disabled={disabled}
      {...props}
    >
      <ChevronLeftIcon />
    </PaginationLink>
  )
}

function PaginationNext({
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="Go to next page"
      size="default"
      className={cn('gap-1 px-2.5 sm:pr-2.5 flex items-center', className)}
      disabled={disabled}
      {...props}
    >
      <ChevronRightIcon />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
