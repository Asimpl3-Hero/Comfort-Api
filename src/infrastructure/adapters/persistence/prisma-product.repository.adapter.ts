import { Injectable } from '@nestjs/common';
import { Product } from '../../../domain/entities/product.entity';
import type { ProductRepositoryPort } from '../../../domain/ports/product-repository.port';
import { AppError } from '../../../shared/errors/app-error';
import { Result, err, ok } from '../../../shared/railway/result';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaProductRepositoryAdapter implements ProductRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  public async findAll(): Promise<Result<Product[], AppError>> {
    try {
      const products = await this.prisma.product.findMany({
        orderBy: {
          createdAt: 'asc',
        },
      });

      return ok(
        products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          priceInCents: product.priceInCents,
          stock: product.stock,
          currency: product.currency,
          createdAt: product.createdAt,
        })),
      );
    } catch (cause) {
      return err({
        code: 'PERSISTENCE_ERROR',
        message: 'Failed to fetch products.',
        details: cause,
      });
    }
  }

  public async findById(id: string): Promise<Result<Product | null, AppError>> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        return ok(null);
      }

      return ok({
        id: product.id,
        name: product.name,
        description: product.description,
        priceInCents: product.priceInCents,
        stock: product.stock,
        currency: product.currency,
        createdAt: product.createdAt,
      });
    } catch (cause) {
      return err({
        code: 'PERSISTENCE_ERROR',
        message: 'Failed to fetch product by id.',
        details: cause,
      });
    }
  }
}
