'use client';

import type { Client, CreateCoursePayload, Driver } from '@taxikiwi/shared-types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type CourseFormValues = {
  amountEur: string;
  clientId: string;
  distanceKm: string;
  driverId: string;
  dropoffAddress: string;
  durationMinutes: string;
  note: string;
  pickupAddress: string;
  startedAt: string;
  status: 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
};

export function CourseFormDialog({
  clients,
  drivers,
  loading,
  onCreate,
}: {
  clients: Client[];
  drivers: Driver[];
  loading: boolean;
  onCreate: (payload: CreateCoursePayload) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState('none');
  const [driverId, setDriverId] = useState('');
  const [status, setStatus] = useState<CourseFormValues['status']>('COMPLETED');
  const form = useForm<CourseFormValues>({
    defaultValues: {
      amountEur: '',
      clientId: 'none',
      distanceKm: '',
      driverId: '',
      dropoffAddress: '',
      durationMinutes: '',
      note: '',
      pickupAddress: '',
      startedAt: toDatetimeLocalValue(new Date()),
      status: 'COMPLETED',
    },
  });

  async function submit(values: CourseFormValues) {
    const payload: CreateCoursePayload = {
      amountEur: values.amountEur ? Number(values.amountEur) : null,
      clientId: values.clientId === 'none' ? null : values.clientId,
      distanceKm: Number(values.distanceKm),
      driverId: values.driverId,
      dropoffAddress: values.dropoffAddress.trim(),
      durationMinutes: Number(values.durationMinutes),
      note: values.note.trim() || null,
      pickupAddress: values.pickupAddress.trim(),
      startedAt: new Date(values.startedAt).toISOString(),
      status: values.status,
    };

    try {
      await onCreate(payload);
    } catch {
      return;
    }

    setClientId('none');
    setDriverId('');
    setStatus('COMPLETED');
    form.reset({
      ...form.getValues(),
      amountEur: '',
      clientId: 'none',
      distanceKm: '',
      driverId: '',
      dropoffAddress: '',
      durationMinutes: '',
      note: '',
      pickupAddress: '',
      startedAt: toDatetimeLocalValue(new Date()),
      status: 'COMPLETED',
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={drivers.length === 0}>
          <Plus className="size-4" />
          Saisir une course
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Saisie manuelle d’une course</DialogTitle>
          <DialogDescription>
            Utilisé pour reprendre l’historique ou corriger une course traitée hors système.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
          <FormField label="Chauffeur">
            <Select
              value={driverId}
              onValueChange={(value) => {
                setDriverId(value);
                form.setValue('driverId', value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir un chauffeur" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.driverIdentifier} · {driver.firstName} {driver.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Client">
            <Select
              value={clientId}
              onValueChange={(value) => {
                setClientId(value);
                form.setValue('clientId', value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Client non rattaché</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Départ">
            <Input required {...form.register('pickupAddress')} />
          </FormField>
          <FormField label="Arrivée">
            <Input required {...form.register('dropoffAddress')} />
          </FormField>
          <FormField label="Début">
            <Input required type="datetime-local" {...form.register('startedAt')} />
          </FormField>
          <FormField label="Statut">
            <Select
              value={status}
              onValueChange={(value) => {
                const nextStatus = value as CourseFormValues['status'];
                setStatus(nextStatus);
                form.setValue('status', nextStatus);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPLETED">Terminée</SelectItem>
                <SelectItem value="CANCELLED">Annulée</SelectItem>
                <SelectItem value="NO_SHOW">Client absent</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Durée">
            <Input
              required
              min={0}
              placeholder="Minutes"
              type="number"
              {...form.register('durationMinutes')}
            />
          </FormField>
          <FormField label="Distance">
            <Input
              required
              min={0}
              placeholder="Kilomètres"
              step="0.01"
              type="number"
              {...form.register('distanceKm')}
            />
          </FormField>
          <FormField label="Montant">
            <Input
              min={0}
              placeholder="EUR"
              step="0.01"
              type="number"
              {...form.register('amountEur')}
            />
          </FormField>
          <FormField className="sm:col-span-2" label="Note">
            <Textarea rows={3} {...form.register('note')} />
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

function toDatetimeLocalValue(date: Date): string {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}
