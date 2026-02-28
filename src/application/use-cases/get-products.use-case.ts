import { Inject, Injectable } from '@nestjs/common';
import {
  PRODUCT_REPOSITORY_PORT,
} from '../../domain/ports/product-repository.port';
import type { ProductRepositoryPort } from '../../domain/ports/product-repository.port';
import { Product } from '../../domain/entities/product.entity';
import { AppError } from '../../shared/errors/app-error';
import { Result } from '../../shared/railway/result';

@Injectable()
export class GetProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY_PORT)
    private readonly productRepository: ProductRepositoryPort,
  ) {}

  public async execute(): Promise<Result<Product[], AppError>> {
    return this.productRepository.findAll();
  }
}
