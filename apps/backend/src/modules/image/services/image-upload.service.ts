import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../../prisma.service'
import { SmallFileUploadService } from '../../upload/services/small-file-upload.service'

@Injectable()
export class ImageUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smallFileUploadService: SmallFileUploadService,
  ) {}

  async uploadGameCovers() {
    const covers = await this.prisma.gameCover.findMany({
      where: {
        url: {
          startsWith: 'https://',
        },
      },
      select: {
        id: true,
        game_id: true,
        url: true,
      },
    })

    for (const c of covers) {
      const { key } = await this.smallFileUploadService._uploadGameCover(c.game_id, c.url)
      await this.prisma.gameCover.update({
        where: { id: c.id },
        data: { url: key },
      })
    }

    return covers.length
  }

  async uploadGameImages() {
    const images = await this.prisma.gameImage.findMany({
      where: {
        url: {
          startsWith: 'https://',
        },
      },
      select: {
        id: true,
        game_id: true,
        url: true,
      },
    })

    for (const i of images) {
      const { key } = await this.smallFileUploadService._uploadGameImage(i.game_id, i.url)
      await this.prisma.gameImage.update({
        where: { id: i.id },
        data: { url: key },
      })
    }

    return images.length
  }

  async uploadGameCharacterImages() {
    const characters = await this.prisma.gameCharacter.findMany({
      where: {
        image: {
          not: null,
          startsWith: 'https://',
        },
      },
      select: {
        id: true,
        image: true,
      },
    })

    for (const c of characters) {
      const { key } = await this.smallFileUploadService._uploadGameCharacterImage(c.id, c.image!)
      await this.prisma.gameCharacter.update({
        where: { id: c.id },
        data: { image: key },
      })
    }

    return characters.length
  }

  async uploadGameCharacterRelationImages() {
    const relations = await this.prisma.gameCharacterRelation.findMany({
      where: {
        image: {
          not: null,
          startsWith: 'https://',
        },
      },
      select: {
        id: true,
        image: true,
        character_id: true,
      },
    })

    for (const r of relations) {
      const { key } = await this.smallFileUploadService._uploadGameCharacterRelationImage(
        r.character_id,
        r.image!,
      )
      await this.prisma.gameCharacterRelation.update({
        where: { id: r.id },
        data: { image: key },
      })
    }

    return relations.length
  }

  async uploadGameDeveloperImages() {
    const developers = await this.prisma.gameDeveloper.findMany({
      where: {
        logo: {
          not: null,
          startsWith: 'https://',
        },
      },
      select: {
        id: true,
        logo: true,
      },
    })

    for (const d of developers) {
      const { key } = await this.smallFileUploadService._uploadGameDeveloperImage(d.id, d.logo!)
      await this.prisma.gameDeveloper.update({
        where: { id: d.id },
        data: { logo: key },
      })
    }

    return developers.length
  }
}
