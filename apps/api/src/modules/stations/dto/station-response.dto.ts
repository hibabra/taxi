import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StationType } from '../stations.constants';
import { PolygonPointDto } from './create-station.dto';

export class StationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() groupementId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiPropertyOptional() address!: string | null;

  // Type de zone
  @ApiProperty({ enum: StationType }) type!: StationType;

  // Champs CIRCLE
  @ApiPropertyOptional() latitude!: number | null;
  @ApiPropertyOptional() longitude!: number | null;
  @ApiPropertyOptional() radiusMeters!: number | null; // ← number | null

  // Champs POLYGON
  @ApiPropertyOptional({ type: [PolygonPointDto] })
  polygonPoints!: { lat: number; lng: number }[] | null;

  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
