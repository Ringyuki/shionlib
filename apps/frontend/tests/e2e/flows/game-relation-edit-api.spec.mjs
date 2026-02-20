import { expect, test } from '@playwright/test'
import { E2E_FIXTURES, loginAndExtractAuthCookies } from '../_helpers/fixtures.mjs'

const expectApiSuccess = async response => {
  if (!response.ok()) {
    const body = await response.text()
    throw new Error(`Expected success response, got ${response.status()}: ${body}`)
  }
  const payload = await response.json()
  expect(payload?.code).toBe(0)
  return payload?.data
}

const expectApiFailure = async response => {
  expect(response.ok()).toBeFalsy()
  const payload = await response.json()
  expect(payload?.code).not.toBe(0)
  return payload
}

const createManualGame = async (request, authHeaders, title) => {
  const data = await expectApiSuccess(
    await request.post('/api/game/create/game', {
      headers: authHeaders,
      data: {
        title_en: title,
        intro_en: 'Created by e2e game relation flow.',
        tags: ['e2e', 'relation-edit'],
        platform: ['pc'],
      },
    }),
  )

  const gameId = Number(data)
  expect(Number.isInteger(gameId)).toBeTruthy()
  return gameId
}

const updateAdminGameStatus = async (request, authHeaders, gameId, status) => {
  await expectApiSuccess(
    await request.patch(`/api/admin/content/games/${gameId}/status`, {
      headers: authHeaders,
      data: {
        status,
      },
    }),
  )
}

const deleteAdminGame = async (request, authHeaders, gameId) => {
  await request.delete(`/api/admin/content/games/${gameId}`, {
    headers: authHeaders,
  })
}

const getAdminUserIdByName = async (request, adminHeaders, userName) => {
  const data = await expectApiSuccess(
    await request.get('/api/admin/users?page=1&pageSize=50&sortBy=id&sortOrder=asc', {
      headers: adminHeaders,
    }),
  )
  const user = data?.items?.find(item => item?.name === userName)
  expect(user?.id).toBeDefined()
  return user.id
}

const updateUserEntityPermissions = async (request, adminHeaders, userId, entity, allowBits) => {
  await expectApiSuccess(
    await request.patch(`/api/admin/users/${userId}/permissions`, {
      headers: adminHeaders,
      data: {
        entity,
        allowBits,
      },
    }),
  )
}

const createDeveloperOnGame = async (request, authHeaders, gameId, name) => {
  await expectApiSuccess(
    await request.post(`/api/game/create/${gameId}/developer`, {
      headers: authHeaders,
      data: {
        developers: [{ name }],
      },
    }),
  )
}

const listGameDevelopers = async (request, authHeaders, gameId) => {
  return await expectApiSuccess(
    await request.get(`/api/edit/game/${gameId}/developers`, {
      headers: authHeaders,
    }),
  )
}

const createCharacterOnGame = async (request, authHeaders, gameId, nameEn) => {
  await expectApiSuccess(
    await request.post(`/api/game/create/${gameId}/character`, {
      headers: authHeaders,
      data: {
        characters: [{ name_en: nameEn }],
      },
    }),
  )
}

const listGameCharacters = async (request, authHeaders, gameId) => {
  return await expectApiSuccess(
    await request.get(`/api/edit/game/${gameId}/characters`, {
      headers: authHeaders,
    }),
  )
}

const listGameCovers = async (request, authHeaders, gameId) => {
  return await expectApiSuccess(
    await request.get(`/api/edit/game/${gameId}/cover`, {
      headers: authHeaders,
    }),
  )
}

const listGameImages = async (request, authHeaders, gameId) => {
  return await expectApiSuccess(
    await request.get(`/api/edit/game/${gameId}/image`, {
      headers: authHeaders,
    }),
  )
}

