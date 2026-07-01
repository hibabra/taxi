'use client';

import type { CreateGroupementPayload } from '@taxikiwi/shared-types';
import { Building2, Mail, Plus, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { createGroupementSchema, type CreateGroupementInput } from '@taxikiwi/shared-validators';

export function GroupementCreateDialog({
  loading,
  onCreate,
}: {
  loading: boolean;
  onCreate: (payload: CreateGroupementPayload) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<CreateGroupementInput>({
    defaultValues: {
      address: '',
      city: '',
      code: '',
      contactEmail: '',
      contactPhone: '',
      initialAdmin: {
        email: '',
        licenseCity: '',
        licenseNumber: '',
      },
      name: '',
      postalCode: '',
      serviceArea: '',
    },
  });

  async function submit(values: CreateGroupementInput) {
    const parsed = createGroupementSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        form.setError(path as keyof CreateGroupementInput, { message: issue.message });
      }
      return;
    }

    const payload: CreateGroupementPayload = {
      ...parsed.data,
      code: parsed.data.code || undefined,
      serviceArea: parsed.data.serviceArea || undefined,
    };

    try {
      await onCreate(payload);
    } catch {
      return;
    }

    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nouveau groupement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Créer un groupement</DialogTitle>
          <DialogDescription>
            Un premier administrateur sera invité automatiquement par email.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-6" onSubmit={form.handleSubmit(submit)}>
          {/* ── Informations groupement ────────────────────────────── */}
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="size-4" />
            Informations du groupement
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom commercial" message={form.formState.errors.name?.message}>
              <Input {...form.register('name')} />
            </FormField>
            <FormField label="Code public" message={form.formState.errors.code?.message}>
              <Input placeholder="TAXI-KIWI" {...form.register('code')} />
            </FormField>
            <FormField label="Adresse" message={form.formState.errors.address?.message}>
              <Input {...form.register('address')} />
            </FormField>
            <FormField label="Code postal" message={form.formState.errors.postalCode?.message}>
              <Input {...form.register('postalCode')} />
            </FormField>
            <FormField label="Ville" message={form.formState.errors.city?.message}>
              <Input {...form.register('city')} />
            </FormField>
            <FormField label="Email contact" message={form.formState.errors.contactEmail?.message}>
              <Input type="email" {...form.register('contactEmail')} />
            </FormField>
            <FormField
              label="Téléphone contact"
              message={form.formState.errors.contactPhone?.message}
            >
              <Input {...form.register('contactPhone')} />
            </FormField>
            <FormField label="Zone de service" message={form.formState.errors.serviceArea?.message}>
              <Input {...form.register('serviceArea')} />
            </FormField>
          </div>

          <Separator />

          {/* ── Premier administrateur ──────────────────────────────── */}
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <UserCheck className="size-4" />
            Premier administrateur
          </div>
          <p className="text-xs text-muted-foreground">
            Cette personne recevra une invitation par email pour créer son compte et gérer le
            groupement.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              label="Email admin"
              message={form.formState.errors.initialAdmin?.email?.message}
            >
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="admin@groupement.fr"
                  type="email"
                  {...form.register('initialAdmin.email')}
                />
              </div>
            </FormField>
            <FormField
              label="Ville de licence"
              message={form.formState.errors.initialAdmin?.licenseCity?.message}
            >
              <Input placeholder="Paris" {...form.register('initialAdmin.licenseCity')} />
            </FormField>
            <FormField
              label="Numéro de licence"
              message={form.formState.errors.initialAdmin?.licenseNumber?.message}
            >
              <Input placeholder="LIC-75-0001" {...form.register('initialAdmin.licenseNumber')} />
            </FormField>
          </div>

          <DialogFooter>
            <Button disabled={loading} type="submit">
              Créer le groupement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
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
