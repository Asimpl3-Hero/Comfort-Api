import { Injectable } from '@nestjs/common';
import type {
  Order,
  OrderStatus,
  ShippingData,
} from '../../../domain/entities/order.entity';
import type {
  CreatePendingOrderInput,
  OrderRepositoryPort,
} from '../../../domain/ports/order-repository.port';
import { AppError } from '../../../shared/errors/app-error';
import { Result, err, ok } from '../../../shared/railway/result';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaOrderRepositoryAdapter implements OrderRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  public async createPending(
    input: CreatePendingOrderInput,
  ): Promise<Result<Order, AppError>> {
    try {
      const order = await this.prisma.order.create({
        data: {
          productId: input.productId,
          quantity: input.quantity,
          amountInCents: input.amountInCents,
          currency: input.currency,
          customerEmail: input.customerEmail,
          wompiTransactionId: input.wompiTransactionId,
          shippingFullName: input.shippingData.fullName,
          shippingEmail: input.shippingData.email,
          shippingPhone: input.shippingData.phone,
          shippingAddress1: input.shippingData.address1,
          shippingAddress2: input.shippingData.address2,
          shippingCity: input.shippingData.city,
          shippingState: input.shippingData.state,
          shippingZip: input.shippingData.zip,
          shippingCountry: input.shippingData.country,
          status: 'PENDING',
        } as any,
      });

      return ok(this.toDomain(order));
    } catch (cause) {
      return err({
        code: 'PERSISTENCE_ERROR',
        message: 'Failed to create order.',
        details: cause,
      });
    }
  }

  public async findById(id: string): Promise<Result<Order | null, AppError>> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
      });

      if (!order) {
        return ok(null);
      }

      return ok(this.toDomain(order));
    } catch (cause) {
      return err({
        code: 'PERSISTENCE_ERROR',
        message: 'Failed to fetch order by id.',
        details: cause,
      });
    }
  }

  public async findByCustomerEmail(
    email: string,
  ): Promise<Result<Order[], AppError>> {
    try {
      const orders = await this.prisma.order.findMany({
        where: { customerEmail: email },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return ok(orders.map((order) => this.toDomain(order)));
    } catch (cause) {
      return err({
        code: 'PERSISTENCE_ERROR',
        message: 'Failed to fetch customer orders.',
        details: cause,
      });
    }
  }

  public async findDeliveryByOrderId(
    orderId: string,
  ): Promise<Result<ShippingData | null, AppError>> {
    const orderResult = await this.findById(orderId);
    return orderResult.map((order) => order?.shippingData ?? null);
  }

  public async findPending(): Promise<Result<Order[], AppError>> {
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          status: 'PENDING',
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      return ok(orders.map((order) => this.toDomain(order)));
    } catch (cause) {
      return err({
        code: 'PERSISTENCE_ERROR',
        message: 'Failed to fetch pending orders.',
        details: cause,
      });
    }
  }

  public async updateStatus(
    id: string,
    status: OrderStatus,
  ): Promise<Result<Order, AppError>> {
    try {
      const order = await this.prisma.order.update({
        where: { id },
        data: { status },
      });

      return ok(this.toDomain(order));
    } catch (cause) {
      return err({
        code: 'PERSISTENCE_ERROR',
        message: 'Failed to update order status.',
        details: cause,
      });
    }
  }

  public async approveOrderAndDecrementStock(
    id: string,
  ): Promise<Result<Order, AppError>> {
    try {
      const approvedOrder = await this.prisma.$transaction(async (tx) => {
        const currentOrder = await tx.order.findUnique({
          where: { id },
        });

        if (!currentOrder) {
          throw this.typedError(
            'ORDER_NOT_FOUND',
            `Order ${id} was not found.`,
          );
        }

        if (currentOrder.status !== 'PENDING') {
          return currentOrder;
        }

        const updatedProduct = await tx.product.updateMany({
          where: {
            id: currentOrder.productId,
            stock: {
              gte:
                typeof currentOrder.quantity === 'number' &&
                currentOrder.quantity > 0
                  ? currentOrder.quantity
                  : 1,
            },
          },
          data: {
            stock: {
              decrement:
                typeof currentOrder.quantity === 'number' &&
                currentOrder.quantity > 0
                  ? currentOrder.quantity
                  : 1,
            },
          },
        });

        if (updatedProduct.count === 0) {
          throw this.typedError(
            'OUT_OF_STOCK',
            `Product ${currentOrder.productId} does not have enough stock.`,
          );
        }

        return tx.order.update({
          where: { id },
          data: {
            status: 'APPROVED',
          },
        });
      });

      return ok(this.toDomain(approvedOrder));
    } catch (cause) {
      const appError = this.fromTypedError(cause);
      if (appError) {
        return err(appError);
      }

      return err({
        code: 'PERSISTENCE_ERROR',
        message: 'Failed to finalize approved order.',
        details: cause,
      });
    }
  }

  private toDomain(order: {
    id: string;
    productId: string;
    quantity?: number | null;
    amountInCents: number;
    currency: string;
    customerEmail: string | null;
    wompiTransactionId: string;
    shippingFullName: string | null;
    shippingEmail: string | null;
    shippingPhone: string | null;
    shippingAddress1: string | null;
    shippingAddress2: string | null;
    shippingCity: string | null;
    shippingState: string | null;
    shippingZip: string | null;
    shippingCountry: string | null;
    status: string;
    createdAt: Date;
  }): Order {
    const hasShippingData =
      Boolean(order.shippingFullName) &&
      Boolean(order.shippingEmail) &&
      Boolean(order.shippingAddress1) &&
      Boolean(order.shippingCity) &&
      Boolean(order.shippingState) &&
      Boolean(order.shippingZip);

    return {
      id: order.id,
      productId: order.productId,
      quantity:
        typeof order.quantity === 'number' && order.quantity > 0
          ? order.quantity
          : 1,
      amountInCents: order.amountInCents,
      currency: order.currency,
      customerEmail:
        order.customerEmail ??
        (hasShippingData ? (order.shippingEmail as string) : undefined),
      wompiTransactionId: order.wompiTransactionId,
      shippingData: hasShippingData
        ? {
            fullName: order.shippingFullName as string,
            email: order.shippingEmail as string,
            phone: order.shippingPhone ?? undefined,
            address1: order.shippingAddress1 as string,
            address2: order.shippingAddress2 ?? undefined,
            city: order.shippingCity as string,
            state: order.shippingState as string,
            zip: order.shippingZip as string,
            country: order.shippingCountry ?? undefined,
          }
        : undefined,
      status: order.status as OrderStatus,
      createdAt: order.createdAt,
    };
  }

  private typedError(code: AppError['code'], message: string): Error {
    return new Error(JSON.stringify({ __appErrorCode: code, message }));
  }

  private fromTypedError(cause: unknown): AppError | null {
    if (!(cause instanceof Error)) {
      return null;
    }

    try {
      const parsed = JSON.parse(cause.message) as {
        __appErrorCode?: AppError['code'];
        message?: string;
      };

      if (!parsed.__appErrorCode || !parsed.message) {
        return null;
      }

      return {
        code: parsed.__appErrorCode,
        message: parsed.message,
      };
    } catch {
      return null;
    }
  }
}
