/**
 * Script de seed pour créer le premier SUPER_ADMIN.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-super-admin.ts
 *
 * Variables d'environnement optionnelles:
 *   SUPER_ADMIN_EMAIL       (défaut: admin@taxikiwi.local)
 *   SUPER_ADMIN_PASSWORD    (défaut: Admin123!)
 *   SUPER_ADMIN_FIRST_NAME  (défaut: Super)
 *   SUPER_ADMIN_LAST_NAME   (défaut: Admin)
 */
import 'reflect-metadata';

import argon2 from 'argon2';

import dataSource from '../modules/core/database/data-source';

const DEFAULTS = {
  email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@taxikiwi.local',
  password: process.env.SUPER_ADMIN_PASSWORD ?? 'Admin123!',
  firstName: process.env.SUPER_ADMIN_FIRST_NAME ?? 'Super',
  lastName: process.env.SUPER_ADMIN_LAST_NAME ?? 'Admin',
};

async function main(): Promise<void> {
  console.log('🔌 Connexion à la base de données...');
  await dataSource.initialize();

  const usersRepo = dataSource.getRepository('users');

  // Vérifier si un SUPER_ADMIN existe déjà
  const existing = await usersRepo
    .createQueryBuilder('u')
    .select('u.email', 'email')
    .where(`:role = ANY(u.roles)`, { role: 'SUPER_ADMIN' })
    .getRawOne<{ email: string }>();

  if (existing) {
    console.log(`⚠️  Un SUPER_ADMIN existe déjà : ${existing.email}`);
    console.log('   Aucune modification effectuée.');
    await dataSource.destroy();
    return;
  }

  // Hasher le mot de passe avec argon2id (mêmes params que l'API)
  const memoryCost = Number(process.env.ARGON2_MEMORY_COST ?? 19456);
  const timeCost = Number(process.env.ARGON2_TIME_COST ?? 2);
  const parallelism = Number(process.env.ARGON2_PARALLELISM ?? 1);

  const passwordHash = await argon2.hash(DEFAULTS.password, {
    memoryCost,
    parallelism,
    timeCost,
    type: argon2.argon2id,
  });

  // Insérer le SUPER_ADMIN
  await usersRepo
    .createQueryBuilder()
    .insert()
    .into('users')
    .values({
      firstName: DEFAULTS.firstName,
      lastName: DEFAULTS.lastName,
      email: DEFAULTS.email.trim().toLowerCase(),
      passwordHash: passwordHash,
      passwordUpdatedAt: new Date(),
      roles: () => `ARRAY['SUPER_ADMIN']::text[]`,
      isActive: true,
      groupementId: null,
    })
    .execute();

  console.log('');
  console.log('✅ SUPER_ADMIN créé avec succès !');
  console.log('');
  console.log('   📧 Email:      ', DEFAULTS.email);
  console.log('   🔑 Mot de passe:', DEFAULTS.password);
  console.log('   👤 Nom:        ', `${DEFAULTS.firstName} ${DEFAULTS.lastName}`);
  console.log('   🛡️  Rôle:       ', 'SUPER_ADMIN');
  console.log('');
  console.log('⚠️  Pensez à changer le mot de passe après la première connexion !');

  await dataSource.destroy();
}

main().catch((error) => {
  console.error('❌ Erreur lors du seed :', error);
  process.exit(1);
});
