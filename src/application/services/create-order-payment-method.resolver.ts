import { Injectable } from '@nestjs/common';
import type {
  PaymentMethodInput,
  PaymentMethodType,
} from '../../domain/ports/payment-gateway.port';
import { AppError } from '../../shared/errors/app-error';
import { Result, err } from '../../shared/railway/result';

export interface CreateOrderPaymentMethodData {
  cardToken?: string;
  phoneNumber?: string;
  userType?: number;
  userLegalIdType?: 'CC' | 'NIT';
  userLegalId?: string;
  financialInstitutionCode?: string;
  paymentDescription?: string;
  sandboxStatus?: 'APPROVED' | 'DECLINED';
}

@Injectable()
export class CreateOrderPaymentMethodResolver {
  public resolve(
    paymentMethodType?: PaymentMethodType,
    paymentMethodData?: CreateOrderPaymentMethodData,
  ): Result<PaymentMethodInput, AppError> {
    const methodType = paymentMethodType ?? 'CARD';
    const data = paymentMethodData;

    if (methodType === 'CARD') {
      const cardToken = data?.cardToken?.trim();
      if (!cardToken) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'CARD payment requires paymentMethodData.cardToken.',
        });
      }

      return Result.ok({
        type: 'CARD',
        cardToken,
        installments: 1,
      });
    }

    if (methodType === 'NEQUI') {
      const phoneNumber = data?.phoneNumber?.trim();
      if (!phoneNumber || !/^\d{10}$/.test(phoneNumber)) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'Nequi phone number must have exactly 10 digits.',
        });
      }

      return Result.ok({
        type: 'NEQUI',
        phoneNumber,
      });
    }

    if (methodType === 'PSE') {
      const userType = data?.userType;
      const userLegalIdType = data?.userLegalIdType;
      const userLegalId = data?.userLegalId?.trim();
      const financialInstitutionCode = data?.financialInstitutionCode?.trim();
      const paymentDescription = data?.paymentDescription?.trim();

      if (userType !== 0 && userType !== 1) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'PSE userType must be 0 (natural) or 1 (legal).',
        });
      }
      if (userLegalIdType !== 'CC' && userLegalIdType !== 'NIT') {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'PSE userLegalIdType must be CC or NIT.',
        });
      }
      if (!userLegalId) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'PSE userLegalId is required.',
        });
      }
      if (!financialInstitutionCode) {
        return err({
          code: 'VALIDATION_ERROR',
          message: 'PSE financialInstitutionCode is required.',
        });
      }
      if (!paymentDescription || paymentDescription.length > 30) {
        return err({
          code: 'VALIDATION_ERROR',
          message:
            'PSE paymentDescription is required and must be at most 30 characters.',
        });
      }

      return Result.ok({
        type: 'PSE',
        userType,
        userLegalIdType,
        userLegalId,
        financialInstitutionCode,
        paymentDescription,
      });
    }

    if (methodType === 'BANCOLOMBIA_TRANSFER') {
      const paymentDescription = data?.paymentDescription?.trim();
      if (!paymentDescription || paymentDescription.length > 64) {
        return err({
          code: 'VALIDATION_ERROR',
          message:
            'Bancolombia paymentDescription is required and must be at most 64 characters.',
        });
      }

      return Result.ok({
        type: 'BANCOLOMBIA_TRANSFER',
        paymentDescription,
        sandboxStatus: data?.sandboxStatus,
      });
    }

    return err({
      code: 'VALIDATION_ERROR',
      message: `Unsupported payment method: ${methodType}`,
    });
  }
}
