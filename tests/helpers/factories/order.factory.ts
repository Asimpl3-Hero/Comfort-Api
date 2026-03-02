import type { Order } from '../../../src/domain/entities/order.entity';
import type { Product } from '../../../src/domain/entities/product.entity';
import type { CreatedWompiTransaction } from '../../../src/domain/ports/payment-gateway.port';

export const buildProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'f8f85493-3323-46b8-a6a6-0734496d72cd',
  name: 'Orthopedic Pillow',
  description: 'Memory-foam pillow',
  priceInCents: 12900,
  stock: 10,
  currency: 'COP',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

export const buildOrder = (overrides: Partial<Order> = {}): Order => ({
  id: '97fb06c8-0df9-42a5-9534-732f54a08c72',
  productId: 'f8f85493-3323-46b8-a6a6-0734496d72cd',
  quantity: 1,
  amountInCents: 12900,
  currency: 'COP',
  wompiTransactionId: 'wompi_tx_123',
  status: 'PENDING',
  createdAt: new Date('2026-01-01T00:01:00.000Z'),
  ...overrides,
});

export const buildCreatedTransaction = (
  overrides: Partial<CreatedWompiTransaction> = {},
): CreatedWompiTransaction => ({
  transactionId: 'wompi_tx_123',
  checkoutUrl: 'https://checkout.wompi.co/p/?reference=abc',
  providerStatus: 'PENDING',
  ...overrides,
});
