import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DriversModule } from '../drivers/drivers.module';
import { GroupementSettings } from './entities/groupement-settings.entity';
import { Groupement } from './entities/groupement.entity';
import { GroupementsController } from './groupements.controller';
import { GroupementsService } from './groupements.service';

/**
 * Module Groupements — gestion des groupements de taxis.
 *
 * Toutes les opérations sont réservées au SUPER_ADMIN.
 * Ce module est le point d'ancrage de la donnée :
 * Users, Drivers, Clients et Courses pointent tous vers un Groupement.
 *
 * Pas de RLS sur la table groupements (l'objet EST le tenant).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Groupement, GroupementSettings]), DriversModule],
  controllers: [GroupementsController],
  providers: [GroupementsService],
  exports: [GroupementsService],
})
export class GroupementsModule {}
