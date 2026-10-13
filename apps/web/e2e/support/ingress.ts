import { test as base, type BrowserContext } from '@playwright/test'

export type IngressOptions = { apiOrigin: string | undefined }

type IngressFixtures = { secondBrowser: BrowserContext }

const apiPrefix = '/api'

async function reachApi(
  context: BrowserContext,
  baseURL: string | undefined,
  apiOrigin: string | undefined,
) {
  if (apiOrigin === undefined || baseURL === undefined) {
    return
  }
  const site = new URL(baseURL).origin
  await context.route(
    url => url.origin === site && url.pathname.startsWith(`${apiPrefix}/`),
    route => {
      const url = new URL(route.request().url())
      return route.continue({
        url: `${apiOrigin}${url.pathname.slice(apiPrefix.length)}${url.search}`,
      })
    },
  )
}

export const test = base.extend<IngressOptions & IngressFixtures>({
  apiOrigin: [undefined, { option: true }],
  context: async ({ context, baseURL, apiOrigin }, provide) => {
    await reachApi(context, baseURL, apiOrigin)
    await provide(context)
  },
  secondBrowser: async ({ browser, baseURL, apiOrigin }, provide) => {
    const context = await browser.newContext()
    await reachApi(context, baseURL, apiOrigin)
    await provide(context)
    await context.close()
  },
})
