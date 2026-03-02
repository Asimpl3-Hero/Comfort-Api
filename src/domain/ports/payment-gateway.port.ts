import { OrderStatus } from '../entities/order.entity';
import { AppError } from '../../shared/errors/app-error';
import { Result } from '../../shared/railway/result';

export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');

export const PAYMENT_METHOD_TYPES = [
  'CARD',
  'NEQUI',
  'PSE',
  'BANCOLOMBIA_TRANSFER',
] as const;

export type PaymentMethodType = (typeof PAYMENT_METHOD_TYPES)[number];

export interface CardPaymentMethodInput {
  type: 'CARD';
  cardToken: string;
  installments?: number;
}

export interface NequiPaymentMethodInput {
  type: 'NEQUI';
  phoneNumber: string;
}

export interface PsePaymentMethodInput {
  type: 'PSE';
  userType: 0 | 1;
  userLegalIdType: 'CC' | 'NIT';
  userLegalId: string;
  financialInstitutionCode: string;
  paymentDescription: string;
}

export interface BancolombiaTransferPaymentMethodInput {
  type: 'BANCOLOMBIA_TRANSFER';
  paymentDescription: string;
  sandboxStatus?: 'APPROVED' | 'DECLINED';
}

export type PaymentMethodInput =
  | CardPaymentMethodInput
  | NequiPaymentMethodInput
  | PsePaymentMethodInput
  | BancolombiaTransferPaymentMethodInput;

export interface CreateWompiTransactionInput {
  orderReference: string;
  amountInCents: number;
  currency: string;
  paymentMethod: PaymentMethodInput;
}

export interface CreatedWompiTransaction {
  transactionId: string;
  checkoutUrl: string | null;
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
