import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'
import type { ResponseCreateParamsWithTools } from 'openai/lib/ResponsesParser'
import type { AllModels } from 'openai/resources/shared'

@Injectable()
export class OpenaiService {
  private readonly openai: OpenAI

  constructor(private readonly configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get('openai.apiKey'),
      baseURL: this.configService.get('openai.baseURL'),
    })
  }

  async parseResponse<Params extends ResponseCreateParamsWithTools>(body: Params) {
    return this.openai.responses.parse(body)
  }

  async moderate(model: AllModels = 'omni-moderation-latest', input: string | string[]) {
    return this.openai.moderations.create({
      model,
      input,
    })
  }
}
