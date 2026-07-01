import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../types/role.enum';

export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@taxikiwi.local' })
  email!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  groupementId!: string | null;

  @ApiProperty({ enum: UserRole, isArray: true })
  roles!: UserRole[];

  @ApiProperty({ format: 'uuid', nullable: true, required: false })
  driverId?: string | null;

  @ApiProperty({ example: 'T1', nullable: true, required: false })
  driverIdentifier?: string | null;

  @ApiProperty({ required: false })
  isGroupAdmin?: boolean;
}

export class AuthTokenResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: 'Bearer';

  @ApiProperty({ example: 900, description: 'Durée de vie du token en secondes' })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserResponseDto })
  user!: AuthUserResponseDto;
}
