import { Controller, Get } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { GetProductsUseCase } from '../../../application/use-cases/get-products.use-case';
import {
  APP_ERROR_SCHEMA,
  PRODUCTS_RESPONSE_SCHEMA,
} from './docs/swagger.schemas';
import { toHttpException } from './http-error.mapper';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly getProductsUseCase: GetProductsUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'List products',
    description: 'Returns all seeded products with price and stock.',
  })
  @ApiOkResponse({
    description: 'Products list returned successfully.',
    schema: PRODUCTS_RESPONSE_SCHEMA,
  })
  @ApiBadGatewayResponse({
    description: 'Unexpected upstream/payment provider issue.',
    schema: APP_ERROR_SCHEMA,
  })
  @ApiInternalServerErrorResponse({
    description: 'Unexpected persistence or infrastructure error.',
    schema: APP_ERROR_SCHEMA,
  })
  public async getProducts() {
    const result = await this.getProductsUseCase.execute();

    return result.match(
      (products) =>
        products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price_in_cents: product.priceInCents,
          image_url: product.imageUrl ?? '',
          imageUrl: product.imageUrl ?? '',
          stock: product.stock,
          currency: product.currency,
          created_at: product.createdAt,
        })),
      (error) => {
        throw toHttpException(error);
      },
    );
  }
}
