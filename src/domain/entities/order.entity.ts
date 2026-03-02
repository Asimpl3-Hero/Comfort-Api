export type OrderStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

export interface ShippingData {
  fullName: string;
  email: string;
  phone?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

export interface Order {
  id: string;
  productId: string;
  amountInCents: number;
  currency: string;
  wompiTransactionId: string;
  shippingData?: ShippingData;
  status: OrderStatus;
  createdAt: Date;
}
