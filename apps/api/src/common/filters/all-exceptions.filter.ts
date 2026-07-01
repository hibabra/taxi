import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Mapping HTTP status → code d'erreur par défaut.
 *
 * Ces valeurs sont volontairement définies localement car le `tsconfig.json`
 * de l'API utilise `moduleResolution: "nodenext"` qui ne résout pas les exports
 * `.ts` source de `@taxikiwi/shared-config`. La source de vérité reste
 * `packages/shared-config/src/errors.ts` — garder ces valeurs synchronisées.
 */
const ERROR_CODES_BY_STATUS: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.GONE]: 'GONE',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

type HttpErrorResponse =
  | string
  | { message?: string | string[]; error?: string; code?: string; details?: unknown[] };

type ErrorPayload = {
  statusCode: number;
  code: string;
  message: string;
  details: unknown[];
  timestamp: string;
  path: string;
  requestId?: string;
};

type HttpRequest = {
  id?: string;
  method?: string;
  originalUrl?: string;
  url?: string;
};

type HttpReply = {
  status: (statusCode: number) => {
    send: (payload: ErrorPayload) => unknown;
  };
};

/**
 * Filtre global d'exceptions avec injection de dépendances.
 *
 * Enregistré via `APP_FILTER` dans AppModule (et non `app.useGlobalFilters()`)
 * pour bénéficier de l'injection NestJS et du logger Pino structuré.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction: boolean;

  constructor(
    @Inject(ConfigService)
    configService: ConfigService,
  ) {
    this.isProduction = configService.get<string>('env') === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<HttpRequest>();
    const reply = ctx.getResponse<HttpReply>();
    const normalized = this.normalize(exception);
    const payload = {
      ...normalized,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url ?? '',
      requestId: request.id,
    };

    this.logException(exception, request, payload);
    reply.status(normalized.statusCode).send(payload);
  }

  private normalize(exception: unknown): Omit<ErrorPayload, 'timestamp' | 'path' | 'requestId'> {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse() as HttpErrorResponse;
      const fallbackMessage = exception.message || 'Une erreur HTTP est survenue';

      if (typeof response === 'string') {
        return {
          statusCode,
          code: this.codeFromStatus(statusCode),
          message: response || fallbackMessage,
          details: [],
        };
      }

      const responseMessage = response.message ?? fallbackMessage;

      return {
        statusCode,
        code: response.code ?? this.codeFromStatus(statusCode),
        message: Array.isArray(responseMessage)
          ? 'La requête contient des erreurs de validation'
          : responseMessage,
        details: Array.isArray(response.details)
          ? response.details
          : Array.isArray(responseMessage)
            ? responseMessage.map((reason) => ({ reason }))
            : [],
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: !this.isProduction
        ? this.messageFromUnknown(exception)
        : 'Une erreur interne est survenue',
      details: !this.isProduction ? [{ reason: this.messageFromUnknown(exception) }] : [],
    };
  }

  private codeFromStatus(statusCode: number): string {
    return ERROR_CODES_BY_STATUS[statusCode] ?? 'HTTP_ERROR';
  }

  private logException(exception: unknown, request: HttpRequest, payload: ErrorPayload): void {
    const context = {
      code: payload.code,
      method: request.method,
      path: payload.path,
      requestId: payload.requestId,
      statusCode: payload.statusCode,
    };
    const exceptionMessage = this.messageFromUnknown(exception);

    if (payload.statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        { ...context, exception: exceptionMessage },
        this.stackFromUnknown(exception),
      );
      return;
    }

    if (payload.statusCode >= Number(HttpStatus.BAD_REQUEST)) {
      this.logger.warn({ ...context, exception: exceptionMessage });
    }
  }

  private messageFromUnknown(exception: unknown): string {
    if (exception instanceof Error) {
      return exception.message || exception.name;
    }

    if (typeof exception === 'string') {
      return exception;
    }

    return 'Erreur inconnue';
  }

  private stackFromUnknown(exception: unknown): string | undefined {
    return exception instanceof Error ? exception.stack : undefined;
  }
}
