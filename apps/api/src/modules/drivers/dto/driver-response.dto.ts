import { ApiProperty } from '@nestjs/swagger';

import { DriverStatus } from '../types/driver-status.enum';

export class DriverResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  groupementId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  userId!: string | null;

  @ApiProperty({ example: 'T1' })
  driverIdentifier!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  matricule!: string;

  @ApiProperty()
  phoneE164!: string;

  @ApiProperty({ nullable: true })
  licenseCity!: string | null;

  @ApiProperty({ nullable: true })
  licenseNumber!: string | null;

  @ApiProperty()
  joinedAt!: Date;

  @ApiProperty()
  vehicleMake!: string;

  @ApiProperty()
  vehicleModel!: string;

  @ApiProperty()
  vehicleRegistration!: string;

  @ApiProperty()
  vehicleYear!: number;

  @ApiProperty({ enum: DriverStatus })
  status!: DriverStatus;

  @ApiProperty({ nullable: true })
  statusReason!: string | null;

  @ApiProperty()
  statusChangedAt!: Date;

  @ApiProperty({ nullable: true })
  suspendedAt!: Date | null;

  @ApiProperty({ nullable: true })
  offboardedAt!: Date | null;

  @ApiProperty()
  isGroupAdmin!: boolean;

  @ApiProperty({ nullable: true })
  mobileActivatedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
