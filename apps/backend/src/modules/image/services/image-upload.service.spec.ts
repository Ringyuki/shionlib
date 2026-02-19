import { PrismaService } from '../../../prisma.service'
import { SmallFileUploadService } from '../../upload/services/small-file-upload.service'
import { ImageUploadService } from './image-upload.service'

describe('ImageUploadService', () => {
  function createService() {
    const prisma = {
      gameCover: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      gameImage: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      gameCharacter: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      gameCharacterRelation: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      gameDeveloper: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    } as unknown as PrismaService

    const uploadService = {
      _uploadGameCover: jest.fn(),
      _uploadGameImage: jest.fn(),
      _uploadGameCharacterImage: jest.fn(),
      _uploadGameCharacterRelationImage: jest.fn(),
      _uploadGameDeveloperImage: jest.fn(),
    } as unknown as SmallFileUploadService

    const service = new ImageUploadService(prisma, uploadService)

    return {
      service,
      prisma,
      uploadService,
    }
  }

  it('uploadGameCovers uploads and updates all remote covers', async () => {
    const { service, prisma, uploadService } = createService()
    ;(prisma.gameCover.findMany as jest.Mock).mockResolvedValue([
      { id: 1, game_id: 11, url: 'https://a/1.jpg' },
      { id: 2, game_id: 22, url: 'https://a/2.jpg' },
    ])
    ;(uploadService._uploadGameCover as jest.Mock)
      .mockResolvedValueOnce({ key: 'covers/11.jpg' })
      .mockResolvedValueOnce({ key: 'covers/22.jpg' })

    const count = await service.uploadGameCovers()

    expect(prisma.gameCover.findMany).toHaveBeenCalledWith({
      where: { url: { startsWith: 'https://' } },
      select: { id: true, game_id: true, url: true },
    })
    expect(uploadService._uploadGameCover).toHaveBeenNthCalledWith(1, 11, 'https://a/1.jpg')
    expect(uploadService._uploadGameCover).toHaveBeenNthCalledWith(2, 22, 'https://a/2.jpg')
    expect(prisma.gameCover.update).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: { url: 'covers/11.jpg' },
    })
    expect(prisma.gameCover.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: { url: 'covers/22.jpg' },
    })
    expect(count).toBe(2)
  })

  it('uploadGameImages uploads and updates all remote images', async () => {
    const { service, prisma, uploadService } = createService()
    ;(prisma.gameImage.findMany as jest.Mock).mockResolvedValue([
      { id: 3, game_id: 33, url: 'https://a/3.jpg' },
    ])
    ;(uploadService._uploadGameImage as jest.Mock).mockResolvedValue({ key: 'images/33.jpg' })

    const count = await service.uploadGameImages()

    expect(uploadService._uploadGameImage).toHaveBeenCalledWith(33, 'https://a/3.jpg')
    expect(prisma.gameImage.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { url: 'images/33.jpg' },
    })
    expect(count).toBe(1)
  })

  it('uploadGameCharacterImages uploads and updates all character images', async () => {
    const { service, prisma, uploadService } = createService()
    ;(prisma.gameCharacter.findMany as jest.Mock).mockResolvedValue([
      { id: 4, image: 'https://a/4.jpg' },
    ])
    ;(uploadService._uploadGameCharacterImage as jest.Mock).mockResolvedValue({
      key: 'chars/4.jpg',
    })

    const count = await service.uploadGameCharacterImages()

    expect(uploadService._uploadGameCharacterImage).toHaveBeenCalledWith(4, 'https://a/4.jpg')
    expect(prisma.gameCharacter.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: { image: 'chars/4.jpg' },
    })
    expect(count).toBe(1)
  })

  it('uploadGameCharacterRelationImages uploads and updates relation images', async () => {
    const { service, prisma, uploadService } = createService()
    ;(prisma.gameCharacterRelation.findMany as jest.Mock).mockResolvedValue([
      { id: 5, character_id: 55, image: 'https://a/5.jpg' },
    ])
    ;(uploadService._uploadGameCharacterRelationImage as jest.Mock).mockResolvedValue({
      key: 'relations/5.jpg',
    })

    const count = await service.uploadGameCharacterRelationImages()

    expect(uploadService._uploadGameCharacterRelationImage).toHaveBeenCalledWith(
      55,
      'https://a/5.jpg',
    )
    expect(prisma.gameCharacterRelation.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { image: 'relations/5.jpg' },
    })
    expect(count).toBe(1)
  })

  it('uploadGameDeveloperImages uploads and updates developer logos', async () => {
    const { service, prisma, uploadService } = createService()
    ;(prisma.gameDeveloper.findMany as jest.Mock).mockResolvedValue([
      { id: 6, logo: 'https://a/6.jpg' },
    ])
    ;(uploadService._uploadGameDeveloperImage as jest.Mock).mockResolvedValue({
      key: 'devs/6.jpg',
    })

    const count = await service.uploadGameDeveloperImages()

    expect(uploadService._uploadGameDeveloperImage).toHaveBeenCalledWith(6, 'https://a/6.jpg')
    expect(prisma.gameDeveloper.update).toHaveBeenCalledWith({
      where: { id: 6 },
      data: { logo: 'devs/6.jpg' },
    })
    expect(count).toBe(1)
  })

  it('returns 0 when no cover needs upload', async () => {
    const { service, prisma, uploadService } = createService()
    ;(prisma.gameCover.findMany as jest.Mock).mockResolvedValue([])

    const count = await service.uploadGameCovers()

    expect(uploadService._uploadGameCover).not.toHaveBeenCalled()
    expect(prisma.gameCover.update).not.toHaveBeenCalled()
    expect(count).toBe(0)
  })
})
