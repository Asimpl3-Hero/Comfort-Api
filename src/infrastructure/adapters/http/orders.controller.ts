import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateOrderRequestDto } from '../../../application/dto/create-order-request.dto';
import { CreateOrderUseCase } from '../../../application/use-cases/create-order.use-case';
import { GetOrderByIdUseCase } from '../../../application/use-cases/get-order-by-id.use-case';
import { toHttpException } from './http-error.mapper';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
  ) {}

  @Post()
  public async createOrder(@Body() body: CreateOrderRequestDto) {
    const result = await this.createOrderUseCase.execute({
      productId: body.productId,
    });

    return result.match(
      (createdOrder) => ({
        orderId: createdOrder.orderId,
        checkoutUrl: createdOrder.checkoutUrl,
        status: createdOrder.status,
      }),
      (error) => {
        throw toHttpException(error);
      },
    );
  }

  @Get(':id')
  public async getOrderById(@Param('id') orderId: string) {
    const result = await this.getOrderByIdUseCase.execute(orderId);

    return result.match(
      (order) => ({
        id: order.id,
        product_id: order.productId,
        amount_in_cents: order.amountInCents,
        currency: order.currency,
        wompi_transaction_id: order.wompiTransactionId,
        status: order.status,
        created_at: order.createdAt,
      }),
      (error) => {
        throw toHttpException(error);
      },
    );
  }
}
