import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PAYMENT_METHOD_TYPES } from '../../domain/ports/payment-gateway.port';

export class PaymentMethodDataDto {
  @IsOptional()
  @IsString()
  public cardToken?: string;

  @IsOptional()
  @IsString()
  public phoneNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1)
  public userType?: number;

  @IsOptional()
  @IsIn(['CC', 'NIT'])
  public userLegalIdType?: 'CC' | 'NIT';

  @IsOptional()
  @IsString()
  public userLegalId?: string;

  @IsOptional()
  @IsString()
  public financialInstitutionCode?: string;

  @IsOptional()
  @IsString()
  public paymentDescription?: string;

  @IsOptional()
  @IsIn(['APPROVED', 'DECLINED'])
  public sandboxStatus?: 'APPROVED' | 'DECLINED';
}

export class CreateOrderRequestDto {
  @IsUUID()
  public productId!: string;

  @IsOptional()
  @IsIn(PAYMENT_METHOD_TYPES)
  public paymentMethodType?: (typeof PAYMENT_METHOD_TYPES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentMethodDataDto)
  public paymentMethodData?: PaymentMethodDataDto;
}
