import { Injectable } from '@nestjs/common';
import { Order, OrderStatus } from '../../../domain/entities/order.entity';
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
          amountInCents: input.amountInCents,
          currency: input.currency,
          wompiTransactionId: input.wompiTransactionId,
          status: 'PENDING',
        },
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

  private toDomain(order: {
    id: string;
    productId: string;
    amountInCents: number;
    currency: string;
    wompiTransactionId: string;
    status: string;
    createdAt: Date;
  }): Order {
    return {
      id: order.id,
      productId: order.productId,
      amountInCents: order.amountInCents,
      currency: order.currency,
      wompiTransactionId: order.wompiTransactionId,
      status: order.status as OrderStatus,
      createdAt: order.createdAt,
    };
  }
}
