export const E2E_FIXTURES = {
  users: {
    admin: {
      identifier: 'e2e_admin',
      password: 'ShionlibE2E123!',
    },
    login: {
      identifier: 'e2e_user',
      password: 'ShionlibE2E123!',
    },
    mutable: {
      identifier: 'e2e_mutable_user',
      password: 'ShionlibE2E123!',
    },
    permission: {
      identifier: 'e2e_permission_user',
      password: 'ShionlibE2E123!',
    },
    relation: {
      identifier: 'e2e_relation_user',
      password: 'ShionlibE2E123!',
    },
    adminOps: {
      identifier: 'e2e_admin_ops_user',
      password: 'ShionlibE2E123!',
    },
  },
  games: {
    primary: {
      title: 'HAMIDASHI CREATIVE Re:Re:call',
    },
    secondary: {
      title: 'ジュエリー・ハーツ・アカデミア -We will wing wonder world-',
    },
    tertiary: {
      title: 'A Sky Full of Stars',
    },
  },
  comments: {
    root: 'Seeded root comment for E2E.',
  },
}

const readCookieValueFromSetCookie = (setCookie, name) => {
  const [pair] = setCookie.split(';')
  const separatorIndex = pair.indexOf('=')
  if (separatorIndex === -1) {
    return null
  }

  const cookieName = pair.slice(0, separatorIndex).trim()
  if (cookieName !== name) {
    return null
  }

  return pair.slice(separatorIndex + 1)
}

export const getSetCookieHeaders = response =>
  response
    .headersArray()
    .filter(header => header.name.toLowerCase() === 'set-cookie')
    .map(header => header.value)

const findCookieValueInSetCookies = (setCookies, cookieName) => {
  for (const setCookie of setCookies) {
    const value = readCookieValueFromSetCookie(setCookie, cookieName)
    if (value !== null) {
      return value
    }
  }

  throw new Error(`Missing "${cookieName}" in Set-Cookie headers.`)
}

export const loginAndExtractAuthCookies = async (request, identifier, password) => {
  const loginWithIdentifier = async loginIdentifier =>
    request.post('/api/user/login', {
      data: {
        identifier: loginIdentifier,
        password,
      },
    })

  let loginResponse = await loginWithIdentifier(identifier)
  let usedIdentifier = identifier

  // Some flows temporarily update username during the same parallel run.
  // Retry with the seeded email alias to keep login stable.
  if (!loginResponse.ok() && loginResponse.status() === 404 && !identifier.includes('@')) {
    const fallbackIdentifier = `${identifier}@shionlib.local`
    const fallbackResponse = await loginWithIdentifier(fallbackIdentifier)
    if (fallbackResponse.ok()) {
      loginResponse = fallbackResponse
      usedIdentifier = fallbackIdentifier
    }
  }

  if (!loginResponse.ok()) {
    throw new Error(`Failed to login user "${usedIdentifier}": ${loginResponse.status()}`)
  }

  const setCookies = getSetCookieHeaders(loginResponse)
  const accessToken = findCookieValueInSetCookies(setCookies, 'shionlib_access_token')
  const refreshToken = findCookieValueInSetCookies(setCookies, 'shionlib_refresh_token')

  return {
    accessToken,
    refreshToken,
    cookieHeader: `shionlib_access_token=${accessToken}; shionlib_refresh_token=${refreshToken}`,
    setCookies,
  }
}

export const applyAuthCookiesToPageContext = async (page, authCookies) => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3100'
  const origin = new URL(baseUrl)
  const secure = origin.protocol === 'https:'
  const domain = origin.hostname

  await page.context().addCookies([
    {
      name: 'shionlib_access_token',
      value: authCookies.accessToken,
      domain,
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
    },
    {
      name: 'shionlib_refresh_token',
      value: authCookies.refreshToken,
      domain,
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      path: '/',
    },
  ])
}

export const ensureUiLoggedIn = async (page, identifier, password) => {
  const loginButton = page.getByRole('button', { name: /^Log in$/ }).first()
  const deadline = Date.now() + 2500
  let needsLogin = false

  while (Date.now() < deadline) {
    if (await loginButton.isVisible().catch(() => false)) {
      needsLogin = true
      break
    }
    await page.waitForTimeout(120)
  }

  if (!needsLogin) {
    return
  }

  await loginButton.click()
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ state: 'visible' })

  await dialog.getByLabel('Email or username').fill(identifier)
  await dialog.getByLabel('Password').fill(password)

  const loginResponsePromise = page.waitForResponse(response => {
    return response.request().method() === 'POST' && response.url().includes('/api/user/login')
  })
  await dialog.getByRole('button', { name: /^Log in$/ }).click()
  const loginResponse = await loginResponsePromise
  if (!loginResponse.ok()) {
    throw new Error(`UI login failed with status ${loginResponse.status()}`)
  }

  await dialog.waitFor({ state: 'hidden' })
}

export const findGameIdByTitle = async (request, title) => {
  const response = await request.get('/api/game/list', {
    params: {
      page: '1',
      pageSize: '50',
    },
  })

  if (!response.ok()) {
    throw new Error(`Failed to load game list: ${response.status()}`)
  }

  const payload = await response.json()
  if (payload?.code !== 0 || !payload?.data?.items || !Array.isArray(payload.data.items)) {
    throw new Error('Unexpected /api/game/list payload while resolving game id.')
  }

  const game = payload.data.items.find(
    item => item.title_en === title || item.title_zh === title || item.title_jp === title,
  )
  if (!game) {
    throw new Error(`Seeded game title not found in /api/game/list: "${title}"`)
  }

  return game.id
}

export const findFirstCharacterNameByGameId = async (request, gameId) => {
  const response = await request.get(`/api/game/${gameId}/characters`)
  if (!response.ok()) {
    throw new Error(`Failed to load game characters: ${response.status()}`)
  }

  const payload = await response.json()
  const first = payload?.code === 0 ? payload?.data?.characters?.[0]?.character : null
  if (!first) {
    throw new Error(`No character found for game id=${gameId}`)
  }

  return first.name_en || first.name_jp || first.name_zh
}

export const findFirstCharacterByGameId = async (request, gameId) => {
  const response = await request.get(`/api/game/${gameId}/characters`)
  if (!response.ok()) {
    throw new Error(`Failed to load game characters: ${response.status()}`)
  }

  const payload = await response.json()
  const first = payload?.code === 0 ? payload?.data?.characters?.[0]?.character : null
  if (!first || !first.id) {
    throw new Error(`No character found for game id=${gameId}`)
  }

  return {
    id: first.id,
    name: first.name_en || first.name_jp || first.name_zh,
  }
}

export const findFirstDeveloper = async request => {
  const response = await request.get('/api/developer/list', {
    params: {
      page: '1',
      pageSize: '50',
    },
  })

  if (!response.ok()) {
    throw new Error(`Failed to load developer list: ${response.status()}`)
  }

  const payload = await response.json()
  if (payload?.code !== 0 || !payload?.data?.items || !Array.isArray(payload.data.items)) {
    throw new Error('Unexpected /api/developer/list payload while resolving developer.')
  }

  const developer = payload.data.items.find(item => item?.id && item?.name)
  if (!developer) {
    throw new Error('No developer found in /api/developer/list response.')
  }

  return {
    id: developer.id,
    name: developer.name,
  }
}
