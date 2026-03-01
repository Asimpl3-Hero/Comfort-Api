import { Injectable } from '@nestjs/common';
import type {
  CreatedWompiTransaction,
  CreateWompiTransactionInput,
  PaymentGatewayPort,
  WompiTransactionStatus,
} from '../../../domain/ports/payment-gateway.port';
import { OrderStatusService } from '../../../domain/services/order-status.service';
import { AppError } from '../../../shared/errors/app-error';
import { Ok, Result, err, ok } from '../../../shared/railway/result';
import { AppConfigService } from '../../config/app-config.service';

interface WompiCreateTransactionResponse {
  data?: {
    id?: string;
    status?: string;
    checkout_url?: string;
  };
}

interface WompiGetTransactionResponse {
  data?: {
    status?: string;
  };
}

@Injectable()
export class WompiAdapter implements PaymentGatewayPort {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly orderStatusService: OrderStatusService,
  ) {}

  public async createTransaction(
    input: CreateWompiTransactionInput,
  ): Promise<Result<CreatedWompiTransaction, AppError>> {
    const payload = {
      amount_in_cents: input.amountInCents,
      currency: input.currency,
      customer_email: this.appConfigService.wompiCustomerEmail,
      reference: input.orderReference,
      acceptance_token: this.appConfigService.wompiAcceptanceToken,
      payment_method: {
        type: 'CARD',
        token: this.appConfigService.wompiSandboxCardToken,
        installments: 1,
      },
    };

    const responseResult =
      await this.request<WompiCreateTransactionResponse>('/transactions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

    if (responseResult.isErr()) {
      return responseResult;
    }
    const responseData = (responseResult as Ok<WompiCreateTransactionResponse>).value;

    const transactionId = responseData.data?.id;
    const providerStatus = responseData.data?.status ?? 'PENDING';

    if (!transactionId) {
      return err({
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'Wompi did not return a transaction id.',
        details: responseData,
      });
    }

    const checkoutUrl = responseData.data?.checkout_url;
    if (!checkoutUrl) {
      return err({
        code: 'PAYMENT_PROVIDER_ERROR',
        message:
          'Wompi did not return a checkout_url. The payment flow is not usable.',
        details: responseData,
      });
    }

    return ok({
      transactionId,
      checkoutUrl,
      providerStatus,
    });
  }

  public async getTransactionStatus(
    transactionId: string,
  ): Promise<Result<WompiTransactionStatus, AppError>> {
    const responseResult =
      await this.request<WompiGetTransactionResponse>(
        `/transactions/${transactionId}`,
        {
          method: 'GET',
        },
      );

    if (responseResult.isErr()) {
      return responseResult;
    }
    const responseData = (responseResult as Ok<WompiGetTransactionResponse>).value;

    const providerStatus = responseData.data?.status ?? 'PENDING';
    const orderStatus = this.orderStatusService.mapProviderStatus(providerStatus);

    return ok({
      providerStatus,
      orderStatus,
    });
  }

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<Result<T, AppError>> {
    try {
      const response = await fetch(`${this.appConfigService.wompiBaseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.appConfigService.wompiPrivateKey}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });

      const data = (await response.json().catch(() => ({}))) as T;

      if (!response.ok) {
        return err({
          code: 'PAYMENT_PROVIDER_ERROR',
          message: `Wompi request failed with status ${response.status}.`,
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
