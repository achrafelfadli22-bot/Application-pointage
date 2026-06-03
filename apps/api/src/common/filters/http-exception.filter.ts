import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

function isPrismaNotFoundException(exception: unknown) {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    exception.code === 'P2025'
  );
}

function hasPrismaCode(exception: unknown, code: string) {
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    exception.code === code
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isPrismaNotFound = isPrismaNotFoundException(exception);
    const isPrismaConflict = hasPrismaCode(exception, 'P2002');
    const status = isPrismaNotFound
      ? HttpStatus.NOT_FOUND
      : isPrismaConflict
        ? HttpStatus.CONFLICT
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse = exception instanceof HttpException ? exception.getResponse() : exception;
    const exceptionMessage =
      typeof rawResponse === 'object' && rawResponse && 'message' in rawResponse
        ? Array.isArray(rawResponse.message)
          ? rawResponse.message.join(', ')
          : String(rawResponse.message)
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';
    const message = isPrismaNotFound
      ? 'Resource not found'
      : isPrismaConflict
        ? 'Resource already exists'
      : status >= 500
        ? 'Internal server error'
        : exceptionMessage;

    if (status >= 500) {
      this.logger.error(JSON.stringify({ statusCode: status, message: exceptionMessage, exception }));
    }

    response.status(status).json({
      success: false,
      error: message,
      statusCode: status,
    });
  }
}
