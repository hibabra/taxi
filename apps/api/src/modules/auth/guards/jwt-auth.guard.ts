import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

import { IS_PUBLIC_ROUTE } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../types/auth-user.interface';

type GuardRequest = {
  url?: string;
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    if (this.isPublicRoute(context) || this.isPublicDocumentationRoute(context)) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(error: Error | null, user: TUser | false): TUser {
    if (error) {
      throw error;
    }

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return user;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private isPublicDocumentationRoute(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<GuardRequest>();
    const url = request.url ?? '';

    return url.startsWith('/api/docs');
  }
}
