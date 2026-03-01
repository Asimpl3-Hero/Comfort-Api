import { PrismaProductRepositoryAdapter } from '../../../../../src/infrastructure/adapters/persistence/prisma-product.repository.adapter';

describe('PrismaProductRepositoryAdapter', () => {
  const prisma = {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
  } as any;

  let adapter: PrismaProductRepositoryAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PrismaProductRepositoryAdapter(prisma);
  });

  it('returns mapped products on findAll', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'N',
        description: 'D',
        priceInCents: 100,
        stock: 3,
        currency: 'COP',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await adapter.findAll();

    expect(result.isOk()).toBe(true);
    expect(prisma.product.findMany).toHaveBeenCalled();
  });

  it('returns persistence error on findAll failure', async () => {
    prisma.product.findMany.mockRejectedValue(new Error('db'));

    const result = await adapter.findAll();

    expect(result.isErr()).toBe(true);
  });

  it('returns null when product is missing', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const result = await adapter.findById('missing');

    expect(result.match((v) => v, () => 'err')).toBeNull();
  });

  it('returns mapped product on findById', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'p1',
      name: 'N',
      description: 'D',
      priceInCents: 100,
      stock: 3,
      currency: 'COP',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await adapter.findById('p1');

    expect(result.isOk()).toBe(true);
  });

  it('decrements stock when enough units are available', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 1 });

    const result = await adapter.decrementStock('p1', 1);

    expect(result.isOk()).toBe(true);
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'p1',
        stock: {
          gte: 1,
        },
      },
      data: {
        stock: {
          decrement: 1,
        },
      },
    });
  });

  it('returns OUT_OF_STOCK when no rows are updated', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 0 });

    const result = await adapter.decrementStock('p1', 2);
    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(result.isErr()).toBe(true);
    expect(error?.code).toBe('OUT_OF_STOCK');
  });
});
