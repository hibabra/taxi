import type { PaginationMeta } from '@taxikiwi/shared-types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function ListPagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (meta.totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Page {meta.page} sur {meta.totalPages} · {meta.total} résultat
        {meta.total > 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-2">
        <Button
          disabled={!meta.hasPreviousPage}
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, meta.page - 1))}
        >
          <ChevronLeft className="size-4" />
          Précédent
        </Button>
        <Button
          disabled={!meta.hasNextPage}
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(meta.totalPages, meta.page + 1))}
        >
          Suivant
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
