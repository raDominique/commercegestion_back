import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type Wrapped = Record<string, unknown> & { status: string; message: string };

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Wrapped> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<Wrapped> {
    return next.handle().pipe(
      map((data) => ({
        status: 'success',
        message: 'Opération réussie',
        ...(data as Record<string, unknown>),
      })),
    );
  }
}
