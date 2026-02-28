export type OrderStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

export interface Order {
  id: string;
  productId: string;
  amountInCents: number;
  currency: string;
  wompiTransactionId: string;
  status: OrderStatus;
  createdAt: Date;
}
