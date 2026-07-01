'use client';

import type { Groupement, UpdateGroupementPayload } from '@taxikiwi/shared-types';
import { Building2, Pencil, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { updateGroupementSchema, type UpdateGroupementInput } from '@taxikiwi/shared-validators';

export function GroupementEditDialog({
  groupement,
  loading,
  onSave,
}: {
  groupement: Groupement;
  loading: boolean;
  onSave: (payload: UpdateGroupementPayload) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<UpdateGroupementInput>({
    defaultValues: toFormValues(groupement),
  });
  const isActive = useWatch({ control: form.control, name: 'isActive' });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(groupement));
    }
  }, [form, groupement, open]);

  async function submit(values: UpdateGroupementInput) {
    const parsed = updateGroupementSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        form.setError(path as keyof UpdateGroupementInput, { message: issue.message });
      }
      return;
    }

    const payload: UpdateGroupementPayload = {
      ...parsed.data,
      serviceArea: parsed.data.serviceArea ?? '',
    };

    try {
      await onSave(payload);
    } catch {
      return;
    }

    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-4" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifier le groupement</DialogTitle>
        </DialogHeader>
        <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="size-4" />
            Informations du groupement
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nom commercial" message={form.formState.errors.name?.message}>
              <Input {...form.register('name')} />
            </FormField>
            <FormField label="Code public" message={form.formState.errors.code?.message}>
              <Input {...form.register('code')} />
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

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label>Statut actif</Label>
              <p className="text-xs text-muted-foreground">
                Un groupement inactif ne permet plus la connexion de ses utilisateurs.
              </p>
            </div>
            <Switch
              checked={Boolean(isActive)}
              onCheckedChange={(checked) => form.setValue('isActive', checked)}
            />
          </div>

          <DialogFooter>
            <Button disabled={loading} type="submit">
              <Save className="size-4" />
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toFormValues(groupement: Groupement): UpdateGroupementInput {
  return {
    address: groupement.address,
    city: groupement.city,
    code: groupement.code,
    contactEmail: groupement.contactEmail,
    contactPhone: groupement.contactPhone,
    isActive: groupement.isActive,
    name: groupement.name,
    postalCode: groupement.postalCode,
    serviceArea: groupement.serviceArea ?? '',
  };
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
