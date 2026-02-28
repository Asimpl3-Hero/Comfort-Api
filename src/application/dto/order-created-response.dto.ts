import { OrderStatus } from '../../domain/entities/order.entity';

export interface OrderCreatedResponseDto {
  orderId: string;
  checkoutUrl: string;
  status: OrderStatus;
}
