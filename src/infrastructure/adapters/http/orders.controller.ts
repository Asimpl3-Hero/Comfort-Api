import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateOrderRequestDto } from '../../../application/dto/create-order-request.dto';
import { CreateOrderUseCase } from '../../../application/use-cases/create-order.use-case';
import { GetOrderByIdUseCase } from '../../../application/use-cases/get-order-by-id.use-case';
import {
  APP_ERROR_SCHEMA,
  CREATE_ORDER_REQUEST_SCHEMA,
  ORDER_BY_ID_RESPONSE_SCHEMA,
  ORDER_CREATED_RESPONSE_SCHEMA,
} from './docs/swagger.schemas';
import { toHttpException } from './http-error.mapper';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create order',
    description:
      'Creates a PENDING order for a product and starts background polling for Wompi status.',
  })
  @ApiBody({
    schema: CREATE_ORDER_REQUEST_SCHEMA,
  })
  @ApiCreatedResponse({
    description: 'Order created and polling started.',
    schema: ORDER_CREATED_RESPONSE_SCHEMA,
  })
  @ApiBadRequestResponse({
    description: 'Invalid payload or payment method data.',
    schema: APP_ERROR_SCHEMA,
  })
  @ApiConflictResponse({
    description: 'Product out of stock.',
    schema: APP_ERROR_SCHEMA,
  })
  @ApiNotFoundResponse({
    description: 'Product not found.',
    schema: APP_ERROR_SCHEMA,
  })
  @ApiBadGatewayResponse({
    description: 'Wompi provider error.',
    schema: APP_ERROR_SCHEMA,
  })
  @ApiInternalServerErrorResponse({
    description: 'Persistence or polling initialization error.',
    schema: APP_ERROR_SCHEMA,
  })
  public async createOrder(@Body() body: CreateOrderRequestDto) {
    const result = await this.createOrderUseCase.execute({
      productId: body.productId,
      quantity: body.quantity,
      customerEmail: body.customerEmail,
      shippingData: body.shippingData,
      paymentMethodType: body.paymentMethodType,
      paymentMethodData: body.paymentMethodData,
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
  @ApiOperation({
    summary: 'Get order by id',
    description: 'Returns current order status and order data.',
  })
  @ApiParam({
    name: 'id',
    description: 'Order UUID',
    type: String,
    format: 'uuid',
  })
  @ApiOkResponse({
    description: 'Order found.',
    schema: ORDER_BY_ID_RESPONSE_SCHEMA,
  })
  @ApiNotFoundResponse({
    description: 'Order not found.',
    schema: APP_ERROR_SCHEMA,
  })
  @ApiInternalServerErrorResponse({
    description: 'Persistence or infrastructure error.',
    schema: APP_ERROR_SCHEMA,
  })
  public async getOrderById(@Param('id') orderId: string) {
    const result = await this.getOrderByIdUseCase.execute(orderId);

    return result.match(
      (order) => ({
        id: order.id,
        product_id: order.productId,
        quantity: order.quantity,
        amount_in_cents: order.amountInCents,
        currency: order.currency,
        wompi_transaction_id: order.wompiTransactionId,
        shipping_data: order.shippingData ?? null,
        status: order.status,
        created_at: order.createdAt,
      }),
      (error) => {
        throw toHttpException(error);
      },
    );
  }
}
