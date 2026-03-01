import type {
  CreatePendingOrderInput,
  OrderRepositoryPort,
} from '../../../src/domain/ports/order-repository.port';
import type {
  CreateWompiTransactionInput,
  PaymentGatewayPort,
} from '../../../src/domain/ports/payment-gateway.port';
import type { ProductRepositoryPort } from '../../../src/domain/ports/product-repository.port';
import type { OrderStatusPollingPort } from '../../../src/domain/ports/order-status-polling.port';
import type { Order, OrderStatus } from '../../../src/domain/entities/order.entity';
import type { Product } from '../../../src/domain/entities/product.entity';
import { err, ok, type Result } from '../../../src/shared/railway/result';
import type { AppError } from '../../../src/shared/errors/app-error';
import {
  buildCreatedTransaction,
  buildOrder,
  buildProduct,
} from '../factories/order.factory';

export class InMemoryProductRepository implements ProductRepositoryPort {
  constructor(private readonly products: Product[] = [buildProduct()]) {}

  public async findAll(): Promise<Result<Product[], AppError>> {
    return ok(this.products);
  }

  public async findById(id: string): Promise<Result<Product | null, AppError>> {
    return ok(this.products.find((product) => product.id === id) ?? null);
  }
}

export class InMemoryOrderRepository implements OrderRepositoryPort {
  private readonly orders: Order[] = [];

  public async createPending(
    input: CreatePendingOrderInput,
  ): Promise<Result<Order, AppError>> {
    const order = buildOrder({
      productId: input.productId,
      amountInCents: input.amountInCents,
      currency: input.currency,
      wompiTransactionId: input.wompiTransactionId,
      status: 'PENDING',
    });

    this.orders.push(order);
    return ok(order);
  }

  public async findById(id: string): Promise<Result<Order | null, AppError>> {
    return ok(this.orders.find((order) => order.id === id) ?? null);
  }

  public async findPending(): Promise<Result<Order[], AppError>> {
    return ok(this.orders.filter((order) => order.status === 'PENDING'));
  }

  public async updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<Result<Order, AppError>> {
    const order = this.orders.find((item) => item.id === id);
    if (!order) {
      return err({
        code: 'ORDER_NOT_FOUND',
        message: `Order ${id} was not found.`,
      });
    }

    order.status = status;
    return ok(order);
  }

  public getAll(): Order[] {
    return this.orders;
  }
}

export class FixedSuccessPaymentGateway implements PaymentGatewayPort {
  public async createTransaction(
    _input: CreateWompiTransactionInput,
  ): Promise<Result<ReturnType<typeof buildCreatedTransaction>, AppError>> {
    return ok(buildCreatedTransaction());
  }

  public async getTransactionStatus(): Promise<
    Result<{ providerStatus: string; orderStatus: OrderStatus }, AppError>
  > {
    return ok({
      providerStatus: 'PENDING',
      orderStatus: 'PENDING',
    });
  }
}

export class SpyPollingService implements OrderStatusPollingPort {
  public readonly calls: Array<{ orderId: string; wompiTransactionId: string }> =
    [];

  public async start(
    orderId: string,
    wompiTransactionId: string,
  ): Promise<Result<void, AppError>> {
    this.calls.push({ orderId, wompiTransactionId });
    return ok(undefined);
  }
}
