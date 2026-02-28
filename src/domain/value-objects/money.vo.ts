import { AppError } from '../../shared/errors/app-error';
import { Result, err, ok } from '../../shared/railway/result';

export class Money {
  private constructor(
    public readonly amountInCents: number,
    public readonly currency: string,
  ) {}

  public static create(
    amountInCents: number,
    currency: string,
  ): Result<Money, AppError> {
    if (!Number.isInteger(amountInCents) || amountInCents <= 0) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'amount_in_cents must be a positive integer.',
      });
    }

    if (!currency || currency.trim().length !== 3) {
      return err({
        code: 'VALIDATION_ERROR',
        message: 'currency must be an ISO-4217 3-letter code.',
      });
    }

    return ok(new Money(amountInCents, currency.toUpperCase()));
  }
}
