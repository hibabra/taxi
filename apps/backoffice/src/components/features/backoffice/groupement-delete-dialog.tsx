'use client';

import type { Groupement } from '@taxikiwi/shared-types';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

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

export function GroupementDeleteDialog({
  groupement,
  loading,
  onDelete,
}: {
  groupement: Groupement;
  loading: boolean;
  onDelete: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const canConfirm = confirmation.trim() === groupement.name;

  async function confirm() {
    if (!canConfirm) {
      return;
    }

    try {
      await onDelete();
    } catch {
      return;
    }

    setConfirmation('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <Trash2 className="size-4" />
          Supprimer
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer définitivement</DialogTitle>
          <DialogDescription>
            Cette action supprime le groupement seulement si aucune donnée métier ne bloque la
            suppression.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label>Nom du groupement</Label>
          <Input
            autoFocus
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{groupement.name}</p>
        </div>
        <DialogFooter>
          <Button disabled={!canConfirm || loading} variant="destructive" onClick={confirm}>
            <Trash2 className="size-4" />
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
