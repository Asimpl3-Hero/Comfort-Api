import { OrderStatus } from '../entities/order.entity';
import { AppError } from '../../shared/errors/app-error';
import { Result } from '../../shared/railway/result';

export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');

export interface CreateWompiTransactionInput {
  orderReference: string;
  amountInCents: number;
  currency: string;
  customerEmail: string;
}

export interface CreatedWompiTransaction {
  transactionId: string;
  checkoutUrl: string;
  providerStatus: string;
}

export interface WompiTransactionStatus {
  providerStatus: string;
  orderStatus: OrderStatus;
}

export interface PaymentGatewayPort {
  createTransaction(
    input: CreateWompiTransactionInput,
  ): Promise<Result<CreatedWompiTransaction, AppError>>;
  getTransactionStatus(
    transactionId: string,
  ): Promise<Result<WompiTransactionStatus, AppError>>;
}
