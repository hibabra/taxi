'use client';

import type { CreateClientPayload } from '@taxikiwi/shared-types';
import { Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

type ClientFormValues = {
  addressLine1: string;
  city: string;
  email: string;
  fullName: string;
  notes: string;
  phone: string;
  postalCode: string;
};

export function ClientFormDialog({
  loading,
  onCreate,
}: {
  loading: boolean;
  onCreate: (payload: CreateClientPayload) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ClientFormValues>({
    defaultValues: {
      addressLine1: '',
      city: '',
      email: '',
      fullName: '',
      notes: '',
      phone: '',
      postalCode: '',
    },
  });

  async function submit(values: ClientFormValues) {
    const hasAddress = values.addressLine1.trim() && values.postalCode.trim() && values.city.trim();
    const payload: CreateClientPayload = {
      addresses: hasAddress
        ? [
            {
              addressLine1: values.addressLine1.trim(),
              city: values.city.trim(),
              countryCode: 'FR',
              isDefault: true,
              label: 'Adresse principale',
              postalCode: values.postalCode.trim(),
            },
          ]
        : undefined,
      countryCode: 'FR',
      email: values.email.trim() || null,
      fullName: values.fullName.trim(),
      notes: values.notes.trim() || null,
      phone: values.phone.trim(),
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
          Nouveau client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer une fiche client</DialogTitle>
          <DialogDescription>
            Les informations sensibles restent limitées au strict nécessaire pour l’exploitation.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
          <FormField label="Nom complet">
            <Input required {...form.register('fullName')} />
          </FormField>
          <FormField label="Téléphone">
            <Input required placeholder="06 12 34 56 78" {...form.register('phone')} />
          </FormField>
          <FormField label="Email">
            <Input type="email" {...form.register('email')} />
          </FormField>
          <FormField label="Adresse principale">
            <Input {...form.register('addressLine1')} />
          </FormField>
          <FormField label="Code postal">
            <Input {...form.register('postalCode')} />
          </FormField>
          <FormField label="Ville">
            <Input {...form.register('city')} />
          </FormField>
          <FormField className="sm:col-span-2" label="Notes exploitation">
            <Textarea rows={3} {...form.register('notes')} />
          </FormField>
          <DialogFooter className="sm:col-span-2">
            <Button disabled={loading} type="submit">
              Créer le client
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <div className={className}>
      <div className="grid gap-2">
        <Label>{label}</Label>
        {children}
      </div>
    </div>
  );
}
