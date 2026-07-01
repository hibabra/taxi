import { ApiProperty } from '@nestjs/swagger';
import { DriverAvailabilityStatus } from '../../geolocation/types/driver-availability.enum';
export class QueueEntryDto {
  @ApiProperty() position!: number;
  @ApiProperty() driverId!: string;
  @ApiProperty() driverIdentifier!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty({ enum: DriverAvailabilityStatus })
  status!: DriverAvailabilityStatus;
  @ApiProperty() joinedQueueAt!: string;
}
export class QueueResponseDto {
  @ApiProperty() groupementId!: string;
  @ApiProperty() total!: number;
  @ApiProperty({ type: [QueueEntryDto] }) entries!: QueueEntryDto[];
}
