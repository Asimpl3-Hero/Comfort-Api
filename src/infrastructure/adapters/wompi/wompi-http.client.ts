import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/errors/app-error';
import { Result, err, ok } from '../../../shared/railway/result';
import { AppConfigService } from '../../config/app-config.service';

export type WompiRequestAuth = 'private' | 'none';

@Injectable()
export class WompiHttpClient {
  constructor(private readonly appConfigService: AppConfigService) {}

  public async request<T>(
    path: string,
    init: RequestInit,
    auth: WompiRequestAuth,
  ): Promise<Result<T, AppError>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (auth === 'private') {
        headers.Authorization = `Bearer ${this.appConfigService.wompiPrivateKey}`;
      }

      const response = await fetch(
        `${this.appConfigService.wompiBaseUrl}${path}`,
        {
          ...init,
          headers: {
            ...headers,
            ...(init.headers ?? {}),
          },
        },
      );

      const data = (await response.json().catch(() => ({}))) as T;
      if (!response.ok) {
        const isProviderDown = response.status >= 500;
        return err({
          code: isProviderDown ? 'PAYMENT_PROVIDER_ERROR' : 'VALIDATION_ERROR',
          message: isProviderDown
            ? `Wompi request failed with status ${response.status}.`
            : `Wompi rejected request with status ${response.status}.`,
          details: data,
        });
      }

      return ok(data);
    } catch (cause) {
      return err({
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'Wompi request failed due to a network or parsing error.',
        details: cause,
      });
    }
  }
}