test.describe('Game relation edit api flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('should edit game developers relations with permission grant/revoke', async ({
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const mutableAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.relation.identifier,
      E2E_FIXTURES.users.relation.password,
    )
    const adminHeaders = { cookie: adminAuth.cookieHeader }
    const mutableHeaders = { cookie: mutableAuth.cookieHeader }

    const mutableUserId = await getAdminUserIdByName(
      request,
      adminHeaders,
      E2E_FIXTURES.users.relation.identifier,
    )

    const gameTitle = `E2E Relation Developer Game ${Date.now()}`
    const gameId = await createManualGame(request, adminHeaders, gameTitle)
    let deleted = false

    try {
      await updateAdminGameStatus(request, adminHeaders, gameId, 2)

      const developerNameA = `E2E Developer A ${Date.now()}`
      const developerNameB = `E2E Developer B ${Date.now()}`
      await createDeveloperOnGame(request, adminHeaders, gameId, developerNameA)
      await createDeveloperOnGame(request, adminHeaders, gameId, developerNameB)

      const initialRelations = await listGameDevelopers(request, adminHeaders, gameId)
      const relationA = initialRelations.find(item => item?.developer?.name === developerNameA)
      const relationB = initialRelations.find(item => item?.developer?.name === developerNameB)
      expect(relationA?.id).toBeDefined()
      expect(relationA?.developer_id).toBeDefined()
      expect(relationB?.id).toBeDefined()
      expect(relationB?.developer_id).toBeDefined()

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [13])

      await expectApiSuccess(
        await request.patch(`/api/game/${gameId}/edit/developers`, {
          headers: mutableHeaders,
          data: {
            developers: [
              {
                id: relationA.id,
                developer_id: relationA.developer_id,
                role: '发行',
              },
            ],
          },
        }),
      )

      const relationsAfterEdit = await listGameDevelopers(request, adminHeaders, gameId)
      const updatedRelationA = relationsAfterEdit.find(item => item?.id === relationA.id)
      expect(updatedRelationA?.role).toBe('发行')

      await expectApiSuccess(
        await request.delete(`/api/game/${gameId}/edit/developers`, {
          headers: mutableHeaders,
          data: {
            ids: [relationB.id],
          },
        }),
      )
      const relationsAfterRemove = await listGameDevelopers(request, adminHeaders, gameId)
      expect(relationsAfterRemove.some(item => item?.id === relationB.id)).toBe(false)

      await expectApiSuccess(
        await request.put(`/api/game/${gameId}/edit/developers`, {
          headers: mutableHeaders,
          data: {
            developers: [{ developer_id: relationB.developer_id, role: '开发' }],
          },
        }),
      )
      const relationsAfterAddBack = await listGameDevelopers(request, adminHeaders, gameId)
      const restoredRelationB = relationsAfterAddBack.find(
        item => item?.developer_id === relationB.developer_id,
      )
      expect(restoredRelationB?.id).toBeDefined()
      expect(restoredRelationB?.role).toBe('开发')

      const gameHistory = await expectApiSuccess(
        await request.get(`/api/edit/game/${gameId}/history?page=1&pageSize=20`),
      )
      const developerRecords = gameHistory?.items?.filter(item =>
        item?.field_changes?.includes('developers'),
      )
      expect(Array.isArray(developerRecords)).toBeTruthy()
      expect(developerRecords.length).toBeGreaterThan(0)

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [])

      const deniedEdit = await request.patch(`/api/game/${gameId}/edit/developers`, {
        headers: mutableHeaders,
        data: {
          developers: [
            {
              id: relationA.id,
              developer_id: relationA.developer_id,
              role: '脚本',
            },
          ],
        },
      })
      const deniedPayload = await expectApiFailure(deniedEdit)
      expect(deniedPayload?.message).toContain('permission')
    } finally {
      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [])
      await deleteAdminGame(request, adminHeaders, gameId)
      deleted = true
    }

    expect(deleted).toBe(true)
  })

  test('should edit game characters relations with permission grant/revoke', async ({
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const mutableAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.relation.identifier,
      E2E_FIXTURES.users.relation.password,
    )
    const adminHeaders = { cookie: adminAuth.cookieHeader }
    const mutableHeaders = { cookie: mutableAuth.cookieHeader }

    const mutableUserId = await getAdminUserIdByName(
      request,
      adminHeaders,
      E2E_FIXTURES.users.relation.identifier,
    )

    const gameTitle = `E2E Relation Character Game ${Date.now()}`
    const gameId = await createManualGame(request, adminHeaders, gameTitle)
    let deleted = false

    try {
      await updateAdminGameStatus(request, adminHeaders, gameId, 2)

      const characterNameA = `E2E Character A ${Date.now()}`
      const characterNameB = `E2E Character B ${Date.now()}`
      await createCharacterOnGame(request, adminHeaders, gameId, characterNameA)
      await createCharacterOnGame(request, adminHeaders, gameId, characterNameB)

      const initialRelations = await listGameCharacters(request, adminHeaders, gameId)
      const relationA = initialRelations.find(item => item?.character?.name_en === characterNameA)
      const relationB = initialRelations.find(item => item?.character?.name_en === characterNameB)
      expect(relationA?.id).toBeDefined()
      expect(relationA?.character_id).toBeDefined()
      expect(relationB?.id).toBeDefined()
      expect(relationB?.character_id).toBeDefined()

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [14])

      await expectApiSuccess(
        await request.patch(`/api/game/${gameId}/edit/characters`, {
          headers: mutableHeaders,
          data: {
            characters: [
              {
                id: relationA.id,
                character_id: relationA.character_id,
                role: 'side',
                actor: 'E2E Voice A',
              },
            ],
          },
        }),
      )

      const relationsAfterEdit = await listGameCharacters(request, adminHeaders, gameId)
      const updatedRelationA = relationsAfterEdit.find(item => item?.id === relationA.id)
      expect(updatedRelationA?.role).toBe('side')
      expect(updatedRelationA?.actor).toBe('E2E Voice A')

      await expectApiSuccess(
        await request.delete(`/api/game/${gameId}/edit/characters`, {
          headers: mutableHeaders,
          data: {
            ids: [relationB.id],
          },
        }),
      )
      const relationsAfterRemove = await listGameCharacters(request, adminHeaders, gameId)
      expect(relationsAfterRemove.some(item => item?.id === relationB.id)).toBe(false)

      await expectApiSuccess(
        await request.put(`/api/game/${gameId}/edit/characters`, {
          headers: mutableHeaders,
          data: {
            characters: [
              {
                character_id: relationB.character_id,
                role: 'appears',
                actor: 'E2E Voice B',
              },
            ],
          },
        }),
      )
      const relationsAfterAddBack = await listGameCharacters(request, adminHeaders, gameId)
      const restoredRelationB = relationsAfterAddBack.find(
        item => item?.character_id === relationB.character_id,
      )
      expect(restoredRelationB?.id).toBeDefined()
      expect(restoredRelationB?.role).toBe('appears')
      expect(restoredRelationB?.actor).toBe('E2E Voice B')

      const gameHistory = await expectApiSuccess(
        await request.get(`/api/edit/game/${gameId}/history?page=1&pageSize=20`),
      )
      const characterRecords = gameHistory?.items?.filter(item =>
        item?.field_changes?.includes('characters'),
      )
      expect(Array.isArray(characterRecords)).toBeTruthy()
      expect(characterRecords.length).toBeGreaterThan(0)

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [])

      const deniedEdit = await request.patch(`/api/game/${gameId}/edit/characters`, {
        headers: mutableHeaders,
        data: {
          characters: [
            {
              id: relationA.id,
              character_id: relationA.character_id,
              role: 'main',
              actor: 'Denied',
            },
          ],
        },
      })
      const deniedPayload = await expectApiFailure(deniedEdit)
      expect(deniedPayload?.message).toContain('permission')
    } finally {
      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [])
      await deleteAdminGame(request, adminHeaders, gameId)
      deleted = true
    }

    expect(deleted).toBe(true)
  })

  test('should edit game covers with permission grant/revoke', async ({ request }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const mutableAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.relation.identifier,
      E2E_FIXTURES.users.relation.password,
    )
    const adminHeaders = { cookie: adminAuth.cookieHeader }
    const mutableHeaders = { cookie: mutableAuth.cookieHeader }

    const mutableUserId = await getAdminUserIdByName(
      request,
      adminHeaders,
      E2E_FIXTURES.users.relation.identifier,
    )

    const gameTitle = `E2E Relation Cover Game ${Date.now()}`
    const gameId = await createManualGame(request, adminHeaders, gameTitle)
    let deleted = false

    try {
      await updateAdminGameStatus(request, adminHeaders, gameId, 2)
      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [11])

      const stamp = Date.now()
      const coverAUrl = `game/${gameId}/cover/e2e-cover-a-${stamp}.webp`
      const coverBUrl = `game/${gameId}/cover/e2e-cover-b-${stamp}.webp`

      await expectApiSuccess(
        await request.put(`/api/game/${gameId}/edit/covers`, {
          headers: mutableHeaders,
          data: {
            covers: [
              {
                language: 'jp',
                type: 'dig',
                url: coverAUrl,
                dims: [640, 960],
                sexual: 0,
                violence: 0,
              },
              {
                language: 'en',
                type: 'pkgfront',
                url: coverBUrl,
                dims: [720, 1024],
                sexual: 1,
                violence: 1,
              },
            ],
          },
        }),
      )

      const coversAfterAdd = await listGameCovers(request, adminHeaders, gameId)
      const coverA = coversAfterAdd.find(item => item?.url === coverAUrl)
      const coverB = coversAfterAdd.find(item => item?.url === coverBUrl)
      expect(coverA?.id).toBeDefined()
      expect(coverB?.id).toBeDefined()

      await expectApiSuccess(
        await request.patch(`/api/game/${gameId}/edit/cover`, {
          headers: mutableHeaders,
          data: {
            id: coverA.id,
            language: 'zh',
            type: 'pkgfront',
            url: coverAUrl,
            dims: [800, 1200],
            sexual: 2,
            violence: 1,
          },
        }),
      )

      const coversAfterEdit = await listGameCovers(request, adminHeaders, gameId)
      const updatedCoverA = coversAfterEdit.find(item => item?.id === coverA.id)
      expect(updatedCoverA?.language).toBe('zh')
      expect(updatedCoverA?.type).toBe('pkgfront')
      expect(updatedCoverA?.dims).toEqual([800, 1200])
      expect(updatedCoverA?.sexual).toBe(2)
      expect(updatedCoverA?.violence).toBe(1)

      const coverCUrl = `game/${gameId}/cover/e2e-cover-c-${stamp}.webp`
      await expectApiSuccess(
        await request.put(`/api/game/${gameId}/edit/covers`, {
          headers: mutableHeaders,
          data: {
            covers: [
              {
                language: 'en',
                type: 'dig',
                url: coverCUrl,
                dims: [640, 960],
                sexual: 0,
                violence: 0,
              },
            ],
          },
        }),
      )

      const coversAfterSecondAdd = await listGameCovers(request, adminHeaders, gameId)
      const addedCoverC = coversAfterSecondAdd.find(item => item?.url === coverCUrl)
      expect(addedCoverC?.id).toBeDefined()
      expect(coversAfterSecondAdd.some(item => item?.id === coverB.id)).toBe(true)

      const gameHistory = await expectApiSuccess(
        await request.get(`/api/edit/game/${gameId}/history?page=1&pageSize=20`),
      )
      const coverRecords = gameHistory?.items?.filter(item =>
        item?.field_changes?.includes('covers'),
      )
      expect(Array.isArray(coverRecords)).toBeTruthy()
      expect(coverRecords.length).toBeGreaterThan(0)

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [])

      const deniedEdit = await request.patch(`/api/game/${gameId}/edit/cover`, {
        headers: mutableHeaders,
        data: {
          id: coverA.id,
          language: 'zh',
          type: 'dig',
          url: coverAUrl,
          dims: [640, 960],
          sexual: 0,
          violence: 0,
        },
      })
      const deniedPayload = await expectApiFailure(deniedEdit)
      expect(deniedPayload?.message).toContain('permission')
    } finally {
      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [])
      await deleteAdminGame(request, adminHeaders, gameId)
      deleted = true
    }

    expect(deleted).toBe(true)
  })

  test('should edit game images with permission grant/revoke', async ({ request }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const mutableAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.relation.identifier,
      E2E_FIXTURES.users.relation.password,
    )
    const adminHeaders = { cookie: adminAuth.cookieHeader }
    const mutableHeaders = { cookie: mutableAuth.cookieHeader }

    const mutableUserId = await getAdminUserIdByName(
      request,
      adminHeaders,
      E2E_FIXTURES.users.relation.identifier,
    )

    const gameTitle = `E2E Relation Image Game ${Date.now()}`
    const gameId = await createManualGame(request, adminHeaders, gameTitle)
    let deleted = false

    try {
      await updateAdminGameStatus(request, adminHeaders, gameId, 2)
      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [12])

      const stamp = Date.now()
      const imageAUrl = `game/${gameId}/image/e2e-image-a-${stamp}.webp`
      const imageBUrl = `game/${gameId}/image/e2e-image-b-${stamp}.webp`

      await expectApiSuccess(
        await request.put(`/api/game/${gameId}/edit/images`, {
          headers: mutableHeaders,
          data: {
            images: [
              {
                url: imageAUrl,
                dims: [1280, 720],
                sexual: 0,
                violence: 0,
              },
              {
                url: imageBUrl,
                dims: [1920, 1080],
                sexual: 1,
                violence: 1,
              },
            ],
          },
        }),
      )

      const imagesAfterAdd = await listGameImages(request, adminHeaders, gameId)
      const imageA = imagesAfterAdd.find(item => item?.url === imageAUrl)
      const imageB = imagesAfterAdd.find(item => item?.url === imageBUrl)
      expect(imageA?.id).toBeDefined()
      expect(imageB?.id).toBeDefined()

      await expectApiSuccess(
        await request.patch(`/api/game/${gameId}/edit/image`, {
          headers: mutableHeaders,
          data: {
            id: imageA.id,
            url: imageAUrl,
            dims: [1600, 900],
            sexual: 2,
            violence: 0,
          },
        }),
      )

      const imagesAfterEdit = await listGameImages(request, adminHeaders, gameId)
      const updatedImageA = imagesAfterEdit.find(item => item?.id === imageA.id)
      expect(updatedImageA?.dims).toEqual([1600, 900])
      expect(updatedImageA?.sexual).toBe(2)
      expect(updatedImageA?.violence).toBe(0)

      const imageCUrl = `game/${gameId}/image/e2e-image-c-${stamp}.webp`
      await expectApiSuccess(
        await request.put(`/api/game/${gameId}/edit/images`, {
          headers: mutableHeaders,
          data: {
            images: [
              {
                url: imageCUrl,
                dims: [1366, 768],
                sexual: 0,
                violence: 1,
              },
            ],
          },
        }),
      )

      const imagesAfterSecondAdd = await listGameImages(request, adminHeaders, gameId)
      const addedImageC = imagesAfterSecondAdd.find(item => item?.url === imageCUrl)
      expect(addedImageC?.id).toBeDefined()
      expect(imagesAfterSecondAdd.some(item => item?.id === imageB.id)).toBe(true)

      const gameHistory = await expectApiSuccess(
        await request.get(`/api/edit/game/${gameId}/history?page=1&pageSize=20`),
      )
      const imageRecords = gameHistory?.items?.filter(item =>
        item?.field_changes?.includes('images'),
      )
      expect(Array.isArray(imageRecords)).toBeTruthy()
      expect(imageRecords.length).toBeGreaterThan(0)

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [])

      const deniedEdit = await request.patch(`/api/game/${gameId}/edit/image`, {
        headers: mutableHeaders,
        data: {
          id: imageA.id,
          url: imageAUrl,
          dims: [1280, 720],
          sexual: 0,
          violence: 0,
        },
      })
      const deniedPayload = await expectApiFailure(deniedEdit)
      expect(deniedPayload?.message).toContain('permission')
    } finally {
      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [])
      await deleteAdminGame(request, adminHeaders, gameId)
      deleted = true
    }

    expect(deleted).toBe(true)
  })
})
