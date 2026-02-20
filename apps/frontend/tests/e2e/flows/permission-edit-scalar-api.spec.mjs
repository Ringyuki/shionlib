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
        intro_en: 'Created by e2e permission flow.',
        tags: ['e2e', 'permission'],
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

const getUserEntityPermissions = async (request, adminHeaders, userId, entity) => {
  return await expectApiSuccess(
    await request.get(`/api/admin/users/${userId}/permissions?entity=${entity}`, {
      headers: adminHeaders,
    }),
  )
}

const undoEditRecord = async (request, adminHeaders, editRecordId) => {
  await expectApiSuccess(
    await request.post(`/api/edit/${editRecordId}/undo`, {
      headers: adminHeaders,
      data: {
        mode: 'strict',
        force: false,
        dryRun: false,
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

  const relations = await expectApiSuccess(
    await request.get(`/api/edit/game/${gameId}/developers`, {
      headers: authHeaders,
    }),
  )
  const relation = relations.find(item => item?.developer?.name === name)
  expect(relation?.developer?.id).toBeDefined()
  return relation.developer.id
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

  const relations = await expectApiSuccess(
    await request.get(`/api/edit/game/${gameId}/characters`, {
      headers: authHeaders,
    }),
  )
  const relation = relations.find(item => item?.character?.name_en === nameEn)
  expect(relation?.character?.id).toBeDefined()
  return relation.character.id
}

test.describe('Permission apply/check with scalar edit api flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('should allow scalar edit after permission grant and reject after revoke', async ({
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const mutableAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.permission.identifier,
      E2E_FIXTURES.users.permission.password,
    )
    const adminHeaders = { cookie: adminAuth.cookieHeader }
    const mutableHeaders = { cookie: mutableAuth.cookieHeader }

    const mutableUserId = await getAdminUserIdByName(
      request,
      adminHeaders,
      E2E_FIXTURES.users.permission.identifier,
    )

    const title = `E2E Permission Game ${Date.now()}`
    const gameId = await createManualGame(request, adminHeaders, title)
    let deleted = false

    try {
      await updateAdminGameStatus(request, adminHeaders, gameId, 2)

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [1])
      const permsAfterGrant = await getUserEntityPermissions(
        request,
        adminHeaders,
        mutableUserId,
        'game',
      )
      const titleGroup = permsAfterGrant?.groups?.find(group => group?.bitIndex === 1)
      expect(titleGroup?.enabled).toBe(true)

      const editedTitle = `${title} Allowed`
      await expectApiSuccess(
        await request.patch(`/api/game/${gameId}/edit/scalar`, {
          headers: mutableHeaders,
          data: {
            title_en: editedTitle,
            note: 'e2e permission grant edit',
          },
        }),
      )

      const gameScalarAfterGrant = await expectApiSuccess(
        await request.get(`/api/edit/game/${gameId}/scalar`, {
          headers: adminHeaders,
        }),
      )
      expect(gameScalarAfterGrant?.title_en).toBe(editedTitle)

      const gameHistory = await expectApiSuccess(
        await request.get(`/api/edit/game/${gameId}/history?page=1&pageSize=10`),
      )
      expect(Array.isArray(gameHistory?.items)).toBeTruthy()
      const latestScalarEdit = gameHistory.items.find(
        item => item?.action === 'UPDATE_SCALAR' && item?.field_changes?.includes('title_en'),
      )
      expect(latestScalarEdit?.id).toBeDefined()

      await undoEditRecord(request, adminHeaders, latestScalarEdit.id)

      const gameScalarAfterUndo = await expectApiSuccess(
        await request.get(`/api/edit/game/${gameId}/scalar`, {
          headers: adminHeaders,
        }),
      )
      expect(gameScalarAfterUndo?.title_en).toBe(title)

      const gameHistoryAfterUndo = await expectApiSuccess(
        await request.get(`/api/edit/game/${gameId}/history?page=1&pageSize=10`),
      )
      const undoRecord = gameHistoryAfterUndo?.items?.find(
        item => item?.undo === true && item?.undo_of?.id === latestScalarEdit.id,
      )
      expect(undoRecord?.id).toBeDefined()

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'game', [])

      const deniedEdit = await request.patch(`/api/game/${gameId}/edit/scalar`, {
        headers: mutableHeaders,
        data: {
          title_en: `${title} Denied`,
          note: 'e2e permission revoke edit',
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

  test('should apply developer scalar permission, record history and support undo', async ({
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const mutableAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.permission.identifier,
      E2E_FIXTURES.users.permission.password,
    )
    const adminHeaders = { cookie: adminAuth.cookieHeader }
    const mutableHeaders = { cookie: mutableAuth.cookieHeader }

    const mutableUserId = await getAdminUserIdByName(
      request,
      adminHeaders,
      E2E_FIXTURES.users.permission.identifier,
    )

    const tempGameTitle = `E2E Permission Dev Game ${Date.now()}`
    const gameId = await createManualGame(request, adminHeaders, tempGameTitle)
    let deleted = false

    try {
      await updateAdminGameStatus(request, adminHeaders, gameId, 2)

      const originalName = `E2E Dev ${Date.now()}`
      const developerId = await createDeveloperOnGame(request, adminHeaders, gameId, originalName)

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'developer', [1])
      const permsAfterGrant = await getUserEntityPermissions(
        request,
        adminHeaders,
        mutableUserId,
        'developer',
      )
      const nameGroup = permsAfterGrant?.groups?.find(group => group?.bitIndex === 1)
      expect(nameGroup?.enabled).toBe(true)

      const editedName = `${originalName} Allowed`
      await expectApiSuccess(
        await request.patch(`/api/developer/${developerId}/edit/scalar`, {
          headers: mutableHeaders,
          data: {
            name: editedName,
            note: 'e2e developer permission grant edit',
          },
        }),
      )

      const developerScalarAfterGrant = await expectApiSuccess(
        await request.get(`/api/edit/developer/${developerId}/scalar`, {
          headers: adminHeaders,
        }),
      )
      expect(developerScalarAfterGrant?.name).toBe(editedName)

      const developerHistory = await expectApiSuccess(
        await request.get(`/api/edit/developer/${developerId}/history?page=1&pageSize=10`),
      )
      const latestScalarEdit = developerHistory?.items?.find(
        item => item?.action === 'UPDATE_SCALAR' && item?.field_changes?.includes('name'),
      )
      expect(latestScalarEdit?.id).toBeDefined()

      await undoEditRecord(request, adminHeaders, latestScalarEdit.id)

      const developerScalarAfterUndo = await expectApiSuccess(
        await request.get(`/api/edit/developer/${developerId}/scalar`, {
          headers: adminHeaders,
        }),
      )
      expect(developerScalarAfterUndo?.name).toBe(originalName)

      const developerHistoryAfterUndo = await expectApiSuccess(
        await request.get(`/api/edit/developer/${developerId}/history?page=1&pageSize=10`),
      )
      const undoRecord = developerHistoryAfterUndo?.items?.find(
        item => item?.undo === true && item?.undo_of?.id === latestScalarEdit.id,
      )
      expect(undoRecord?.id).toBeDefined()

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'developer', [])

      const deniedEdit = await request.patch(`/api/developer/${developerId}/edit/scalar`, {
        headers: mutableHeaders,
        data: {
          name: `${originalName} Denied`,
          note: 'e2e developer permission revoke edit',
        },
      })
      const deniedPayload = await expectApiFailure(deniedEdit)
      expect(deniedPayload?.message).toContain('permission')
    } finally {
      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'developer', [])
      await deleteAdminGame(request, adminHeaders, gameId)
      deleted = true
    }

    expect(deleted).toBe(true)
  })

  test('should apply character scalar permission, record history and support undo', async ({
    request,
  }) => {
    const adminAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.admin.identifier,
      E2E_FIXTURES.users.admin.password,
    )
    const mutableAuth = await loginAndExtractAuthCookies(
      request,
      E2E_FIXTURES.users.permission.identifier,
      E2E_FIXTURES.users.permission.password,
    )
    const adminHeaders = { cookie: adminAuth.cookieHeader }
    const mutableHeaders = { cookie: mutableAuth.cookieHeader }

    const mutableUserId = await getAdminUserIdByName(
      request,
      adminHeaders,
      E2E_FIXTURES.users.permission.identifier,
    )

    const tempGameTitle = `E2E Permission Character Game ${Date.now()}`
    const gameId = await createManualGame(request, adminHeaders, tempGameTitle)
    let deleted = false

    try {
      await updateAdminGameStatus(request, adminHeaders, gameId, 2)

      const originalName = `E2E Character ${Date.now()}`
      const characterId = await createCharacterOnGame(request, adminHeaders, gameId, originalName)

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'character', [1])
      const permsAfterGrant = await getUserEntityPermissions(
        request,
        adminHeaders,
        mutableUserId,
        'character',
      )
      const namesGroup = permsAfterGrant?.groups?.find(group => group?.bitIndex === 1)
      expect(namesGroup?.enabled).toBe(true)

      const editedName = `${originalName} Allowed`
      await expectApiSuccess(
        await request.patch(`/api/character/${characterId}/edit/scalar`, {
          headers: mutableHeaders,
          data: {
            name_en: editedName,
            note: 'e2e character permission grant edit',
          },
        }),
      )

      const characterScalarAfterGrant = await expectApiSuccess(
        await request.get(`/api/edit/character/${characterId}/scalar`, {
          headers: adminHeaders,
        }),
      )
      expect(characterScalarAfterGrant?.name_en).toBe(editedName)

      const characterHistory = await expectApiSuccess(
        await request.get(`/api/edit/character/${characterId}/history?page=1&pageSize=10`),
      )
      const latestScalarEdit = characterHistory?.items?.find(
        item => item?.action === 'UPDATE_SCALAR' && item?.field_changes?.includes('name_en'),
      )
      expect(latestScalarEdit?.id).toBeDefined()

      await undoEditRecord(request, adminHeaders, latestScalarEdit.id)

      const characterScalarAfterUndo = await expectApiSuccess(
        await request.get(`/api/edit/character/${characterId}/scalar`, {
          headers: adminHeaders,
        }),
      )
      expect(characterScalarAfterUndo?.name_en).toBe(originalName)

      const characterHistoryAfterUndo = await expectApiSuccess(
        await request.get(`/api/edit/character/${characterId}/history?page=1&pageSize=10`),
      )
      const undoRecord = characterHistoryAfterUndo?.items?.find(
        item => item?.undo === true && item?.undo_of?.id === latestScalarEdit.id,
      )
      expect(undoRecord?.id).toBeDefined()

      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'character', [])

      const deniedEdit = await request.patch(`/api/character/${characterId}/edit/scalar`, {
        headers: mutableHeaders,
        data: {
          name_en: `${originalName} Denied`,
          note: 'e2e character permission revoke edit',
        },
      })
      const deniedPayload = await expectApiFailure(deniedEdit)
      expect(deniedPayload?.message).toContain('permission')
    } finally {
      await updateUserEntityPermissions(request, adminHeaders, mutableUserId, 'character', [])
      await deleteAdminGame(request, adminHeaders, gameId)
      deleted = true
    }

    expect(deleted).toBe(true)
  })
})
