import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GetDeliveryByOrderIdUseCase } from '../../../application/use-cases/get-delivery-by-order-id.use-case';
import { GetOrderByIdUseCase } from '../../../application/use-cases/get-order-by-id.use-case';
import {
  APP_ERROR_SCHEMA,
  DELIVERY_RESPONSE_SCHEMA,
} from './docs/swagger.schemas';
import { toHttpException } from './http-error.mapper';

@ApiTags('Deliveries')
@Controller('deliveries')
export class DeliveriesController {
  constructor(
    private readonly getDeliveryByOrderIdUseCase: GetDeliveryByOrderIdUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
  ) {}

  @Get(':orderId')
  @ApiOperation({
    summary: 'Get delivery by order id',
    description:
      'Returns delivery data linked to a transaction order and current order status.',
  })
  @ApiParam({
    name: 'orderId',
    description: 'Order UUID',
    type: String,
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Delivery found.',
    schema: DELIVERY_RESPONSE_SCHEMA,
  })
  @ApiNotFoundResponse({
    description: 'Order or delivery not found.',
    schema: APP_ERROR_SCHEMA,
  })
  @ApiInternalServerErrorResponse({
    description: 'Persistence or infrastructure error.',
    schema: APP_ERROR_SCHEMA,
  })
  public async getDeliveryByOrderId(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    const orderResult = await this.getOrderByIdUseCase.execute(orderId);
    const deliveryResult =
      await this.getDeliveryByOrderIdUseCase.execute(orderId);

    return orderResult.match(
      (order) =>
        deliveryResult.match(
          (delivery) => ({
            order_id: orderId,
            status: order.status,
            shipping_data: delivery,
          }),
          (error) => {
            throw toHttpException(error);
          },
        ),
      (error) => {
        throw toHttpException(error);
      },
    );
  }
}
