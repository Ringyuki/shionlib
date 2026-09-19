import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { MoyuClient } from './clients/moyu.client'
import { MoyuPatchController } from './controllers/moyu-patch.controller'
import { MoyuPatchService } from './services/moyu-patch.service'

@Module({
  imports: [HttpModule],
  controllers: [MoyuPatchController],
  providers: [MoyuClient, MoyuPatchService],
})
export class MoyuModule {}
