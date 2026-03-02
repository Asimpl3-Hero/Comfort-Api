import { Injectable } from '@nestjs/common';
import type {
  CardDataInput,
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

interface WompiCardTokenResponse {
  data?: {
    id?: string;
  };
}

type RequestAuth = 'private' | 'public' | 'none';

@Injectable()
export class WompiAdapter implements PaymentGatewayPort {
  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly orderStatusService: OrderStatusService,
  ) {}

  public async createTransaction(
    input: CreateWompiTransactionInput,
  ): Promise<Result<CreatedWompiTransaction, AppError>> {
    const acceptanceTokenResult = await this.resolveAcceptanceToken();
    if (acceptanceTokenResult.isErr()) {
      return acceptanceTokenResult;
    }
    const acceptanceToken = (acceptanceTokenResult as Ok<string>).value;

    const paymentMethodResult = await this.mapPaymentMethod(input.paymentMethod);
    if (paymentMethodResult.isErr()) {
      return paymentMethodResult;
    }
    const paymentMethod = (paymentMethodResult as Ok<Record<string, unknown>>)
      .value;

    const payload = {
      amount_in_cents: input.amountInCents,
      currency: input.currency,
      customer_email: this.appConfigService.wompiCustomerEmail,
      reference: input.orderReference,
      acceptance_token: acceptanceToken,
      payment_method: paymentMethod,
    };

    const responseResult = await this.request<WompiCreateTransactionResponse>(
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

  private async mapPaymentMethod(
    input: PaymentMethodInput,
  ): Promise<Result<Record<string, unknown>, AppError>> {
    if (input.type === 'CARD') {
      const tokenResult = await this.resolveCardToken(input.cardToken, input.cardData);
      if (tokenResult.isErr()) {
        return tokenResult;
      }

      const token = (tokenResult as Ok<string>).value;

      return ok({
        type: 'CARD',
        token,
        installments: input.installments ?? 1,
      });
    }

    if (input.type === 'NEQUI') {
      return ok({
        type: 'NEQUI',
        phone_number: input.phoneNumber,
      });
    }

    if (input.type === 'PSE') {
      return ok({
        type: 'PSE',
        user_type: input.userType,
        user_legal_id_type: input.userLegalIdType,
        user_legal_id: input.userLegalId,
        financial_institution_code: input.financialInstitutionCode,
        payment_description: input.paymentDescription,
      });
    }

    return ok({
      type: 'BANCOLOMBIA_TRANSFER',
      payment_description: input.paymentDescription,
      ...(input.sandboxStatus ? { sandbox_status: input.sandboxStatus } : {}),
    });
  }

  private async resolveAcceptanceToken(): Promise<Result<string, AppError>> {
    const configuredToken = this.appConfigService.wompiAcceptanceToken?.trim();
    if (configuredToken && !this.isPlaceholder(configuredToken)) {
      return ok(configuredToken);
    }

    const merchantResponse = await this.request<WompiMerchantResponse>(
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

  private async resolveCardToken(
    cardToken: string | undefined,
    cardData: CardDataInput | undefined,
  ): Promise<Result<string, AppError>> {
    const tokenFromRequest = cardToken?.trim();
    if (tokenFromRequest) {
      return ok(tokenFromRequest);
    }

    if (cardData) {
      return this.createCardToken(cardData);
    }

    const configuredToken = this.appConfigService.wompiSandboxCardToken?.trim();
    if (configuredToken && !this.isPlaceholder(configuredToken)) {
      return ok(configuredToken);
    }

    return err({
      code: 'VALIDATION_ERROR',
      message:
        'CARD payment requires a valid card token or full card data for tokenization.',
    });
  }

  private async createCardToken(
    cardData: CardDataInput,
  ): Promise<Result<string, AppError>> {
    const response = await this.request<WompiCardTokenResponse>(
      '/tokens/cards',
      {
        method: 'POST',
        body: JSON.stringify({
          number: cardData.number,
          cvc: cardData.cvc,
          exp_month: cardData.expMonth,
          exp_year: cardData.expYear,
          card_holder: cardData.cardHolder,
        }),
      },
      'public',
    );

    if (response.isErr()) {
      return response;
    }

    const payload = (response as Ok<WompiCardTokenResponse>).value;
    const token = payload.data?.id;

    if (!token) {
      return err({
        code: 'PAYMENT_PROVIDER_ERROR',
        message: 'Wompi tokenization did not return a card token.',
        details: payload,
      });
    }

    return ok(token);
  }

  public async getTransactionStatus(
    transactionId: string,
  ): Promise<Result<WompiTransactionStatus, AppError>> {
    const responseResult = await this.request<WompiGetTransactionResponse>(
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

  private async request<T>(
    path: string,
    init: RequestInit,
    auth: RequestAuth,
  ): Promise<Result<T, AppError>> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (auth === 'private') {
        headers.Authorization = `Bearer ${this.appConfigService.wompiPrivateKey}`;
      } else if (auth === 'public') {
        headers.Authorization = `Bearer ${this.appConfigService.wompiPublicKey}`;
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

  private isPlaceholder(value: string): boolean {
    return (
      value.includes('placeholder') || value.includes('from_wompi_sandbox')
    );
  }
}
