'use client';

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
import { Textarea } from '@/components/ui/textarea';

export function ReasonActionDialog({
  buttonLabel,
  description,
  loading,
  onConfirm,
  title,
  variant = 'outline',
}: {
  buttonLabel: string;
  description: string;
  loading?: boolean;
  onConfirm: (reason: string) => Promise<unknown> | void;
  title: string;
  variant?: 'destructive' | 'outline';
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  async function confirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      return;
    }

    try {
      await onConfirm(trimmed);
    } catch {
      return;
    }

    setReason('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={variant}>
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          minLength={1}
          placeholder="Motif"
          rows={4}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <DialogFooter>
          <Button disabled={!reason.trim() || loading} onClick={confirm}>
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
