'use client';

import { useQuery } from '@tanstack/react-query';
// APRÈS
import {
  BellPlus,
  BookUser,
  Building2,
  Car,
  Layers,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Map,
  MapPin,
  Menu,
  Route,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { TaxiKiwiLogo } from '@/components/brand/taxi-kiwi-logo';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { listGroupements } from '@/lib/api/groupements.api';
import { queryKeys } from '@/lib/api/query-keys';
import { useApiClient } from '@/lib/api/use-api-client';
import { useAdminStore } from '@/lib/state/admin-store';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  /** Visible uniquement pour le SUPER_ADMIN (section Plateforme). */
  superAdminOnly?: boolean;
  /** Nécessite un groupement sélectionné pour être cliquable. */
  requiresTenant?: boolean;
};

/**
 * Navigation structurée par contexte métier :
 *
 * SUPER_ADMIN : Dashboard → Groupements → Chauffeurs (tenant) → Audit → Paramètres
 * ADMIN       : Dashboard → Chauffeurs → Invitations → Utilisateurs → Clients → Courses → Paramètres
 */

/** Items visibles uniquement par le SUPER_ADMIN. */
const superAdminItems: NavItem[] = [
  { href: '/groupements', icon: Building2, label: 'Groupements', superAdminOnly: true },
  { href: '/chauffeurs', icon: Car, label: 'Chauffeurs', requiresTenant: true, superAdminOnly: true },
  { href: '/audit', icon: ShieldCheck, label: 'Audit', superAdminOnly: true },
];

/** Items visibles uniquement par l'ADMIN de groupement. */
// APRÈS
const adminItems: NavItem[] = [
  { href: '/chauffeurs', icon: Car, label: 'Chauffeurs' },
  { href: '/invitations', icon: BellPlus, label: 'Invitations' },
  { href: '/utilisateurs', icon: Users, label: 'Utilisateurs' },
  { href: '/clients', icon: BookUser, label: 'Clients' },
  { href: '/courses', icon: Route, label: 'Courses' },
  { href: '/zones-stations', icon: Layers, label: 'Zones & Stations' },
  { href: '/carte', icon: Map, label: 'Carte' },
  { href: '/tour-de-role', icon: ListOrdered, label: 'Tour de rôle' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isSuperAdmin = session?.user.roles.includes('SUPER_ADMIN') ?? false;
  const mobileNavOpen = useAdminStore((state) => state.mobileNavOpen);
  const selectedGroupementId = useAdminStore((state) => state.selectedGroupementId);
  const setMobileNavOpen = useAdminStore((state) => state.setMobileNavOpen);
  const setSelectedGroupementId = useAdminStore((state) => state.setSelectedGroupementId);
  const platformClient = useApiClient(null);

  const groupementsQuery = useQuery({
    enabled: isSuperAdmin && Boolean(session?.accessToken),
    queryFn: () => listGroupements(platformClient, { limit: 100, page: 1 }),
    queryKey: queryKeys.groupements({ limit: 100 }),
  });

  const selectedGroupement =
    groupementsQuery.data?.data.find((groupement) => groupement.id === selectedGroupementId) ??
    null;

  const hasTenant = isSuperAdmin ? Boolean(selectedGroupementId) : true;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-border bg-sidebar lg:flex lg:flex-col">
        <ShellSidebar
          hasTenant={hasTenant}
          isSuperAdmin={isSuperAdmin}
          pathname={pathname}
          onNavigate={() => setMobileNavOpen(false)}
        />
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button className="lg:hidden" size="icon" variant="outline">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-80 border-border bg-sidebar p-0" side="left">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <ShellSidebar
                  hasTenant={hasTenant}
                  isSuperAdmin={isSuperAdmin}
                  pathname={pathname}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              {isSuperAdmin ? (
                <GroupementSelector
                  loading={groupementsQuery.isLoading}
                  selectedId={selectedGroupementId}
                  selectedName={selectedGroupement?.name}
                  groupements={groupementsQuery.data?.data ?? []}
                  onSelect={setSelectedGroupementId}
                />
              ) : (
                <p className="truncate text-sm text-muted-foreground">
                  Groupement courant :{' '}
                  <span className="font-semibold text-foreground">
                    {session?.user.groupementName ?? session?.user.groupementId ?? 'non défini'}
                  </span>
                </p>
              )}
            </div>

            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-sm font-medium text-foreground">{session?.user.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {session?.user.roles.join(', ')}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => void signOut({ callbackUrl: '/login' })}
                >
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Déconnexion</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}

function ShellSidebar({
  hasTenant,
  isSuperAdmin,
  onNavigate,
  pathname,
}: {
  hasTenant: boolean;
  isSuperAdmin: boolean;
  onNavigate: () => void;
  pathname: string;
}) {
  const roleItems = isSuperAdmin ? superAdminItems : adminItems;
  const sectionLabel = isSuperAdmin ? 'Gestion plateforme' : 'Gestion groupement';

  return (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <TaxiKiwiLogo className="h-12" />
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 kiwi-scrollbar">
        {/* Dashboard — toujours visible */}
        <NavLink
          active={pathname === '/dashboard' || pathname.startsWith('/dashboard/')}
          disabled={false}
          href="/dashboard"
          icon={LayoutDashboard}
          label="Dashboard"
          onNavigate={onNavigate}
        />

        {/* Section métier selon le rôle */}
        <SectionLabel>{sectionLabel}</SectionLabel>
        {roleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const disabled = Boolean(item.requiresTenant && !hasTenant);

          return (
            <NavLink
              key={item.href}
              active={active}
              disabled={disabled}
              href={item.href}
              icon={item.icon}
              label={item.label}
              tooltip={disabled ? 'Sélectionnez un groupement pour voir les chauffeurs' : undefined}
              onNavigate={onNavigate}
            />
          );
        })}

        {/* Paramètres — toujours visible */}
        <Separator className="my-2" />
        <NavLink
          active={pathname === '/parametres' || pathname.startsWith('/parametres/')}
          disabled={false}
          href="/parametres"
          icon={Settings}
          label="Paramètres"
          onNavigate={onNavigate}
        />
      </nav>

      <div className="border-t border-border p-4">
        <div className="rounded-md border border-border bg-background/60 p-3">
          <p className="text-xs font-medium text-foreground">Backoffice Taxi Kiwi</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isSuperAdmin
              ? 'Supervision plateforme'
              : 'Opérations de votre groupement'}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

