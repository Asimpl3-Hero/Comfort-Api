import { PrismaOrderRepositoryAdapter } from '../../../../../src/infrastructure/adapters/persistence/prisma-order.repository.adapter';

describe('PrismaOrderRepositoryAdapter', () => {
  const prisma = {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  let adapter: PrismaOrderRepositoryAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new PrismaOrderRepositoryAdapter(prisma);
  });

  it('creates and maps pending order', async () => {
    prisma.order.create.mockResolvedValue({
      id: 'o1',
      productId: 'p1',
      amountInCents: 1000,
      currency: 'COP',
      wompiTransactionId: 'tx1',
      status: 'PENDING',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await adapter.createPending({
      productId: 'p1',
      amountInCents: 1000,
      currency: 'COP',
      wompiTransactionId: 'tx1',
    });

    expect(result.isOk()).toBe(true);
  });

  it('returns persistence error when createPending fails', async () => {
    prisma.order.create.mockRejectedValue(new Error('db create'));

    const result = await adapter.createPending({
      productId: 'p1',
      amountInCents: 1000,
      currency: 'COP',
      wompiTransactionId: 'tx1',
    });

    expect(result.isErr()).toBe(true);
  });

  it('returns null when order does not exist', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    const result = await adapter.findById('missing');

    expect(
      result.match(
        (v) => v,
        () => 'err',
      ),
    ).toBeNull();
  });

  it('returns pending orders list', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        productId: 'p1',
        amountInCents: 1000,
        currency: 'COP',
        wompiTransactionId: 'tx1',
        status: 'PENDING',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await adapter.findPending();

    expect(result.isOk()).toBe(true);
    expect(prisma.order.findMany).toHaveBeenCalled();
  });

  it('returns persistence error when findById fails', async () => {
    prisma.order.findUnique.mockRejectedValue(new Error('db findUnique'));

    const result = await adapter.findById('o1');

    expect(result.isErr()).toBe(true);
  });

  it('returns persistence error when findPending fails', async () => {
    prisma.order.findMany.mockRejectedValue(new Error('db findMany'));

    const result = await adapter.findPending();

    expect(result.isErr()).toBe(true);
  });

  it('updates order status', async () => {
    prisma.order.update.mockResolvedValue({
      id: 'o1',
      productId: 'p1',
      amountInCents: 1000,
      currency: 'COP',
      wompiTransactionId: 'tx1',
      status: 'APPROVED',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await adapter.updateStatus('o1', 'APPROVED');

    expect(result.isOk()).toBe(true);
  });

  it('returns persistence error on db failures', async () => {
    prisma.order.update.mockRejectedValue(new Error('db'));

    const result = await adapter.updateStatus('o1', 'APPROVED');

    expect(result.isErr()).toBe(true);
  });
});
