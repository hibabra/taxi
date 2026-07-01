export type AuthMode = 'platform' | 'groupement';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'DRIVER';

export type DriverStatus = 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDED';

export type CourseStatus = 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type DispatchPolicy = 'DISTANCE_FIRST' | 'FREE_FIRST' | 'STATION_FIRST';

export type StationType = 'CIRCLE' | 'POLYGON';

export interface PolygonPoint {
  lat: number;
  lng: number;
}

export type IsoDateString = string;

export interface DaySchedule {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface GroupementSettings {
  id: string;
  groupementId: string;
  ringTimeoutSeconds: number;
  dispatchPolicy: DispatchPolicy;
  serviceHours: WeekSchedule;
  gdprNotice: string;
  logoUrl: string | null;
  primaryColor: string;
}

export interface Groupement {
  id: string;
  name: string;
  code: string;
  address: string;
  postalCode: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  serviceArea: string | null;
  zoneType: StationType | null;
  zoneLatitude: number | null;
  zoneLongitude: number | null;
  zoneRadiusMeters: number | null;
  zonePolygonPoints: PolygonPoint[] | null;
  zoneColor: string;
  isActive: boolean;
  driverIdentifierNext: number;
  settings?: GroupementSettings;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateGroupementPayload {
  name: string;
  code?: string;
  address: string;
  postalCode: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  serviceArea?: string;
  initialAdmin: {
    email: string;
    licenseCity: string;
    licenseNumber: string;
  };
}

export type UpdateGroupementPayload = Partial<
  Omit<CreateGroupementPayload, 'initialAdmin'> & {
    isActive: boolean;
    zoneType: StationType | null;
    zoneLatitude: number | null;
    zoneLongitude: number | null;
    zoneRadiusMeters: number | null;
    zonePolygonPoints: PolygonPoint[] | null;
    zoneColor: string;
  }
>;

export interface Driver {
  id: string;
  groupementId: string;
  userId: string | null;
  driverIdentifier: string;
  firstName: string;
  lastName: string;
  matricule: string;
  phoneE164: string;
  licenseCity: string | null;
  licenseNumber: string | null;
  joinedAt: IsoDateString;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  vehicleYear: number;
  status: DriverStatus;
  statusReason: string | null;
  statusChangedAt: IsoDateString;
  suspendedAt: IsoDateString | null;
  offboardedAt: IsoDateString | null;
  isGroupAdmin: boolean;
  mobileActivatedAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface DriverInvitation {
  id: string;
  groupementId: string;
  email: string;
  licenseCity: string;
  licenseNumber: string;
  expiresAt: IsoDateString;
}

export interface CreateDriverInvitationPayload {
  email: string;
  licenseCity: string;
  licenseNumber: string;
}

export interface CreateDriverPayload {
  firstName: string;
  lastName: string;
  phone: string;
  countryCode?: 'FR';
  licenseCity?: string | null;
  licenseNumber?: string | null;
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  vehicleYear: number;
}

export type UpdateDriverPayload = Partial<
  Omit<CreateDriverPayload, 'countryCode'> & {
    countryCode: 'FR';
  }
>;

export interface AcceptDriverInvitationPayload {
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  countryCode?: 'FR';
  vehicleMake: string;
  vehicleModel: string;
  vehicleRegistration: string;
  vehicleYear: number;
}

export interface ClientAddress {
  id: string;
  clientId: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  countryCode: string;
  isDefault: boolean;
}

export interface Client {
  id: string;
  groupementId: string;
  fullName: string;
  gender: string | null;
  email: string | null;
  phoneE164: string;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  notes: string | null;
  anonymizationRequestedAt: IsoDateString | null;
  archivedAt: IsoDateString | null;
  addresses: ClientAddress[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ClientAddressPayload {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  countryCode?: 'FR';
  isDefault?: boolean;
  label: string;
  postalCode: string;
}

export interface CreateClientPayload {
  addresses?: ClientAddressPayload[];
  countryCode?: 'FR';
  email?: string | null;
  fullName: string;
  gender?: string | null;
  notes?: string | null;
  phone: string;
}

export type UpdateClientPayload = Partial<Omit<CreateClientPayload, 'addresses'>>;

export interface Course {
  id: string;
  groupementId: string;
  driverId: string;
  clientId: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  startedAt: IsoDateString;
  durationMinutes: number;
  distanceKm: number;
  amountEur: number | null;
  status: CourseStatus;
  note: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateCoursePayload {
  amountEur?: number | null;
  clientId?: string | null;
  distanceKm: number;
  driverId: string;
  dropoffAddress: string;
  durationMinutes: number;
  note?: string | null;
  pickupAddress: string;
  startedAt: string;
  status?: CourseStatus;
}

export type UpdateCoursePayload = Partial<CreateCoursePayload>;

export interface AuditLog {
  id: string;
  groupementId: string | null;
  groupementCode?: string | null;
  groupementName?: string | null;
  userId: string;
  actorEmail?: string | null;
  actorName?: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: IsoDateString;
}

export interface User {
  id: string;
  groupementId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneE164: string | null;
  roles: UserRole[];
  isActive: boolean;
  lastLoginAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateUserInvitationPayload {
  email: string;
  firstName: string;
  lastName: string;
  phoneE164?: string;
  roles: UserRole[];
}

export interface AcceptUserInvitationPayload {
  password: string;
}

export interface ResetPasswordPayload {
  password: string;
}

export interface UserInvitation {
  id: string;
  groupementId: string;
  email: string;
  roles: UserRole[];
  expiresAt: IsoDateString;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  phoneE164?: string | null;
  roles?: UserRole[];
}

export type UpdateGroupementSettingsPayload = Partial<{
  dispatchPolicy: DispatchPolicy;
  gdprNotice: string;
  logoUrl: string | null;
  primaryColor: string;
  ringTimeoutSeconds: number;
  serviceHours: WeekSchedule;
}>;
// ── Stations ─────────────────────────────────────────────────
// StationType and PolygonPoint are defined at the top of this file.

export interface Station {
  id: string;
  groupementId: string;
  name: string;
  description: string | null;
  address: string | null;
  type: StationType;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  polygonPoints: PolygonPoint[] | null;
  isActive: boolean;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CreateStationPayload {
  name: string;
  description?: string;
  address?: string;
  type: StationType;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  polygonPoints?: PolygonPoint[];
}

export type UpdateStationPayload = Partial<CreateStationPayload>;

export type DriverAvailabilityStatus = 'LIBRE' | 'COURSE' | 'ABSENT' | 'HORS_SERVICE' | 'STATION';

export interface DriverPosition {
  driverId: string;
  groupementId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  status: DriverAvailabilityStatus | null;
  recordedAt: IsoDateString;
}

export interface UpdatePositionPayload {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  status?: DriverAvailabilityStatus;
}

// ── Queue / Tour de rôle ──────────────────────────────────────
export interface QueueEntry {
  position: number;
  driverId: string;
  driverIdentifier: string;
  firstName: string;
  lastName: string;
  status: DriverAvailabilityStatus;
  joinedQueueAt: IsoDateString;
}

export interface QueueResponse {
  groupementId: string;
  total: number;
  entries: QueueEntry[];
}
