import { IsUUID } from 'class-validator';

export class CreateOrderRequestDto {
  @IsUUID()
  public productId!: string;
}
