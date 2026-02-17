'use client'

import {
  Pagination as UIPagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/shionui/Pagination'
import { usePathname } from '@/i18n/navigation.client'
import { useEffect, useRef } from 'react'
import qs from 'qs'

export type ExtraQuery = Record<
  string,
  string | string[] | number | number[] | boolean | boolean[] | undefined
>

export type ContentPaginationProps = {
  currentPage: number
  totalPages: number
  pageParam?: string
  pageSizeParam?: string
  pageSize?: number
  extraQuery?: ExtraQuery | Record<string, any>
  needQsParse?: boolean
  siblingCount?: number
  boundaryCount?: number
  showPrevNext?: boolean
  hideIfSinglePage?: boolean
  size?: 'icon' | 'default'
  className?: string
  onPageChange?: (page: number) => void
  noRouteChange?: boolean
  loading?: boolean
  scrollToTop?: boolean
  scrollContainerSelector?: string
  smoothScroll?: boolean
}

function buildHref(
  basePath: string,
  page: number,
  options: {
    pageParam: string
    pageSizeParam: string
    pageSize?: number
    extraQuery?: ExtraQuery
    needQsParse?: boolean
  },
): string {
  const { pageParam, pageSizeParam, pageSize, extraQuery } = options
  const qObj: Record<string, any> = {
    [pageParam]: page,
  }
  if (typeof pageSize === 'number' && !Number.isNaN(pageSize)) {
    qObj[pageSizeParam] = pageSize
  }
  if (extraQuery && Object.keys(extraQuery).length) {
    Object.assign(qObj, extraQuery)
  }

  const queryString = qs.stringify(qObj, { arrayFormat: 'brackets' })
  return queryString ? `${basePath}?${queryString}` : basePath
}

function computePageItems(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
  boundaryCount: number,
): Array<number | 'ellipsis'> {
  const pages = new Set<number>()

  for (let i = 1; i <= Math.min(boundaryCount, totalPages); i++) {
    pages.add(i)
  }

  for (let i = Math.max(totalPages - boundaryCount + 1, 1); i <= totalPages; i++) {
    pages.add(i)
  }

  const startSibling = Math.max(currentPage - siblingCount, 1)
  const endSibling = Math.min(currentPage + siblingCount, totalPages)
  for (let i = startSibling; i <= endSibling; i++) {
    pages.add(i)
  }

  const sorted = Array.from(pages).sort((a, b) => a - b)

  const withEllipsis: Array<number | 'ellipsis'> = []
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i]
    withEllipsis.push(page)
    const next = sorted[i + 1]
    if (next && next - page > 1) {
      withEllipsis.push('ellipsis')
    }
  }
  return withEllipsis
}

export const Pagination = (props: ContentPaginationProps) => {
  const {
    currentPage,
    totalPages,
    pageParam = 'page',
    pageSizeParam = 'pageSize',
    pageSize,
    extraQuery,
    needQsParse = false,
    siblingCount = 1,
    boundaryCount = 1,
    showPrevNext = true,
    hideIfSinglePage = true,
    size = 'icon',
    className,
    onPageChange,
    noRouteChange = false,
    loading = false,
    scrollToTop = false,
    scrollContainerSelector,
    smoothScroll = true,
  } = props

  const basePath = usePathname()
  const rootRef = useRef<HTMLElement>(null)
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!scrollToTop || !noRouteChange) return
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    const raf = requestAnimationFrame(() => {
      scrollTopIfNeeded()
    })
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, scrollToTop, noRouteChange])

  if (!totalPages || totalPages < 1) {
    if (hideIfSinglePage) return null
  }

  const safeTotalPages = Math.max(1, totalPages)
  const safeCurrentPage = Math.max(1, Math.min(currentPage, safeTotalPages))

  const items = computePageItems(safeCurrentPage, safeTotalPages, siblingCount, boundaryCount)

  const makeHref = (page: number) =>
    buildHref(basePath, page, { pageParam, pageSizeParam, pageSize, extraQuery, needQsParse })

  const isScrollable = (el: Element | null) => {
    if (!el) return false
    const element = el as HTMLElement
    if (element.scrollHeight <= element.clientHeight) return false
    const style = window.getComputedStyle(element)
    return ['auto', 'scroll', 'overlay'].includes(style.overflowY)
  }

  const findScrollableAncestor = (el: Element | null) => {
    let current = el?.parentElement ?? null
    while (current) {
      if (isScrollable(current)) return current
      current = current.parentElement
    }
    return null
  }

  const scrollTopIfNeeded = () => {
    if (!scrollToTop || !noRouteChange) return
    let target: Element | null = null
    if (scrollContainerSelector) {
      const candidates = Array.from(document.querySelectorAll(scrollContainerSelector))
      target = candidates.find(isScrollable) ?? candidates[0] ?? null
      if (target && !isScrollable(target)) {
        target = findScrollableAncestor(target)
      }
    } else {
      target = findScrollableAncestor(rootRef.current)
    }

    if (target && 'scrollTo' in target) {
      ;(target as HTMLElement).scrollTo({ top: 0, behavior: smoothScroll ? 'smooth' : 'auto' })
      return
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: smoothScroll ? 'smooth' : 'auto' })
    }
  }

  return (
    <UIPagination className={className} ref={rootRef}>
      <PaginationContent>
        {showPrevNext && (
          <PaginationItem>
            <PaginationPrevious
              href={makeHref(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1 || loading}
              noRouteChange={noRouteChange}
              onClick={() => {
                if (safeCurrentPage === 1) return
                onPageChange?.(safeCurrentPage - 1)
              }}
            />
          </PaginationItem>
        )}

        {items.map((it, index) =>
          it === 'ellipsis' ? (
            <PaginationItem key={`ellipsis-${index}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={it}>
              <PaginationLink
                href={makeHref(it)}
                isActive={it === safeCurrentPage}
                disabled={loading}
                size={size}
                noRouteChange={noRouteChange}
                onClick={() => {
                  if (it === safeCurrentPage) return
                  onPageChange?.(it)
                }}
              >
                {it}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        {showPrevNext && (
          <PaginationItem>
            <PaginationNext
              href={makeHref(safeCurrentPage + 1)}
              disabled={safeCurrentPage === safeTotalPages || loading}
              noRouteChange={noRouteChange}
              onClick={() => {
                if (safeCurrentPage === safeTotalPages) return
                onPageChange?.(safeCurrentPage + 1)
              }}
            />
          </PaginationItem>
        )}
      </PaginationContent>
    </UIPagination>
  )
}
