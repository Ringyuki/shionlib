import { test } from '@playwright/test'

test.describe('Auth refresh scenarios', () => {
  test.skip(
    'SSR should recover when access token is missing but refresh token is valid',
    'Requires test-only auth fixtures/API for deterministic cookie setup.',
    async () => {},
  )

  test.skip(
    'SSR should recover when access token payload/header is corrupted',
    'Requires test-only auth fixtures/API for deterministic cookie setup.',
    async () => {},
  )

  test.skip(
    'store should auto-logout when both access and refresh are invalid',
    'Requires deterministic setup and stable login-required selector.',
    async () => {},
  )
})
