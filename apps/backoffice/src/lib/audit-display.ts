import type { AuditLog } from '@taxikiwi/shared-types';

type AuditTone = 'default' | 'secondary' | 'destructive' | 'outline';

type AuditActionPresentation = {
  category: string;
  label: string;
  tone: AuditTone;
};

const ACTION_PRESENTATION: Record<string, AuditActionPresentation> = {
  AUTH_LOGIN: { category: 'Connexion', label: 'Connexion réussie', tone: 'secondary' },
  AUTH_LOGOUT: { category: 'Connexion', label: 'Déconnexion', tone: 'secondary' },
  AUTH_PASSWORD_CHANGED: {
    category: 'Sécurité',
    label: 'Mot de passe changé',
    tone: 'outline',
  },
  AUTH_REFRESH: { category: 'Session', label: 'Session prolongée', tone: 'secondary' },
  AUTH_TOKEN_REUSE_DETECTED: {
    category: 'Alerte sécurité',
    label: 'Session suspecte',
    tone: 'destructive',
  },
  CLIENT_ADDRESS_CREATED: { category: 'Client', label: 'Adresse ajoutée', tone: 'default' },
  CLIENT_ADDRESS_DELETED: { category: 'Client', label: 'Adresse supprimée', tone: 'destructive' },
  CLIENT_ADDRESS_UPDATED: { category: 'Client', label: 'Adresse modifiée', tone: 'outline' },
  CLIENT_ARCHIVED: { category: 'Client', label: 'Client archivé', tone: 'destructive' },
  CLIENT_BLACKLISTED: { category: 'Client', label: 'Client blacklisté', tone: 'destructive' },
  CLIENT_CREATED: { category: 'Client', label: 'Client créé', tone: 'default' },
  CLIENT_DELETED: { category: 'Client', label: 'Client supprimé', tone: 'destructive' },
  CLIENT_UNARCHIVED: { category: 'Client', label: 'Client réactivé', tone: 'default' },
  CLIENT_UNBLACKLISTED: { category: 'Client', label: 'Client retiré de blacklist', tone: 'default' },
  CLIENT_UPDATED: { category: 'Client', label: 'Client modifié', tone: 'outline' },
  COURSE_CREATED: { category: 'Course', label: 'Course créée', tone: 'default' },
  COURSE_DELETED: { category: 'Course', label: 'Course supprimée', tone: 'destructive' },
  COURSE_STATUS_CHANGED: { category: 'Course', label: 'Statut changé', tone: 'outline' },
  COURSE_UPDATED: { category: 'Course', label: 'Course modifiée', tone: 'outline' },
  DRIVER_CREATED: { category: 'Chauffeur', label: 'Chauffeur créé', tone: 'default' },
  DRIVER_DELETED: { category: 'Chauffeur', label: 'Chauffeur supprimé', tone: 'destructive' },
  DRIVER_INVITED: { category: 'Chauffeur', label: 'Chauffeur invité', tone: 'default' },
  DRIVER_PHONE_DUPLICATE_WARNING: {
    category: 'Chauffeur',
    label: 'Téléphone déjà utilisé',
    tone: 'destructive',
  },
  DRIVER_STATUS_CHANGED: { category: 'Chauffeur', label: 'Statut changé', tone: 'outline' },
  DRIVER_UPDATED: { category: 'Chauffeur', label: 'Chauffeur modifié', tone: 'outline' },
  GROUPEMENT_CREATED: { category: 'Groupement', label: 'Groupement créé', tone: 'default' },
  GROUPEMENT_DELETED: {
    category: 'Groupement',
    label: 'Groupement désactivé',
    tone: 'destructive',
  },
  GROUPEMENT_UPDATED: { category: 'Groupement', label: 'Groupement modifié', tone: 'outline' },
  USER_ACTIVATED: { category: 'Utilisateur', label: 'Utilisateur activé', tone: 'default' },
  USER_CREATED: { category: 'Utilisateur', label: 'Utilisateur créé', tone: 'default' },
  USER_DEACTIVATED: {
    category: 'Utilisateur',
    label: 'Utilisateur désactivé',
    tone: 'destructive',
  },
  USER_DELETED: { category: 'Utilisateur', label: 'Utilisateur supprimé', tone: 'destructive' },
  USER_INVITED: { category: 'Utilisateur', label: 'Utilisateur invité', tone: 'default' },
  USER_PASSWORD_RESET_REQUESTED: {
    category: 'Utilisateur',
    label: 'Réinitialisation demandée',
    tone: 'outline',
  },
  USER_UPDATED: { category: 'Utilisateur', label: 'Utilisateur modifié', tone: 'outline' },
};

const RESOURCE_LABELS: Record<string, string> = {
  Clients: 'Client',
  Courses: 'Course',
  Drivers: 'Chauffeur',
  Groupements: 'Groupement',
  Users: 'Utilisateur',
};

export const AUDIT_ACTION_OPTIONS = Object.entries(ACTION_PRESENTATION)
  .map(([value, presentation]) => ({
    label: presentation.label,
    value,
  }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));

export function getAuditActionPresentation(action: string): AuditActionPresentation {
  return (
    ACTION_PRESENTATION[action] ?? {
      category: 'Action',
      label: humanizeCode(action),
      tone: 'outline',
    }
  );
}

export function getAuditActor(entry: AuditLog): { detail?: string; label: string } {
  if (entry.actorName) {
    return {
      detail: entry.actorEmail ?? undefined,
      label: entry.actorName,
    };
  }

  if (entry.actorEmail) {
    return { label: entry.actorEmail };
  }

  if (entry.userId === 'system') {
    return { label: 'Système' };
  }

  return { label: 'Utilisateur non identifié' };
}

export function getAuditGroupement(entry: AuditLog): { detail?: string; label: string } {
  if (entry.groupementName) {
    return {
      detail: entry.groupementCode ?? undefined,
      label: entry.groupementName,
    };
  }

  if (!entry.groupementId) {
    return { label: 'Plateforme' };
  }

  return { label: 'Groupement non identifié' };
}

export function getAuditResource(entry: AuditLog): { detail?: string; label: string } {
  const resourceLabel = entry.resourceType
    ? (RESOURCE_LABELS[entry.resourceType] ?? humanizeCode(entry.resourceType))
    : 'Élément';
  const data = entry.after ?? entry.before;
  const resourceName = extractResourceName(data);

  if (resourceName) {
    return {
      detail: resourceLabel,
      label: resourceName,
    };
  }

  return { label: resourceLabel };
}

function extractResourceName(data: Record<string, unknown> | null): string | null {
  if (!data) {
    return null;
  }

  const explicitName = readString(data, 'fullName') ?? readString(data, 'name');
  if (explicitName) {
    return explicitName;
  }

  const firstName = readString(data, 'firstName');
  const lastName = readString(data, 'lastName');
  const personName = [firstName, lastName].filter(Boolean).join(' ');
  if (personName) {
    return personName;
  }

  const pickupAddress = readString(data, 'pickupAddress');
  const dropoffAddress = readString(data, 'dropoffAddress');
  if (pickupAddress && dropoffAddress) {
    return `${pickupAddress} → ${dropoffAddress}`;
  }

  return (
    readString(data, 'driverIdentifier') ??
    readString(data, 'matricule') ??
    readString(data, 'email') ??
    readString(data, 'phoneE164') ??
    null
  );
}

function readString(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function humanizeCode(code: string): string {
  return code
    .replace(/_/g, ' ')
    .toLocaleLowerCase('fr')
    .replace(/^./, (letter) => letter.toLocaleUpperCase('fr'));
}
