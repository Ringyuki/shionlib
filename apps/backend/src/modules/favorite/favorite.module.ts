import { Module } from '@nestjs/common'
import { FavoriteService } from './services/favorite.service'
import { FavoriteController } from './controllers/favorite.controller'
import { PrismaService } from '../../prisma.service'

@Module({
  providers: [FavoriteService, PrismaService],
  controllers: [FavoriteController],
})
export class FavoriteModule {}
