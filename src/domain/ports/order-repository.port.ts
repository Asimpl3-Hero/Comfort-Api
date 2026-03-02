import { Order, OrderStatus, ShippingData } from '../entities/order.entity';
import { AppError } from '../../shared/errors/app-error';
import { Result } from '../../shared/railway/result';

export const ORDER_REPOSITORY_PORT = Symbol('ORDER_REPOSITORY_PORT');

export interface CreatePendingOrderInput {
  productId: string;
  amountInCents: number;
  currency: string;
  wompiTransactionId: string;
  shippingData?: ShippingData;
}

export interface OrderRepositoryPort {
  createPending(
    input: CreatePendingOrderInput,
  ): Promise<Result<Order, AppError>>;
  findById(id: string): Promise<Result<Order | null, AppError>>;
  findPending(): Promise<Result<Order[], AppError>>;
  updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<Result<Order, AppError>>;
}
