import { INestApplication } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import request from 'supertest'
import { requestId } from '../../src/common/middlewares/request-id.middleware'
import { CharacterController } from '../../src/modules/character/controllers/character.controller'
import { CharacterService } from '../../src/modules/character/services/character.service'

describe('Character (integration)', () => {
  let app: INestApplication

  const characterService = {
    getList: jest.fn(),
    getCharacter: jest.fn(),
    deleteById: jest.fn(),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CharacterController],
      providers: [{ provide: CharacterService, useValue: characterService }],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(requestId())
    await app.init()
  })

  afterAll(async () => {
    if (app) await app.close()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('GET /character/list forwards query', async () => {
    characterService.getList.mockResolvedValueOnce({ items: [], meta: { totalItems: 0 } })

    const res = await request(app.getHttpServer())
      .get('/character/list')
      .query({ page: 2, pageSize: 10, name: 'char' })
      .expect(200)

    expect(res.headers['shionlib-request-id']).toBeDefined()
    expect(characterService.getList).toHaveBeenCalledWith(
      expect.objectContaining({ page: '2', pageSize: '10', name: 'char' }),
    )
  })

  it('GET /character/:id and DELETE /character/:id dispatch service calls', async () => {
    characterService.getCharacter.mockResolvedValueOnce({ id: 9 })
    characterService.deleteById.mockResolvedValueOnce({ deleted: true })

    const getRes = await request(app.getHttpServer()).get('/character/9').expect(200)
    expect(getRes.body).toEqual({ id: 9 })
    expect(characterService.getCharacter).toHaveBeenCalledWith(9)

    const delRes = await request(app.getHttpServer()).delete('/character/9').expect(200)
    expect(delRes.body).toEqual({ deleted: true })
    expect(characterService.deleteById).toHaveBeenCalledWith(9)
  })

  it('returns 400 for invalid id params', async () => {
    await request(app.getHttpServer()).get('/character/not-a-number').expect(400)
    await request(app.getHttpServer()).delete('/character/not-a-number').expect(400)

    expect(characterService.getCharacter).not.toHaveBeenCalled()
    expect(characterService.deleteById).not.toHaveBeenCalled()
  })
})
