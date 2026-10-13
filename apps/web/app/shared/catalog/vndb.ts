const vndbSite = 'https://vndb.org'

export function vndbUrl(path: string): string {
  return `${vndbSite}/${path.replace(/^\//, '')}`
}
