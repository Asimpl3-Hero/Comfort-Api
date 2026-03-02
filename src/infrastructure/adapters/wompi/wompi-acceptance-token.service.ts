import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/errors/app-error';
import { Ok, Result, err, ok } from '../../../shared/railway/result';
import { AppConfigService } from '../../config/app-config.service';
import { WompiHttpClient } from './wompi-http.client';

interface WompiMerchantResponse {
  data?: {
    presigned_acceptance?: {
      acceptance_token?: string;
    };
    presigned_personal_data_auth?: {
      acceptance_token?: string;
    };
  };
}

@Injectable()
export class WompiAcceptanceTokenService {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly wompiHttpClient: WompiHttpClient,
  ) {}

  public async resolve(): Promise<Result<string, AppError>> {
    const configuredToken = this.appConfigService.wompiAcceptanceToken?.trim();
    if (configuredToken && !this.isPlaceholder(configuredToken)) {
      return ok(configuredToken);
    }

    const merchantResponse = await this.wompiHttpClient.request<WompiMerchantResponse>(
      `/merchants/${this.appConfigService.wompiPublicKey}`,
      { method: 'GET' },
      'none',
    );
    if (merchantResponse.isErr()) {
      return merchantResponse;
    }

    const merchant = (merchantResponse as Ok<WompiMerchantResponse>).value;
    const acceptanceToken =
      merchant.data?.presigned_acceptance?.acceptance_token ??
      merchant.data?.presigned_personal_data_auth?.acceptance_token;

    if (!acceptanceToken) {
      return err({
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'Wompi merchant response did not include an acceptance token.',
        details: merchant,
      });
    }

    return ok(acceptanceToken);
  }

  private isPlaceholder(value: string): boolean {
    return (
      value.includes('placeholder') || value.includes('from_wompi_sandbox')
    );
  }
}
