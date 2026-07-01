'use client';

import type { ChangePasswordPayload } from '@taxikiwi/shared-types';
import { KeyRound } from 'lucide-react';
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

type ChangePasswordValues = ChangePasswordPayload & {
  confirmPassword: string;
};

export function ChangePasswordDialog({
  loading,
  onChangePassword,
}: {
  loading: boolean;
  onChangePassword: (payload: ChangePasswordPayload) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<ChangePasswordValues>({
    defaultValues: {
      confirmPassword: '',
      currentPassword: '',
      newPassword: '',
    },
  });

  async function submit(values: ChangePasswordValues) {
    if (values.newPassword !== values.confirmPassword) {
      form.setError('confirmPassword', { message: 'Les mots de passe ne correspondent pas.' });
      return;
    }

    await onChangePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    });
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound className="size-4" />
          Changer le mot de passe
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Changer le mot de passe</DialogTitle>
          <DialogDescription>
            Après changement, la session sera réinitialisée pour des raisons de sécurité.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={form.handleSubmit(submit)}>
          <FormField label="Mot de passe actuel">
            <Input required type="password" {...form.register('currentPassword')} />
          </FormField>
          <FormField label="Nouveau mot de passe">
            <Input required minLength={12} type="password" {...form.register('newPassword')} />
          </FormField>
          <FormField label="Confirmation" message={form.formState.errors.confirmPassword?.message}>
            <Input required minLength={12} type="password" {...form.register('confirmPassword')} />
          </FormField>
          <DialogFooter>
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
