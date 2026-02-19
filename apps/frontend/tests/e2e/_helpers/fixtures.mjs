export const E2E_FIXTURES = {
  users: {
    login: {
      identifier: 'e2e_user',
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
      title: 'この大空に、翼をひろげて FLIGHT DIARY',
    },
  },
  comments: {
    root: 'Seeded root comment for E2E.',
  },
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
