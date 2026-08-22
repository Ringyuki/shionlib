import { Global, Module, forwardRef } from '@nestjs/common'
import { HikarinagiModule } from '../hikarinagi/hikarinagi.module'
import { MessageService } from './services/message.service'
import { MessageController } from './controllers/message.controller'
import { MessageGateway } from './gateways/message.gateway'
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard'
import { MessageNotifier } from './services/message-notifier.service'
import { MessageQueryService } from './services/message-query.service'

@Global()
@Module({
  imports: [forwardRef(() => HikarinagiModule)],
  controllers: [MessageController],
  providers: [MessageService, MessageGateway, WsJwtGuard, MessageNotifier, MessageQueryService],
  exports: [MessageService],
})
export class MessageModule {}
