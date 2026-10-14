import { siteName, type StructuredData } from './seo'

export type Crumb = { name: string; path: string }

export function breadcrumbs(
  at: (path: string) => string,
  crumbs: readonly Crumb[],
): StructuredData {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: at(crumb.path),
    })),
  }
}

export function website(
  at: (path: string) => string,
  home: string,
  alternateName: string,
): StructuredData {
  return { '@type': 'WebSite', name: siteName, alternateName, url: at(home) }
}

export function organization(at: (path: string) => string, home: string): StructuredData {
  return { '@type': 'Organization', name: siteName, url: at(home), logo: at('/brand/logo.png') }
}
