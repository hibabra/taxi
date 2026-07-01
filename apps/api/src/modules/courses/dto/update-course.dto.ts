import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { CourseStatus } from '../types/course-status.enum';

export class UpdateCourseDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  clientId?: null | string;

  @ApiPropertyOptional({ example: '12 rue de Sèvres, 92310 Sèvres' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  pickupAddress?: string;

  @ApiPropertyOptional({ example: 'Gare Montparnasse, Paris' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  dropoffAddress?: string;

  @ApiPropertyOptional({ example: '2026-05-02T09:30:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startedAt?: Date;

  @ApiPropertyOptional({ example: 28, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 12.4, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  distanceKm?: number;

  @ApiPropertyOptional({
    description: 'Montant indicatif de la course. Aucun paiement n’est géré par TaxiKiwi.',
    example: 34.5,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  amountEur?: null | number;

  @ApiPropertyOptional({ enum: CourseStatus })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @ApiPropertyOptional({ example: "Correction après vérification par l'admin.", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: null | string;
}
