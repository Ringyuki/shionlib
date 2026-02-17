import { Module } from '@nestjs/common'
import { CommentController } from './controllers/comment.controller'
import { CommentServices } from './services/comment.service'
import { RenderModule } from '../render/render.module'
import { ModerateModule } from '../moderate/moderate.module'

@Module({
  controllers: [CommentController],
  providers: [CommentServices],
  imports: [RenderModule, ModerateModule],
})
export class CommentModule {}
