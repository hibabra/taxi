import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendDriverDto {
  @ApiPropertyOptional({ example: 'Documents administratifs à renouveler' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  reason?: string;
}
