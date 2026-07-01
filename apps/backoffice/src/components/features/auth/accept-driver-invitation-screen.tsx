'use client';

import type { AcceptDriverInvitationPayload, Driver } from '@taxikiwi/shared-types';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { TaxiKiwiLogo } from '@/components/brand/taxi-kiwi-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptDriverInvitation } from '@/lib/api/drivers.api';
import { userFacingApiMessage } from '@/lib/api/errors';
import {
  acceptDriverInvitationSchema,
  type AcceptDriverInvitationForm,
} from '@/lib/validations/driver.schema';

export function AcceptDriverInvitationScreen({ token }: { token: string }) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);
  const form = useForm<AcceptDriverInvitationForm>({
    defaultValues: {
      countryCode: 'FR',
      firstName: '',
      lastName: '',
      password: '',
      phone: '',
      vehicleMake: '',
      vehicleModel: '',
      vehicleRegistration: '',
      vehicleYear: new Date().getFullYear(),
    },
  });

  async function submit(values: AcceptDriverInvitationForm) {
    const parsed = acceptDriverInvitationSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];

        if (typeof field === 'string') {
          form.setError(field as keyof AcceptDriverInvitationForm, { message: issue.message });
        }
      }
      return;
    }

    setLoading(true);

    try {
      const payload: AcceptDriverInvitationPayload = {
        ...parsed.data,
        countryCode: 'FR',
      };
      const activatedDriver = await acceptDriverInvitation(token, payload);
      setDriver(activatedDriver);
      toast.success('Compte chauffeur active', {
        description: `Identifiant genere : ${activatedDriver.driverIdentifier}`,
      });
    } catch (error) {
      toast.error('Invitation refusee', {
        description: userFacingApiMessage(error),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-3xl border-border bg-card">
        <CardContent className="p-6">
          <TaxiKiwiLogo />
          <div className="mt-6">
            <p className="font-mono text-xs uppercase text-primary">Invitation chauffeur</p>
            <h1 className="mt-2 text-2xl font-semibold">Finaliser votre inscription</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Aucun compte ne peut etre cree sans invitation valide. L&apos;identifiant Tn est
              genere automatiquement par groupement apres validation.
            </p>
          </div>

          {driver ? (
            <div className="mt-6 flex flex-col gap-4">
              <div className="rounded-md border border-[#334a21] bg-[#101a0c] p-4">
                <p className="text-sm text-muted-foreground">
                  Compte active. Identifiant chauffeur :
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold text-primary">
                  {driver.driverIdentifier}
                </p>
              </div>
              <Button asChild className="w-full h-11 text-base font-medium">
                <Link href="/login?mode=groupement">Se connecter</Link>
              </Button>
            </div>
          ) : (
            <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
              <InviteField label="Prenom" message={form.formState.errors.firstName?.message}>
                <Input {...form.register('firstName')} />
              </InviteField>
              <InviteField label="Nom" message={form.formState.errors.lastName?.message}>
                <Input {...form.register('lastName')} />
              </InviteField>
              <InviteField label="Telephone" message={form.formState.errors.phone?.message}>
                <Input placeholder="06 12 34 56 78" {...form.register('phone')} />
              </InviteField>
              <InviteField label="Marque" message={form.formState.errors.vehicleMake?.message}>
                <Input placeholder="Toyota" {...form.register('vehicleMake')} />
              </InviteField>
              <InviteField label="Modele" message={form.formState.errors.vehicleModel?.message}>
                <Input placeholder="Prius" {...form.register('vehicleModel')} />
              </InviteField>
              <InviteField
                label="Immatriculation"
                message={form.formState.errors.vehicleRegistration?.message}
              >
                <Input placeholder="AB-123-CD" {...form.register('vehicleRegistration')} />
              </InviteField>
              <InviteField label="Annee" message={form.formState.errors.vehicleYear?.message}>
                <Input type="number" {...form.register('vehicleYear')} />
              </InviteField>
              <InviteField label="Mot de passe" message={form.formState.errors.password?.message}>
                <Input type="password" {...form.register('password')} />
              </InviteField>
              <div className="sm:col-span-2">
                <Button className="w-full" disabled={loading} type="submit">
                  Activer mon espace chauffeur
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function InviteField({
  children,
  label,
  message,
}: {
  children: React.ReactNode;
  label: string;
  message?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  );
}
