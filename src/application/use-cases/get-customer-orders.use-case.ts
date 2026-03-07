import { Inject, Injectable } from '@nestjs/common';
import { ORDER_REPOSITORY_PORT } from '../../domain/ports/order-repository.port';
import type { OrderRepositoryPort } from '../../domain/ports/order-repository.port';
import { Order } from '../../domain/entities/order.entity';
import { AppError } from '../../shared/errors/app-error';
import { Result } from '../../shared/railway/result';

@Injectable()
export class GetCustomerOrdersUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY_PORT)
    private readonly orderRepository: OrderRepositoryPort,
  ) {}

  public async execute(
    customerEmail: string,
  ): Promise<Result<Order[], AppError>> {
    return this.orderRepository.findByCustomerEmail(customerEmail);
  }
}
