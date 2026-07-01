import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export function SummaryStrip({
  items,
}: {
  items: Array<{
    detail?: string;
    icon: LucideIcon;
    label: string;
    tone?: 'default' | 'good' | 'warning' | 'danger' | 'info';
    value: number | string;
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.label} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
              </div>
              <span
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground',
                  item.tone === 'good' && 'border-primary/30 bg-primary/10 text-primary',
                  item.tone === 'warning' && 'border-chart-3/30 bg-chart-3/10 text-chart-3',
                  item.tone === 'danger' &&
                    'border-destructive/30 bg-destructive/10 text-destructive',
                  item.tone === 'info' && 'border-chart-2/30 bg-chart-2/10 text-chart-2',
                )}
              >
                <Icon className="size-4" />
              </span>
            </div>
            {item.detail && <p className="mt-3 text-xs text-muted-foreground">{item.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}
