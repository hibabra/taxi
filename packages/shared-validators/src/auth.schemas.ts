import { z } from 'zod';

/**
 * Schéma de validation pour le formulaire de connexion.
 * Utilisé côté backoffice (React Hook Form) et comme
 * référence pour le DTO côté API.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Adresse email invalide')
    .max(254, "L'email ne peut pas dépasser 254 caractères"),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const platformLoginSchema = loginSchema;

export type PlatformLoginInput = z.infer<typeof platformLoginSchema>;

export const groupementLoginSchema = z.object({
  groupementCode: z
    .string()
    .trim()
    .min(1, 'Le code groupement est requis')
    .max(64, 'Le code groupement ne peut pas dépasser 64 caractères')
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/, 'Code groupement invalide'),
  identifier: z
    .string()
    .trim()
    .max(16, "L'identifiant ne peut pas dépasser 16 caractères")
    .regex(/^T\d+$/i, 'Format attendu : T1, T2, ...'),
  password: z
    .string()
    .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
    .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères'),
});

export type GroupementLoginInput = z.infer<typeof groupementLoginSchema>;

/**
 * Schéma de validation pour le changement de mot de passe.
 */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(8, 'Le mot de passe actuel doit contenir au moins 8 caractères')
    .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères'),
  newPassword: z
    .string()
    .min(12, 'Le nouveau mot de passe doit contenir au moins 12 caractères')
    .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères'),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
