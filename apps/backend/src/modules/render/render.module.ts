import { Module } from '@nestjs/common'
import { LexicalRendererService } from './services/lexical-renderer.service'

@Module({
  providers: [LexicalRendererService],
  exports: [LexicalRendererService],
})
export class RenderModule {}
