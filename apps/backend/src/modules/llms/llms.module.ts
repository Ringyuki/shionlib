import { Global, Module } from '@nestjs/common'
import { OpenaiService } from './openai/services/openai.service'

@Global()
@Module({
  providers: [OpenaiService],
  exports: [OpenaiService],
})
export class LLMsModule {}
