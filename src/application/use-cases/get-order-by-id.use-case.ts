import { Inject, Injectable } from '@nestjs/common';
import { ORDER_REPOSITORY_PORT } from '../../domain/ports/order-repository.port';
import type { OrderRepositoryPort } from '../../domain/ports/order-repository.port';
import { Order } from '../../domain/entities/order.entity';
import { AppError } from '../../shared/errors/app-error';
import { Result, err } from '../../shared/railway/result';

@Injectable()
export class GetOrderByIdUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  public async execute(orderId: string): Promise<Result<Order, AppError>> {
    const orderResult = await this.orderRepository.findById(orderId);

    return orderResult.flatMap((order) => {
      if (!order) {
        return err({
          code: 'ORDER_NOT_FOUND',
          message: `Order ${orderId} was not found.`,
        });
      }

      return Result.ok(order);
    });
  }
}
