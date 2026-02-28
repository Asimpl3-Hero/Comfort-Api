import { AppError } from '../../shared/errors/app-error';
import { Result } from '../../shared/railway/result';

export const ORDER_STATUS_POLLING_PORT = Symbol('ORDER_STATUS_POLLING_PORT');

export interface OrderStatusPollingPort {
  start(orderId: string, wompiTransactionId: string): Promise<Result<void, AppError>>;
}
