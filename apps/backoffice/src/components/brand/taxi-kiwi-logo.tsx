import { cn } from '@/lib/utils';

export function TaxiKiwiLogo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Taxi Kiwi" height={52} src="/taxi-kiwi-logo.svg" width={168} />
    </div>
  );
}
