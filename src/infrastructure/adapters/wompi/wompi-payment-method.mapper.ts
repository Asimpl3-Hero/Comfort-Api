import { Injectable } from '@nestjs/common';
import { PaymentMethodInput } from '../../../domain/ports/payment-gateway.port';
import { AppError } from '../../../shared/errors/app-error';
import { Result, err, ok } from '../../../shared/railway/result';

@Injectable()
export class WompiPaymentMethodMapper {
  public map(
    input: PaymentMethodInput,
  ): Result<Record<string, unknown>, AppError> {
    if (input.type === 'CARD') {
      const token = input.cardToken?.trim();
      if (!token || this.isPlaceholder(token)) {
        return err({
          code: 'VALIDATION_ERROR',
          message:
            'CARD payment requires paymentMethodData.cardToken generated on the client.',
        });
      }

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
      user_type: 'PERSON',
      payment_description: input.paymentDescription,
      ...(input.sandboxStatus ? { sandbox_status: input.sandboxStatus } : {}),
    });
  }

  private isPlaceholder(value: string): boolean {
    return (
      value.includes('placeholder') || value.includes('from_wompi_sandbox')
    );
  }
}
