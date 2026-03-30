import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtRefreshGuard } from '../../common/guards/jwt-refresh.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentAdmin } from '../../common/decorators/current-admin.decorator';
import { AdminJwtPayload, RefreshTokenPayload } from '../../common/types/request.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const { admin, accessToken, refreshToken } = await this.authService.login(
      dto.email,
      dto.password,
      req.ip,
      req.get('user-agent'),
    );
    // Return AuthenticatedAdminDto shape: { ...admin, tokens }
    return {
      ...admin,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentAdmin() admin: AdminJwtPayload) {
    await this.authService.logout(admin.sub);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request & { user: RefreshTokenPayload & { refreshToken: string } },
  ) {
    return this.authService.refreshTokens(req.user.sub, req.user.refreshToken);
  }

  @Get('me')
  async me(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.authService.validateAdmin(admin.sub);
  }
}
