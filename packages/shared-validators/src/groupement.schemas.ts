import { z } from 'zod';

const groupementCodeSchema = z
  .string()
  .trim()
  .max(64, 'Le code ne peut pas dépasser 64 caractères')
  .regex(/^[A-Z0-9](?:[A-Z0-9-]{0,62}[A-Z0-9])?$/, {
    message: 'Le code doit contenir lettres majuscules, chiffres et tirets',
  });

const groupementIdentitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom commercial est requis')
    .max(128, 'Le nom commercial ne peut pas dépasser 128 caractères'),
  code: groupementCodeSchema.optional().or(z.literal('')),
  address: z
    .string()
    .trim()
    .min(1, "L'adresse est requise")
    .max(512, "L'adresse ne peut pas dépasser 512 caractères"),
  postalCode: z
    .string()
    .trim()
    .min(1, 'Le code postal est requis')
    .max(10, 'Le code postal ne peut pas dépasser 10 caractères'),
  city: z
    .string()
    .trim()
    .min(1, 'La ville est requise')
    .max(128, 'La ville ne peut pas dépasser 128 caractères'),
  contactEmail: z.string().email('Adresse email invalide'),
  contactPhone: z
    .string()
    .trim()
    .min(1, 'Le téléphone de contact est requis')
    .max(20, 'Le téléphone ne peut pas dépasser 20 caractères'),
  serviceArea: z.string().trim().max(1024).optional().or(z.literal('')),
});

export const createGroupementSchema = groupementIdentitySchema.extend({
  code: groupementCodeSchema.optional().or(z.literal('')),
  initialAdmin: z.object({
    email: z.string().email("L'email de l'admin est invalide"),
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
  }),
});

export const updateGroupementSchema = groupementIdentitySchema.extend({
  code: groupementCodeSchema,
  isActive: z.boolean(),
});

export type CreateGroupementInput = z.infer<typeof createGroupementSchema>;
export type UpdateGroupementInput = z.infer<typeof updateGroupementSchema>;
