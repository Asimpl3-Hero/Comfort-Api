import { Inject, Injectable } from '@nestjs/common';
import type { ShippingData } from '../../domain/entities/order.entity';
import { ORDER_REPOSITORY_PORT } from '../../domain/ports/order-repository.port';
import type { OrderRepositoryPort } from '../../domain/ports/order-repository.port';
import { AppError } from '../../shared/errors/app-error';
import { Result, err } from '../../shared/railway/result';

@Injectable()
export class GetDeliveryByOrderIdUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  public async execute(
    orderId: string,
  ): Promise<Result<ShippingData, AppError>> {
    const orderResult = await this.orderRepository.findById(orderId);
    if (orderResult.isErr()) {
      return orderResult;
    }

    const order = orderResult.match(
      (value) => value,
      () => null,
    );

    if (!order) {
      return err({
        code: 'ORDER_NOT_FOUND',
        message: `Order ${orderId} was not found.`,
      });
    }

    if (!order.shippingData) {
      return err({
        code: 'DELIVERY_NOT_FOUND',
        message: `Delivery for order ${orderId} was not found.`,
      });
    }

    return Result.ok(order.shippingData);
  }
}
