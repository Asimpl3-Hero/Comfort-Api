export interface Product {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  imageUrl?: string;
  stock: number;
  currency: string;
  createdAt: Date;
}
