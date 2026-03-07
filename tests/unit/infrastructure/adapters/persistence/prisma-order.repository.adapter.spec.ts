import { PrismaOrderRepositoryAdapter } from '../../../../../src/infrastructure/adapters/persistence/prisma-order.repository.adapter';

describe('PrismaOrderRepositoryAdapter', () => {
  const prisma = {
    $transaction: jest.fn(),
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    product: {
      updateMany: jest.fn(),
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
      quantity: 1,
      amountInCents: 1000,
      currency: 'COP',
      customerEmail: 'buyer@example.com',
      wompiTransactionId: 'tx1',
      shippingFullName: 'Buyer Example',
      shippingEmail: 'buyer@example.com',
      shippingPhone: '3001234567',
      shippingAddress1: 'Street 123',
      shippingAddress2: null,
      shippingCity: 'Bogota',
      shippingState: 'Cundinamarca',
      shippingZip: '110111',
      shippingCountry: 'CO',
      status: 'PENDING',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await adapter.createPending({
      productId: 'p1',
      quantity: 1,
      amountInCents: 1000,
      currency: 'COP',
      customerEmail: 'buyer@example.com',
      wompiTransactionId: 'tx1',
      shippingData: {
        fullName: 'Buyer Example',
        email: 'buyer@example.com',
        phone: '3001234567',
        address1: 'Street 123',
        city: 'Bogota',
        state: 'Cundinamarca',
        zip: '110111',
        country: 'CO',
      },
    });

    expect(result.isOk()).toBe(true);
  });

  it('returns persistence error when createPending fails', async () => {
    prisma.order.create.mockRejectedValue(new Error('db create'));

    const result = await adapter.createPending({
      productId: 'p1',
      quantity: 1,
      amountInCents: 1000,
      currency: 'COP',
      customerEmail: 'buyer@example.com',
      wompiTransactionId: 'tx1',
      shippingData: {
        fullName: 'Buyer Example',
        email: 'buyer@example.com',
        address1: 'Street 123',
        city: 'Bogota',
        state: 'Cundinamarca',
        zip: '110111',
      },
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
        quantity: 1,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        shippingFullName: null,
        shippingEmail: null,
        shippingPhone: null,
        shippingAddress1: null,
        shippingAddress2: null,
        shippingCity: null,
        shippingState: null,
        shippingZip: null,
        shippingCountry: null,
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
      quantity: 1,
      amountInCents: 1000,
      currency: 'COP',
      customerEmail: 'buyer@example.com',
      wompiTransactionId: 'tx1',
      shippingFullName: null,
      shippingEmail: null,
      shippingPhone: null,
      shippingAddress1: null,
      shippingAddress2: null,
      shippingCity: null,
      shippingState: null,
      shippingZip: null,
      shippingCountry: null,
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

  it('finds orders by customer email', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'o1',
        productId: 'p1',
        quantity: 1,
        amountInCents: 1000,
        currency: 'COP',
        customerEmail: 'buyer@example.com',
        wompiTransactionId: 'tx1',
        shippingFullName: 'Buyer',
        shippingEmail: 'buyer@example.com',
        shippingPhone: null,
        shippingAddress1: 'Street 1',
        shippingAddress2: null,
        shippingCity: 'Bogota',
        shippingState: 'Cundinamarca',
        shippingZip: '110111',
        shippingCountry: 'CO',
        status: 'PENDING',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await adapter.findByCustomerEmail('buyer@example.com');

    expect(result.isOk()).toBe(true);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerEmail: 'buyer@example.com' },
      }),
    );
  });

  it('returns delivery info by order id', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      productId: 'p1',
      quantity: 1,
      amountInCents: 1000,
      currency: 'COP',
      customerEmail: 'buyer@example.com',
      wompiTransactionId: 'tx1',
      shippingFullName: 'Buyer',
      shippingEmail: 'buyer@example.com',
      shippingPhone: null,
      shippingAddress1: 'Street 1',
      shippingAddress2: null,
      shippingCity: 'Bogota',
      shippingState: 'Cundinamarca',
      shippingZip: '110111',
      shippingCountry: 'CO',
      status: 'PENDING',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await adapter.findDeliveryByOrderId('o1');
    expect(result.isOk()).toBe(true);
    expect(
      result.match(
        (value) => value,
        () => null,
      ),
    ).toEqual({
      fullName: 'Buyer',
      email: 'buyer@example.com',
      address1: 'Street 1',
      city: 'Bogota',
      state: 'Cundinamarca',
      zip: '110111',
      country: 'CO',
    });
  });

  it('finalizes approved order and decrements stock atomically', async () => {
    prisma.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'o1',
            productId: 'p1',
            quantity: 2,
            amountInCents: 1000,
            currency: 'COP',
            customerEmail: 'buyer@example.com',
            wompiTransactionId: 'tx1',
            shippingFullName: 'Buyer',
            shippingEmail: 'buyer@example.com',
            shippingPhone: null,
            shippingAddress1: 'Street 1',
            shippingAddress2: null,
            shippingCity: 'Bogota',
            shippingState: 'Cundinamarca',
            shippingZip: '110111',
            shippingCountry: 'CO',
            status: 'PENDING',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
          update: jest.fn().mockResolvedValue({
            id: 'o1',
            productId: 'p1',
            quantity: 2,
            amountInCents: 1000,
            currency: 'COP',
            customerEmail: 'buyer@example.com',
            wompiTransactionId: 'tx1',
            shippingFullName: 'Buyer',
            shippingEmail: 'buyer@example.com',
            shippingPhone: null,
            shippingAddress1: 'Street 1',
            shippingAddress2: null,
            shippingCity: 'Bogota',
            shippingState: 'Cundinamarca',
            shippingZip: '110111',
            shippingCountry: 'CO',
            status: 'APPROVED',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          }),
        },
        product: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return callback(tx);
    });

    const result = await adapter.approveOrderAndDecrementStock('o1');
    expect(result.isOk()).toBe(true);
  });
});
