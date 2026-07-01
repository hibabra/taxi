export const queryKeys = {
  audit: (filters?: Record<string, unknown>) => ['audit', filters ?? {}] as const,
  clients: (groupementId: string, filters?: Record<string, unknown>) =>
    ['clients', groupementId, filters ?? {}] as const,
  courses: (groupementId: string, filters?: Record<string, unknown>) =>
    ['courses', groupementId, filters ?? {}] as const,
  driverInvitations: (groupementId: string) => ['driver-invitations', groupementId] as const,
  drivers: (groupementId: string, filters?: Record<string, unknown>) =>
    ['drivers', groupementId, filters ?? {}] as const,
  groupement: (groupementId: string) => ['groupement', groupementId] as const,
  groupements: (filters?: Record<string, unknown>) => ['groupements', filters ?? {}] as const,
  me: ['me'] as const,
  users: (groupementId: string, filters?: Record<string, unknown>) =>
    ['users', groupementId, filters ?? {}] as const,
  stations: (groupementId: string) => ['stations', groupementId] as const,
  zone: (groupementId: string) => ['zone', groupementId] as const,
  queue: (groupementId: string) => ['queue', groupementId] as const,
  positions: (groupementId: string) => ['positions', groupementId] as const,
};