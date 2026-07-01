import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SearchClientQueryDto {
  @ApiProperty({ example: '06 12 34 56 78' })
  @IsString()
  @MaxLength(32)
  phone!: string;

  @ApiPropertyOptional({ example: 'FR', default: 'FR' })
  @IsOptional()
  @IsString()
  @Matches(/^FR$/i, { message: 'Seul le pays FR est supporté en Vague 1' })
  countryCode?: string;
}
