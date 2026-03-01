import { Injectable } from '@nestjs/common';
import type {
  CreatedWompiTransaction,
  CreateWompiTransactionInput,
  PaymentMethodInput,
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
      payment_method: this.mapPaymentMethod(input.paymentMethod),
    };

    const responseResult = await this.request<WompiCreateTransactionResponse>(
      '/transactions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
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

    const checkoutUrl =
      responseData.data?.checkout_url ??
      responseData.data?.payment_method?.extra?.async_payment_url ??
      null;

    return ok({
      transactionId,
      checkoutUrl,
      providerStatus,
    });
  }

  private mapPaymentMethod(input: PaymentMethodInput): Record<string, unknown> {
    if (input.type === 'CARD') {
      return {
        type: 'CARD',
        token: this.appConfigService.wompiSandboxCardToken,
        installments: 1,
      };
    }

    if (input.type === 'NEQUI') {
      return {
        type: 'NEQUI',
        phone_number: input.phoneNumber,
      };
    }

    if (input.type === 'PSE') {
      return {
        type: 'PSE',
        user_type: input.userType,
        user_legal_id_type: input.userLegalIdType,
        user_legal_id: input.userLegalId,
        financial_institution_code: input.financialInstitutionCode,
        payment_description: input.paymentDescription,
      };
    }

    return {
      type: 'BANCOLOMBIA_TRANSFER',
      payment_description: input.paymentDescription,
      ...(input.sandboxStatus ? { sandbox_status: input.sandboxStatus } : {}),
    };
  }

  public async getTransactionStatus(
    transactionId: string,
  ): Promise<Result<WompiTransactionStatus, AppError>> {
    const responseResult = await this.request<WompiGetTransactionResponse>(
      `/transactions/${transactionId}`,
      {
        method: 'GET',
      },
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

  private async request<T>(
    path: string,
    init: RequestInit,
  ): Promise<Result<T, AppError>> {
    try {
      const response = await fetch(
        `${this.appConfigService.wompiBaseUrl}${path}`,
        {
          ...init,
          headers: {
            Authorization: `Bearer ${this.appConfigService.wompiPrivateKey}`,
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
          },
        },
      );

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
