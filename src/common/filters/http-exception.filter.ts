import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { getErrorReason } from '../../shared/bulk/bulk.helper';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Message d'une HttpException (tableaux de validation joints par ", ")
    // ou d'une Error ; jamais d'objet brut renvoyé au client.
    const message =
      (exception instanceof Error && getErrorReason(exception)) ||
      'Internal Error';

    response.status(status).json({
      status: 'error',
      message,
      data: null,
    });
  }
}
