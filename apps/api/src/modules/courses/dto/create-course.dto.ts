import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateCourseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  driverId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  clientId?: null | string;

  @ApiProperty({ example: '12 rue de Sèvres, 92310 Sèvres' })
  @IsString()
  @MaxLength(1000)
  pickupAddress!: string;

  @ApiProperty({ example: 'Gare Montparnasse, Paris' })
  @IsString()
  @MaxLength(1000)
  dropoffAddress!: string;

  @ApiProperty({ example: '2026-05-02T09:30:00.000Z' })
  @Type(() => Date)
  @IsDate()
  startedAt!: Date;

  @ApiProperty({ example: 28, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  durationMinutes!: number;

  @ApiProperty({ example: 12.4, minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999.99)
  distanceKm!: number;

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

  @ApiPropertyOptional({ enum: CourseStatus, default: CourseStatus.COMPLETED })
  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @ApiPropertyOptional({ example: 'Client pressé, arrivée côté Hall 2.', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: null | string;
}
