import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_PATH } from './auth.constants';
import { AuthService, parseDurationToSeconds } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GroupementLoginDto } from './dto/groupement-login.dto';
import { LoginDto } from './dto/login.dto';
import { AuthTokenResponseDto, AuthUserResponseDto } from './dto/refresh.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { AuthenticatedUser, RefreshTokenRequestUser } from './types/auth-user.interface';

type RefreshCookieSameSite = 'strict' | 'lax' | 'none';

type RefreshCookieOptions = {
  httpOnly: true;
  maxAge: number;
  path: string;
  sameSite: RefreshCookieSameSite;
  secure: boolean;
};

type CookieReply = {
  clearCookie: (name: string, options: { path: string }) => void;
  setCookie: (name: string, value: string, options: RefreshCookieOptions) => void;
};

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Email ou mot de passe invalide' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: CookieReply,
  ): Promise<AuthTokenResponseDto> {
    const session = await this.authService.login(loginDto.email, loginDto.password);
    this.setRefreshCookie(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      tokenType: session.tokenType,
      user: session.user,
    };
  }

  @Public()
  @Post('platform/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Email ou mot de passe invalide' })
  platformLogin(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: CookieReply,
  ): Promise<AuthTokenResponseDto> {
    return this.login(loginDto, response);
  }

  @Public()
  @Post('groupement/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Identifiant chauffeur ou mot de passe invalide' })
  async groupementLogin(
    @Body() loginDto: GroupementLoginDto,
    @Res({ passthrough: true }) response: CookieReply,
  ): Promise<AuthTokenResponseDto> {
    const session = await this.authService.loginWithGroupementIdentifier(
      loginDto.groupementCode,
      loginDto.identifier,
      loginDto.password,
    );
    this.setRefreshCookie(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      tokenType: session.tokenType,
      user: session.user,
    };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthTokenResponseDto })
  @ApiUnauthorizedResponse({ description: 'Refresh token invalide, expiré ou réutilisé' })
  async refresh(
    @CurrentUser() refreshUser: RefreshTokenRequestUser,
    @Res({ passthrough: true }) response: CookieReply,
  ): Promise<AuthTokenResponseDto> {
    const session = await this.authService.refresh(refreshUser);
    this.setRefreshCookie(response, session.refreshToken);

    return {
      accessToken: session.accessToken,
      expiresIn: session.expiresIn,
      tokenType: session.tokenType,
      user: session.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: CookieReply,
  ): Promise<void> {
    await this.authService.logout(user);
    this.clearRefreshCookie(response);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() changePasswordDto: ChangePasswordDto,
    @Res({ passthrough: true }) response: CookieReply,
  ): Promise<void> {
    await this.authService.changePassword(
      user,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
    this.clearRefreshCookie(response);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthUserResponseDto })
  me(@CurrentUser() user: AuthenticatedUser): AuthUserResponseDto {
    return this.authService.me(user);
  }

  private setRefreshCookie(response: CookieReply, refreshToken: string): void {
    response.setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      maxAge: parseDurationToSeconds(this.configService.getOrThrow<string>('jwt.refreshTtl')),
      path: REFRESH_TOKEN_COOKIE_PATH,
      sameSite: this.configService.getOrThrow<RefreshCookieSameSite>('cookie.sameSite'),
      secure: this.configService.getOrThrow<boolean>('cookie.secure'),
    });
  }

  private clearRefreshCookie(response: CookieReply): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  }
}
