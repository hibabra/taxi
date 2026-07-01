'use client';

import type { Groupement, UpdateGroupementSettingsPayload } from '@taxikiwi/shared-types';
import { SlidersHorizontal } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DISPATCH_POLICY_LABELS } from '@/lib/backoffice-labels';

type GroupementSettingsValues = {
  dispatchPolicy: 'DISTANCE_FIRST' | 'FREE_FIRST' | 'STATION_FIRST';
  gdprNotice: string;
  logoUrl: string;
  primaryColor: string;
  ringTimeoutSeconds: string;
};

export function GroupementSettingsDialog({
  groupement,
  loading,
  onSave,
}: {
  groupement: Groupement;
  loading: boolean;
  onSave: (payload: UpdateGroupementSettingsPayload) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [dispatchPolicy, setDispatchPolicy] = useState<GroupementSettingsValues['dispatchPolicy']>(
    groupement.settings?.dispatchPolicy ?? 'STATION_FIRST',
  );
  const form = useForm<GroupementSettingsValues>({
    defaultValues: {
      dispatchPolicy: groupement.settings?.dispatchPolicy ?? 'STATION_FIRST',
      gdprNotice: groupement.settings?.gdprNotice ?? '',
      logoUrl: groupement.settings?.logoUrl ?? '',
      primaryColor: groupement.settings?.primaryColor ?? '#9DD51D',
      ringTimeoutSeconds: String(groupement.settings?.ringTimeoutSeconds ?? 30),
    },
  });

  async function submit(values: GroupementSettingsValues) {
    try {
      await onSave({
        dispatchPolicy: values.dispatchPolicy,
        gdprNotice: values.gdprNotice.trim(),
        logoUrl: values.logoUrl.trim() || null,
        primaryColor: values.primaryColor,
        ringTimeoutSeconds: Number(values.ringTimeoutSeconds),
      });
    } catch {
      return;
    }

    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <SlidersHorizontal className="size-4" />
          Paramètres métier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paramètres métier</DialogTitle>
          <DialogDescription>
            Réglages visibles par l’exploitation du groupement et les futures surfaces client.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
          <FormField label="Temps de sonnerie">
            <Input
              required
              max={120}
              min={10}
              type="number"
              {...form.register('ringTimeoutSeconds')}
            />
          </FormField>
          <FormField label="Distribution">
            <Select
              value={dispatchPolicy}
              onValueChange={(value) => {
                const nextPolicy = value as GroupementSettingsValues['dispatchPolicy'];
                setDispatchPolicy(nextPolicy);
                form.setValue('dispatchPolicy', nextPolicy);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISPATCH_POLICY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Couleur">
            <Input type="color" {...form.register('primaryColor')} />
          </FormField>
          <FormField label="Logo">
            <Input placeholder="https://..." {...form.register('logoUrl')} />
          </FormField>
          <FormField className="sm:col-span-2" label="Notice RGPD">
            <Textarea rows={5} {...form.register('gdprNotice')} />
          </FormField>
          <DialogFooter className="sm:col-span-2">
            <Button disabled={loading} type="submit">
              Enregistrer
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
