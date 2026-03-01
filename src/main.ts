import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const expressApp = app.getHttpAdapter().getInstance();

  const forceHttps = getBoolean(configService.get<string>('FORCE_HTTPS'), false);
  const rateLimitWindowMs = getNumber(
    configService.get<string>('RATE_LIMIT_WINDOW_MS'),
    60_000,
  );
  const rateLimitMaxRequests = getNumber(
    configService.get<string>('RATE_LIMIT_MAX_REQUESTS'),
    120,
  );

  expressApp.disable('x-powered-by');
  expressApp.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(helmet.noSniff());
  app.use(
    rateLimit({
      windowMs: rateLimitWindowMs,
      max: rateLimitMaxRequests,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        errorCode: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
      },
    }),
  );

  if (forceHttps) {
    app.use((request: Request, response: Response, next: NextFunction) => {
      const forwardedProto = request.headers['x-forwarded-proto'];
      const protocol = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : forwardedProto ?? request.protocol;

      if (protocol === 'https') {
        return next();
      }

      if (!request.headers.host) {
        return response.status(400).json({
          errorCode: 'HTTPS_REDIRECT_ERROR',
          message: 'Host header is required.',
        });
      }

      return response.redirect(
        301,
        `https://${request.headers.host}${request.originalUrl}`,
      );
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}

function getBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
}

function getNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

bootstrap();
