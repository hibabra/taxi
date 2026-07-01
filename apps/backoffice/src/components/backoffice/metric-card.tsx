import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export function MetricCard({
  detail,
  icon: Icon,
  label,
  tone = 'default',
  value,
}: {
  detail?: string;
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'green';
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <span
          className={cn(
            'grid size-10 place-items-center rounded-md border',
            tone === 'green'
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>
      {detail && <p className="mt-3 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}
