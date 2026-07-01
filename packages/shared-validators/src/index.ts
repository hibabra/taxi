// @taxikiwi/shared-validators — schémas Zod partagés API ↔ Backoffice
// Dépendance runtime : zod uniquement.

export {
  changePasswordSchema,
  groupementLoginSchema,
  loginSchema,
  platformLoginSchema,
  type ChangePasswordInput,
  type GroupementLoginInput,
  type LoginInput,
  type PlatformLoginInput,
} from './auth.schemas';
export {
  acceptDriverInvitationSchema,
  assignGroupAdminSchema,
  createDriverInvitationSchema,
  type AcceptDriverInvitationInput,
  type AssignGroupAdminInput,
  type CreateDriverInvitationInput,
} from './driver.schemas';
export {
  createGroupementSchema,
  updateGroupementSchema,
  type CreateGroupementInput,
  type UpdateGroupementInput,
} from './groupement.schemas';
