import { ApiProperty } from '@nestjs/swagger';

import { UserRole } from '../../auth/types/role.enum';

export class UserInvitationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  groupementId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole, isArray: true })
  roles!: UserRole[];

  @ApiProperty()
  expiresAt!: Date;
}
