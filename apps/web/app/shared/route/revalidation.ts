import type { ShouldRevalidateFunctionArgs } from 'react-router'

export function keptThroughSearch({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs): boolean {
  const searched =
    formMethod === undefined &&
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search !== nextUrl.search
  return searched ? false : defaultShouldRevalidate
}
