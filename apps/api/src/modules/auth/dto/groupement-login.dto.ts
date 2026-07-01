import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class GroupementLoginDto {
  @ApiProperty({ example: 'TAXI-KIWI' })
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/)
  groupementCode!: string;

  @ApiProperty({ example: 'T1' })
  @IsString()
  @MaxLength(16)
  @Matches(/^T\d+$/i, { message: "L'identifiant chauffeur doit suivre le format T1, T2..." })
  identifier!: string;

  @ApiProperty({ example: 'StrongPassword12345!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
