import { z } from 'zod';

export const createDriverInvitationSchema = z.object({
  email: z
    .string()
    .email('Adresse email invalide')
    .max(254, "L'email ne peut pas dépasser 254 caractères"),
  licenseCity: z
    .string()
    .trim()
    .min(1, 'La ville de licence est requise')
    .max(128, 'La ville de licence ne peut pas dépasser 128 caractères'),
  licenseNumber: z
    .string()
    .trim()
    .min(1, 'Le numéro de licence est requis')
    .max(64, 'Le numéro de licence ne peut pas dépasser 64 caractères'),
});

export type CreateDriverInvitationInput = z.infer<typeof createDriverInvitationSchema>;

export const acceptDriverInvitationSchema = z.object({
  password: z
    .string()
    .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
    .max(128, 'Le mot de passe ne peut pas dépasser 128 caractères'),
  firstName: z
    .string()
    .trim()
    .min(1, 'Le prénom est requis')
    .max(128, 'Le prénom ne peut pas dépasser 128 caractères'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Le nom est requis')
    .max(128, 'Le nom ne peut pas dépasser 128 caractères'),
  phone: z
    .string()
    .trim()
    .min(6, 'Le téléphone est requis')
    .max(32, 'Le téléphone ne peut pas dépasser 32 caractères'),
  countryCode: z.literal('FR').optional(),
  vehicleMake: z
    .string()
    .trim()
    .min(1, 'La marque du véhicule est requise')
    .max(64, 'La marque ne peut pas dépasser 64 caractères'),
  vehicleModel: z
    .string()
    .trim()
    .min(1, 'Le modèle du véhicule est requis')
    .max(64, 'Le modèle ne peut pas dépasser 64 caractères'),
  vehicleRegistration: z
    .string()
    .trim()
    .min(1, "L'immatriculation est requise")
    .max(32, "L'immatriculation ne peut pas dépasser 32 caractères"),
  vehicleYear: z.coerce
    .number()
    .int("L'année doit être un nombre entier")
    .min(1980, "L'année minimale est 1980")
    .max(2100, "L'année maximale est 2100"),
});

export type AcceptDriverInvitationInput = z.infer<typeof acceptDriverInvitationSchema>;

export const assignGroupAdminSchema = z.object({
  driverId: z.string().uuid('Chauffeur invalide'),
});

export type AssignGroupAdminInput = z.infer<typeof assignGroupAdminSchema>;
