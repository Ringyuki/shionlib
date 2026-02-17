import { Module } from '@nestjs/common'
import { B2Service } from './services/b2.service'
import { HttpModule } from '@nestjs/axios'

@Module({
  imports: [HttpModule],
  providers: [B2Service],
  exports: [B2Service],
})
export class B2Module {}
