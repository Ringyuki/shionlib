import { expect } from '@playwright/test'
import { test } from './support/ingress'

const submission = '/resources/auth/sign-up-code.data'
const command = { email: 'not-an-email' }

function siteHost(baseURL: string | undefined) {
  const port = new URL(baseURL ?? 'http://localhost').port
  return port === '' ? 'shionlib.example' : `shionlib.example:${port}`
}

function forwardedOverTls(host: string) {
  return { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Host': host }
}

test.beforeEach(({ apiOrigin }) => {
  test.skip(apiOrigin === undefined, 'a deployed site sits behind its own ingress')
})

test('runs a submission that reached the ingress over https', async ({ request, baseURL }) => {
  const host = siteHost(baseURL)
  const response = await request.post(submission, {
    headers: { ...forwardedOverTls(host), Origin: `https://${host}` },
    data: command,
  })
  expect(response.status()).toBe(422)
})

test('refuses a submission sent from another site', async ({ request, baseURL }) => {
  const response = await request.post(submission, {
    headers: { ...forwardedOverTls(siteHost(baseURL)), Origin: 'https://other.example' },
    data: command,
  })
  expect(response.status()).toBe(400)
})
