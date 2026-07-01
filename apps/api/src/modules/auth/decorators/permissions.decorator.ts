import { SetMetadata } from '@nestjs/common';

import { Permission } from '../types/permission.enum';

export const PERMISSIONS_KEY = 'auth:permissions';

export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
