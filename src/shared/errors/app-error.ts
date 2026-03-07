export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'PRODUCT_NOT_FOUND'
  | 'OUT_OF_STOCK'
  | 'ORDER_NOT_FOUND'
  | 'CUSTOMER_NOT_FOUND'
  | 'DELIVERY_NOT_FOUND'
  | 'PAYMENT_PROVIDER_ERROR'
  | 'PERSISTENCE_ERROR'
  | 'POLLING_ERROR';

export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: unknown;
}
