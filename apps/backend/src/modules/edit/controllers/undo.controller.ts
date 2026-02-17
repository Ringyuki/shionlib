import { Controller, Post, Body, UseGuards, Req, Param, ParseIntPipe } from '@nestjs/common'
import { UndoService } from '../services/undo.service'
import { UndoReqDto } from '../dto/req/undo.req.dto'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RequestWithUser } from '../../../shared/interfaces/auth/request-with-user.interface'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ShionlibUserRoles } from '../../../shared/enums/auth/user-role.enum'
import { RolesGuard } from '../../auth/guards/roles.guard'

@Controller('edit')
export class UndoController {
  constructor(private readonly undoService: UndoService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ShionlibUserRoles.ADMIN)
  @Post(':id/undo')
  async undo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UndoReqDto,
    @Req() req: RequestWithUser,
  ) {
    return this.undoService.undo(id, req, dto)
  }
}
