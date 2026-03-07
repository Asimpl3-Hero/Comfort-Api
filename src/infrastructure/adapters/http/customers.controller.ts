import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GetCustomerOrdersUseCase } from '../../../application/use-cases/get-customer-orders.use-case';
import {
  APP_ERROR_SCHEMA,
  CUSTOMER_ORDERS_RESPONSE_SCHEMA,
  CUSTOMER_PROFILE_RESPONSE_SCHEMA,
} from './docs/swagger.schemas';
import { toHttpException } from './http-error.mapper';

@ApiTags('Customers')
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly getCustomerOrdersUseCase: GetCustomerOrdersUseCase,
  ) {}

  @Get(':email')
  @ApiOperation({
    summary: 'Get customer profile',
    description: 'Returns customer profile data inferred from customer orders.',
  })
  @ApiParam({
    name: 'email',
    description: 'Customer email',
    type: String,
  })
  @ApiOkResponse({
    description: 'Customer profile found.',
    schema: CUSTOMER_PROFILE_RESPONSE_SCHEMA,
  })
  @ApiNotFoundResponse({
    description: 'Customer not found.',
    schema: APP_ERROR_SCHEMA,
  })
  @ApiInternalServerErrorResponse({
    description: 'Persistence or infrastructure error.',
    schema: APP_ERROR_SCHEMA,
  })
  public async getCustomerProfile(@Param('email') email: string) {
    const result = await this.getCustomerOrdersUseCase.execute(email);
    return result.match(
      (orders) => {
        if (orders.length === 0) {
          throw toHttpException({
            code: 'CUSTOMER_NOT_FOUND',
            message: `Customer ${email} was not found.`,
          });
        }

        const latestOrder = orders[0];

        return {
          email,
          full_name: latestOrder.shippingData?.fullName ?? '',
          phone: latestOrder.shippingData?.phone ?? null,
          last_order_id: latestOrder.id,
          last_order_status: latestOrder.status,
        };
      },
      (error) => {
        throw toHttpException(error);
      },
    );
  }

  @Get(':email/orders')
  @ApiOperation({
    summary: 'List customer orders',
    description: 'Returns all orders associated with a customer email.',
  })
  @ApiParam({
    name: 'email',
    description: 'Customer email',
    type: String,
  })
  @ApiOkResponse({
    description: 'Customer orders found.',
    schema: CUSTOMER_ORDERS_RESPONSE_SCHEMA,
  })
  @ApiNotFoundResponse({
    description: 'Customer not found.',
    schema: APP_ERROR_SCHEMA,
  })
  @ApiInternalServerErrorResponse({
    description: 'Persistence or infrastructure error.',
    schema: APP_ERROR_SCHEMA,
  })
  public async getCustomerOrders(@Param('email') email: string) {
    const result = await this.getCustomerOrdersUseCase.execute(email);
    return result.match(
      (orders) => {
        if (orders.length === 0) {
          throw toHttpException({
            code: 'CUSTOMER_NOT_FOUND',
            message: `Customer ${email} was not found.`,
          });
        }

        return orders.map((order) => ({
          id: order.id,
          product_id: order.productId,
          quantity: order.quantity,
          amount_in_cents: order.amountInCents,
          currency: order.currency,
          status: order.status,
          created_at: order.createdAt,
        }));
      },
      (error) => {
        throw toHttpException(error);
      },
    );
  }
}
