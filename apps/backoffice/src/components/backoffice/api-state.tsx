import { AlertCircle, Loader2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { userFacingApiMessage, userFacingApiTitle } from '@/lib/api/errors';

type ApiStateProps = {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
  title?: string;
};

export function LoadingState({ label = 'Chargement des données' }: { label?: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-md border border-border bg-card/50 text-sm text-muted-foreground">
      <Loader2 className="mr-2 size-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function ErrorState({
  error,
  message = 'Impossible de charger les données.',
  onRetry,
  title = 'Erreur API',
}: ApiStateProps) {
  const displayMessage = error ? userFacingApiMessage(error) : message;
  const displayTitle = error ? userFacingApiTitle(error) : title;

  return (
    <Alert className="border-destructive/40 bg-destructive/10">
      <AlertCircle className="size-4" />
      <AlertTitle>{displayTitle}</AlertTitle>
      <AlertDescription className="mt-2 flex flex-col gap-3 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{displayMessage}</span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Réessayer
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({ message, title }: Required<Pick<ApiStateProps, 'message' | 'title'>>) {
  return (
    <div className="rounded-md border border-dashed border-border bg-card/40 p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
