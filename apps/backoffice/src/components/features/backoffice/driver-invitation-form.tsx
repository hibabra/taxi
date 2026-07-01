'use client';

import type { CreateDriverInvitationPayload } from '@taxikiwi/shared-types';
import { Send } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createDriverInvitationSchema,
  type CreateDriverInvitationForm,
} from '@/lib/validations/driver.schema';

export function DriverInvitationForm({
  loading,
  onInvite,
}: {
  loading: boolean;
  onInvite: (payload: CreateDriverInvitationPayload) => Promise<unknown>;
}) {
  const form = useForm<CreateDriverInvitationForm>({
    defaultValues: {
      email: '',
      licenseCity: '',
      licenseNumber: '',
    },
  });

  async function submit(values: CreateDriverInvitationForm) {
    const parsed = createDriverInvitationSchema.safeParse(values);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string') {
          form.setError(field as keyof CreateDriverInvitationForm, { message: issue.message });
        }
      }
      return;
    }

    try {
      await onInvite(parsed.data);
    } catch {
      return;
    }

    form.reset();
  }

  return (
    <form
      className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto]"
      onSubmit={form.handleSubmit(submit)}
    >
      <FormField label="Email" message={form.formState.errors.email?.message}>
        <Input type="email" {...form.register('email')} />
      </FormField>
      <FormField label="Ville de licence" message={form.formState.errors.licenseCity?.message}>
        <Input {...form.register('licenseCity')} />
      </FormField>
      <FormField label="Numero de licence" message={form.formState.errors.licenseNumber?.message}>
        <Input {...form.register('licenseNumber')} />
      </FormField>
      <div className="flex items-end">
        <Button className="w-full md:w-auto" disabled={loading} type="submit">
          <Send className="size-4" />
          Envoyer
        </Button>
      </div>
    </form>
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
