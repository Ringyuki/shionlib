import { Global, Module } from '@nestjs/common'
import { VNDBService } from './services/vndb.service'
import { HttpModule } from '@nestjs/axios'

@Global()
@Module({
  imports: [HttpModule],
  providers: [VNDBService],
  exports: [VNDBService],
})
export class VNDBModule {}
