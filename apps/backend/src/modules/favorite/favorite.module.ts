import { Module, forwardRef } from '@nestjs/common'
import { FavoriteService } from './services/favorite.service'
import { FavoriteController } from './controllers/favorite.controller'
import { PrismaService } from '../../prisma.service'
import { HikarinagiModule } from '../hikarinagi/hikarinagi.module'

@Module({
  imports: [forwardRef(() => HikarinagiModule)],
  providers: [FavoriteService, PrismaService],
  controllers: [FavoriteController],
})
export class FavoriteModule {}
