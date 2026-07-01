import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { CourseStatus } from '../types/course-status.enum';

export class CourseResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  groupementId!: string;

  @ApiProperty({ format: 'uuid' })
  driverId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  clientId!: null | string;

  @ApiProperty()
  pickupAddress!: string;

  @ApiProperty()
  dropoffAddress!: string;

  @ApiProperty()
  startedAt!: Date;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  distanceKm!: number;

  @ApiPropertyOptional({ nullable: true })
  amountEur!: null | number;

  @ApiProperty({ enum: CourseStatus })
  status!: CourseStatus;

  @ApiPropertyOptional({ nullable: true })
  note!: null | string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
