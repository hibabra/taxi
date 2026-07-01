'use client';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateStationPayload, StationType } from '@/lib/api/stations.api';

type StationFormValues = {
  name: string;
  description: string;
  address: string;
  type: StationType;
  // CIRCLE
  latitude: string;
  longitude: string;
  radiusMeters: string;
  // POLYGON
  polygonPoints: string;
};

export function StationFormDialog({
  loading,
  onCreate,
}: {
  loading: boolean;
  onCreate: (payload: CreateStationPayload) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<StationFormValues>({
    defaultValues: {
      name: '',
      description: '',
      address: '',
      type: 'CIRCLE',
      latitude: '',
      longitude: '',
      radiusMeters: '50',
      polygonPoints: '',
    },
  });

  const selectedType = form.watch('type');

  async function submit(values: StationFormValues) {
    let payload: CreateStationPayload;

    if (values.type === 'CIRCLE') {
      payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        address: values.address.trim() || undefined,
        type: 'CIRCLE',
        latitude: parseFloat(values.latitude),
        longitude: parseFloat(values.longitude),
        radiusMeters: parseInt(values.radiusMeters, 10),
      };
    } else {
      // Parser les points du polygone
      // Format attendu : "48.856,2.352 48.857,2.353 48.855,2.354"
      const points = values.polygonPoints
        .trim()
        .split(/\s+/)
        .map((point) => {
          const [lat, lng] = point.split(',');
          return { lat: parseFloat(lat ?? '0'), lng: parseFloat(lng ?? '0') };
        })
        .filter((p) => !isNaN(p.lat) && !isNaN(p.lng));

      payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        address: values.address.trim() || undefined,
        type: 'POLYGON',
        polygonPoints: points,
      };
    }

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
          Nouvelle station
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card sm:max-w-2xl z-[9999]">

        <DialogHeader>
          <DialogTitle>Créer une station</DialogTitle>
          <DialogDescription>
            Une station peut être un cercle (centre + rayon) ou un polygone (liste de points GPS).
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>

          {/* ── Infos générales ──────────────────────── */}
          <FormField label="Nom de la station">
            <Input
              required
              placeholder="ex: Gare du Nord"
              {...form.register('name')}
            />
          </FormField>

          <FormField label="Type de zone">
            <Select
              value={selectedType}
              onValueChange={(value) => form.setValue('type', value as StationType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CIRCLE">Cercle</SelectItem>
                <SelectItem value="POLYGON">Polygone</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField className="sm:col-span-2" label="Adresse">
            <Input
              placeholder="ex: 18 Rue de Dunkerque, 75010 Paris"
              {...form.register('address')}
            />
          </FormField>

          <FormField className="sm:col-span-2" label="Description">
            <Textarea
              rows={2}
              placeholder="ex: Station principale devant l'entrée nord"
              {...form.register('description')}
            />
          </FormField>

          {/* ── Champs CIRCLE ────────────────────────── */}
          {selectedType === 'CIRCLE' && (
            <>
              <FormField label="Latitude">
                <Input
                  required
                  type="number"
                  step="any"
                  placeholder="ex: 48.8566"
                  {...form.register('latitude')}
                />
              </FormField>

              <FormField label="Longitude">
                <Input
                  required
                  type="number"
                  step="any"
                  placeholder="ex: 2.3522"
                  {...form.register('longitude')}
                />
              </FormField>

              <FormField label="Rayon en mètres">
                <Input
                  required
                  type="number"
                  min="10"
                  max="500"
                  placeholder="50"
                  {...form.register('radiusMeters')}
                />
              </FormField>
            </>
          )}

          {/* ── Champs POLYGON ───────────────────────── */}
          {selectedType === 'POLYGON' && (
            <FormField
              className="sm:col-span-2"
              label="Points du polygone"
            >
              <Textarea
                required
                rows={4}
                placeholder={
                  'Un point par espace, format lat,lng\nex: 48.856,2.352 48.857,2.353 48.855,2.354'
                }
                {...form.register('polygonPoints')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 3 points. Format : lat,lng séparés par des espaces.
              </p>
            </FormField>
          )}

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button disabled={loading} type="submit">
              Créer la station
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