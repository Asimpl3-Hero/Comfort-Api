import { Product } from '../entities/product.entity';
import { AppError } from '../../shared/errors/app-error';
import { Result } from '../../shared/railway/result';

export const PRODUCT_REPOSITORY_PORT = Symbol('PRODUCT_REPOSITORY_PORT');

export interface ProductRepositoryPort {
  findAll(): Promise<Result<Product[], AppError>>;
  findById(id: string): Promise<Result<Product | null, AppError>>;
  decrementStock(
    productId: string,
    units: number,
  ): Promise<Result<void, AppError>>;
}
