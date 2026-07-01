import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverAvailabilityStatus } from '../types/driver-availability.enum';

export class DriverPositionResponseDto {
  @ApiProperty() driverId!: string;
  @ApiProperty() groupementId!: string;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiPropertyOptional() accuracy!: number | null;
  @ApiPropertyOptional() speed!: number | null;
  @ApiPropertyOptional() heading!: number | null;
  @ApiPropertyOptional({ enum: DriverAvailabilityStatus })
  status!: DriverAvailabilityStatus | null;
  @ApiProperty() recordedAt!: Date;
}
