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
import { WompiAcceptanceTokenService } from './wompi-acceptance-token.service';
import { WompiHttpClient } from './wompi-http.client';
import { WompiIntegritySignatureService } from './wompi-integrity-signature.service';
import { WompiPaymentMethodMapper } from './wompi-payment-method.mapper';

interface WompiCreateTransactionResponse {
  data?: {
    id?: string;
    status?: string;
    checkout_url?: string;
    payment_method?: {
      extra?: {
        async_payment_url?: string;
      };
    };
  };
}

interface WompiGetTransactionResponse {
  data?: {
    status?: string;
    payment_method?: {
      extra?: {
        async_payment_url?: string;
      };
    };
  };
}

@Injectable()
export class WompiAdapter implements PaymentGatewayPort {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly orderStatusService: OrderStatusService,
    private readonly wompiHttpClient: WompiHttpClient,
    private readonly wompiAcceptanceTokenService: WompiAcceptanceTokenService,
    private readonly wompiPaymentMethodMapper: WompiPaymentMethodMapper,
    private readonly wompiIntegritySignatureService: WompiIntegritySignatureService,
  ) {}

  public async createTransaction(
    input: CreateWompiTransactionInput,
  ): Promise<Result<CreatedWompiTransaction, AppError>> {
    const acceptanceTokenResult = await this.wompiAcceptanceTokenService.resolve();
    if (acceptanceTokenResult.isErr()) {
      return acceptanceTokenResult;
    }
    const acceptanceToken = (acceptanceTokenResult as Ok<string>).value;

    const paymentMethodResult = this.wompiPaymentMethodMapper.map(
      input.paymentMethod,
    );
    if (paymentMethodResult.isErr()) {
      return paymentMethodResult;
    }
    const paymentMethod = (paymentMethodResult as Ok<Record<string, unknown>>)
      .value;

    const integritySignature = this.wompiIntegritySignatureService.build(
      input.orderReference,
      input.amountInCents,
      input.currency,
    );

    const payload = {
      amount_in_cents: input.amountInCents,
      currency: input.currency,
      customer_email: input.customerEmail,
      reference: input.orderReference,
      signature: integritySignature,
      acceptance_token: acceptanceToken,
      payment_method: paymentMethod,
    };

    const responseResult =
      await this.wompiHttpClient.request<WompiCreateTransactionResponse>(
        '/transactions',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        'private',
      );

    if (responseResult.isErr()) {
      return responseResult;
    }
    const responseData = (responseResult as Ok<WompiCreateTransactionResponse>)
      .value;

    const transactionId = responseData.data?.id;
    const providerStatus = responseData.data?.status ?? 'PENDING';

    if (!transactionId) {
      return err({
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'Wompi did not return a transaction id.',
        details: responseData,
      });
    }

    let checkoutUrl =
      responseData.data?.checkout_url ??
      responseData.data?.payment_method?.extra?.async_payment_url ??
      null;

    if (!checkoutUrl && input.paymentMethod.type === 'BANCOLOMBIA_TRANSFER') {
      const asyncUrlResult =
        await this.getBancolombiaAsyncPaymentUrl(transactionId);
      if (asyncUrlResult.isOk()) {
        checkoutUrl = (asyncUrlResult as Ok<string | null>).value;
      }
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
      await this.wompiHttpClient.request<WompiGetTransactionResponse>(
        `/transactions/${transactionId}`,
        {
          method: 'GET',
        },
        'private',
      );

    if (responseResult.isErr()) {
      return responseResult;
    }
    const responseData = (responseResult as Ok<WompiGetTransactionResponse>)
      .value;

    const providerStatus = responseData.data?.status ?? 'PENDING';
    const orderStatus =
      this.orderStatusService.mapProviderStatus(providerStatus);

    return ok({
      providerStatus,
      orderStatus,
    });
  }

  private async getBancolombiaAsyncPaymentUrl(
    transactionId: string,
  ): Promise<Result<string | null, AppError>> {
    const responseResult =
      await this.wompiHttpClient.request<WompiGetTransactionResponse>(
        `/transactions/${transactionId}`,
        {
          method: 'GET',
        },
        'private',
      );

    if (responseResult.isErr()) {
      return responseResult;
    }

    const responseData = (responseResult as Ok<WompiGetTransactionResponse>)
      .value;
    return ok(responseData.data?.payment_method?.extra?.async_payment_url ?? null);
  }
}
