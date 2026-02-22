import { Body, Controller, Delete, Get, Post, Req, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { PotatoVNBindingService } from '../services/potatovn-binding.service'
import { BindPotatoVNReqDto } from '../dto/req/bind-potatovn.req.dto'

@Controller('potatovn/binding')
@UseGuards(JwtAuthGuard)
export class PotatoVNBindingController {
  constructor(private readonly potatovnBindingService: PotatoVNBindingService) {}

  @Get()
  async getBinding(@Req() req: RequestWithUser) {
    return this.potatovnBindingService.getBinding(req.user.sub)
  }

  @Post()
  async bind(@Body() dto: BindPotatoVNReqDto, @Req() req: RequestWithUser) {
    return this.potatovnBindingService.bind(req.user.sub, dto)
  }

  @Delete()
  async unbind(@Req() req: RequestWithUser) {
    return this.potatovnBindingService.unbind(req.user.sub)
  }
}
