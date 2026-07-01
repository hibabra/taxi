'use client';

import type { CreateUserInvitationPayload } from '@taxikiwi/shared-types';
import { UserPlus } from 'lucide-react';
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

type UserInvitationFormValues = {
  email: string;
  firstName: string;
  lastName: string;
  phoneE164: string;
};

export function UserInvitationDialog({
  loading,
  onInvite,
}: {
  loading: boolean;
  onInvite: (payload: CreateUserInvitationPayload) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const form = useForm<UserInvitationFormValues>({
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      phoneE164: '',
    },
  });

  async function submit(values: UserInvitationFormValues) {
    try {
      await onInvite({
        email: values.email.trim(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phoneE164: values.phoneE164.trim() || undefined,
        roles: ['ADMIN'],
      });
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
          <UserPlus className="size-4" />
          Inviter un utilisateur
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Inviter un utilisateur</DialogTitle>
          <DialogDescription>
            L’utilisateur recevra une invitation pour finaliser son compte.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)}>
          <FormField label="Prénom">
            <Input required {...form.register('firstName')} />
          </FormField>
          <FormField label="Nom">
            <Input required {...form.register('lastName')} />
          </FormField>
          <FormField label="Email">
            <Input required type="email" {...form.register('email')} />
          </FormField>
          <FormField label="Téléphone">
            <Input placeholder="+33612345678" {...form.register('phoneE164')} />
          </FormField>
          <DialogFooter className="sm:col-span-2">
            <Button disabled={loading} type="submit">
              Envoyer l’invitation
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