function NavLink({
  active,
  disabled,
  href,
  icon: Icon,
  label,
  onNavigate,
  tooltip,
}: {
  active: boolean;
  disabled: boolean;
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  onNavigate: () => void;
  tooltip?: string;
}) {
  const content = (
    <Button
      asChild={!disabled}
      className={cn(
        'h-11 w-full justify-start gap-3 px-3',
        active
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : disabled
            ? 'cursor-not-allowed text-muted-foreground/40 hover:bg-transparent hover:text-muted-foreground/40'
            : 'text-muted-foreground hover:text-foreground',
      )}
      disabled={disabled}
      variant={active ? 'default' : 'ghost'}
      onClick={disabled ? undefined : onNavigate}
    >
      {disabled ? (
        <span className="flex items-center gap-3">
          <Icon className="size-4" />
          <span>{label}</span>
        </span>
      ) : (
        <Link href={href}>
          <Icon className="size-4" />
          <span>{label}</span>
        </Link>
      )}
    </Button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function GroupementSelector({
  groupements,
  loading,
  onSelect,
  selectedId,
  selectedName,
}: {
  groupements: Array<{ id: string; name: string }>;
  loading: boolean;
  onSelect: (groupementId: null | string) => void;
  selectedId: null | string;
  selectedName?: string;
}) {
  if (loading) {
    return <Skeleton className="h-10 w-full max-w-sm" />;
  }

  return (
    <div className="flex flex-col gap-1 sm:max-w-sm">
      <Select
        value={selectedId ?? 'none'}
        onValueChange={(value) => onSelect(value === 'none' ? null : value)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choisir un groupement">
            {selectedName ?? 'Choisir un groupement'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Aucun groupement sélectionné</SelectItem>
          {groupements.map((groupement) => (
            <SelectItem key={groupement.id} value={groupement.id}>
              {groupement.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
