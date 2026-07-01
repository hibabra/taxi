import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function DetailRow({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[160px_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 text-foreground', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}
