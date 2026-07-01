import { ApiProperty } from '@nestjs/swagger';

export class ClientAddressResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  clientId!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  addressLine1!: string;

  @ApiProperty({ nullable: true })
  addressLine2!: string | null;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  countryCode!: string;

  @ApiProperty()
  isDefault!: boolean;
}

export class ClientResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  groupementId!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ nullable: true })
  gender!: string | null;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty()
  phoneE164!: string;

  @ApiProperty()
  isBlacklisted!: boolean;

  @ApiProperty({ nullable: true })
  blacklistReason!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ nullable: true })
  anonymizationRequestedAt!: Date | null;

  @ApiProperty({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty({ type: [ClientAddressResponseDto] })
  addresses!: ClientAddressResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
