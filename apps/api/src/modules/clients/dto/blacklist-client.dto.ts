import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class BlacklistClientDto {
  @ApiProperty({ example: 'Comportement agressif envers les chauffeurs' })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  reason!: string;
}
