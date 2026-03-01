import { Controller, Get } from '@nestjs/common';
import { GetProductsUseCase } from '../../../application/use-cases/get-products.use-case';
import { toHttpException } from './http-error.mapper';

@Controller('products')
export class ProductsController {
  constructor(private readonly getProductsUseCase: GetProductsUseCase) {}

  @Get()
  public async getProducts() {
    const result = await this.getProductsUseCase.execute();

    return result.match(
      (products) =>
        products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price_in_cents: product.priceInCents,
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
