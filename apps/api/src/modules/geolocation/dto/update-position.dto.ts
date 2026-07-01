import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsLatitude, IsLongitude, IsNumber, IsOptional, Max, Min } from 'class-validator';

import { DriverAvailabilityStatus } from '../types/driver-availability.enum';

export class UpdatePositionDto {
  @ApiProperty({ example: 48.8566, description: 'Latitude GPS' })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 2.3522, description: 'Longitude GPS' })
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ example: 10.5, description: 'Précision en mètres' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  @ApiPropertyOptional({ example: 50.2, description: 'Vitesse en km/h' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  speed?: number;

  @ApiPropertyOptional({ example: 180.0, description: 'Direction en degrés' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  heading?: number;

  @ApiPropertyOptional({
    enum: DriverAvailabilityStatus,
    example: DriverAvailabilityStatus.LIBRE,
    description: 'Statut de disponibilité du chauffeur',
  })
  @IsOptional()
  @IsEnum(DriverAvailabilityStatus)
  status?: DriverAvailabilityStatus;
}
